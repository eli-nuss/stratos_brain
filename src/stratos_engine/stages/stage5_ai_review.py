"""Stage 5: AI Chart Review - Two-pass LLM-powered chart analysis._new

Pass A: Independent Chart Score (OHLCV-only, 365 bars) - `ai_direction_score`, `ai_setup_quality_score`
Pass B: Reconciliation (optional) - Compares Pass A output with engine scores/signals

Uses Gemini 3 Flash as the primary model.
"""

import json
import hashlib
import logging
import os
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

import google.generativeai as genai

from ..db import Database

logger = logging.getLogger(__name__)

# Load prompts
PROMPT_DIR = Path(__file__).parent.parent / "prompts"


class Stage5AIReview:
    """Stage 5: Two-pass AI-powered chart review for dashboard-surfaced assets."""
    
    PROMPT_VERSION = "v5_independent_ai_score"
    SCOPES = ["inflections_bullish", "inflections_bearish", "trends", "risk"]
    
    # Lookback settings
    PASS1_BARS = 365  # Full year for Pass A
    
    # Model configuration
    DEFAULT_MODEL = "gemini-3-flash"
    FALLBACK_MODEL = "gemini-2.5-pro"
    
    # Safety ceiling per scope
    MAX_ASSETS_PER_SCOPE = 500
    
    def __init__(self, db: Database, api_key: Optional[str] = None, model: Optional[str] = None):
        self.db = db
        
        # Configure Gemini API
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not set in environment or provided")
        
        genai.configure(api_key=self.api_key)
        
        # Set model
        self.model_name = model or os.environ.get("GEMINI_MODEL") or self.DEFAULT_MODEL
        self.model = genai.GenerativeModel(
            model_name=self.model_name,
            generation_config={
                "temperature": 0.2,
                "max_output_tokens": 4000,
                "response_mime_type": "application/json",
            }
        )
        
        self._load_prompts()
        logger.info(f"Stage5AIReview initialized with model: {self.model_name}")
    
    def _load_prompts(self) -> None:
        """Load system prompts and schemas for Pass A (Independent Score) and Pass B (Reconciliation)."""
        self.pass_a_prompt = (PROMPT_DIR / "ai_score_system.txt").read_text()
        self.pass_a_schema = json.loads((PROMPT_DIR / "ai_score_schema.json").read_text())
        self.pass_b_prompt = (PROMPT_DIR / "ai_reconcile_system.txt").read_text()
        self.pass_b_schema = json.loads((PROMPT_DIR / "ai_reconcile_schema.json").read_text())

    def _get_flashed_assets(
        self, 
        as_of_date: str, 
        universe_id: Optional[str] = None,
        config_id: Optional[str] = None,
        limit_per_scope: int = 100
    ) -> List[Dict[str, Any]]:
        """Get flashed assets that warrant AI review."""
        targets = []
        seen_assets = set()
        
        filters = ["as_of_date = %s"]
        params = [as_of_date]
        
        if universe_id:
            filters.append("universe_id = %s")
            params.append(universe_id)
        
        if config_id:
            filters.append("config_id = %s::uuid")
            params.append(config_id)
        
        where_clause = " AND ".join(filters)
        actual_limit = min(limit_per_scope, self.MAX_ASSETS_PER_SCOPE)
        
        # Inflections Bullish
        query_bullish = f"""
        SELECT asset_id, symbol, name, asset_type, universe_id, config_id, weighted_score, score_delta, new_signal_count, inflection_score, components, 'inflections_bullish' as scope
        FROM v_dashboard_inflections
        WHERE {where_clause} AND inflection_direction = 'bullish'
        ORDER BY abs_inflection DESC
        LIMIT %s
        """
        bullish = self.db.fetch_all(query_bullish, params + [actual_limit])
        for row in bullish:
            if row["asset_id"] not in seen_assets:
                targets.append(row)
                seen_assets.add(row["asset_id"])
        
        # Inflections Bearish
        query_bearish = f"""
        SELECT asset_id, symbol, name, asset_type, universe_id, config_id, weighted_score, score_delta, new_signal_count, inflection_score, components, 'inflections_bearish' as scope
        FROM v_dashboard_inflections
        WHERE {where_clause} AND inflection_direction = 'bearish'
        ORDER BY abs_inflection DESC
        LIMIT %s
        """
        bearish = self.db.fetch_all(query_bearish, params + [actual_limit])
        for row in bearish:
            if row["asset_id"] not in seen_assets:
                targets.append(row)
                seen_assets.add(row["asset_id"])

        logger.info(f"Found {len(targets)} flashed assets for review.")
        return targets

    def _build_pass_a_packet(
        self, 
        asset_id: int, 
        as_of_date: str,
        symbol: str,
        name: str,
        asset_type: str,
        universe_id: str,
        config_id: str,
        scope: str
    ) -> Dict[str, Any]:
        """Build OHLCV-only packet for Pass A (365 bars) - Independent Chart Score."""
        ohlcv_query = """
        SELECT date, open, high, low, close, volume
        FROM daily_bars
        WHERE asset_id = %s AND date <= %s
        ORDER BY date DESC
        LIMIT %s
        """
        bars = self.db.fetch_all(ohlcv_query, (asset_id, as_of_date, self.PASS1_BARS))
        bars = list(reversed(bars))
        
        ohlcv_data = [
            [
                str(b["date"]),
                float(b["open"]) if b["open"] else None,
                float(b["high"]) if b["high"] else None,
                float(b["low"]) if b["low"] else None,
                float(b["close"]) if b["close"] else None,
                float(b["volume"]) if b["volume"] else None,
            ]
            for b in bars
        ]
        
        features = {}
        
        packet = {
            "asset": {
                "symbol": symbol,
                "name": name,
                "asset_type": asset_type,
            },
            "context": {
                "scope": scope,
                "as_of_date": as_of_date,
                "universe_id": universe_id,
                "config_id": config_id,
            },
            "ohlcv": ohlcv_data,
            "features": features
        }
        
        return packet

    def _build_pass_b_packet(
        self, 
        pass_a_result: Dict[str, Any],
        score_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Build packet for Pass B (Reconciliation) - Pass A result + Engine Context."""
        packet = {
            "pass_a_result": pass_a_result,
            "engine_context": {
                "signal_facts": score_data.get("components"),
                "engine_scores": {
                    "weighted_score": score_data["weighted_score"],
                    "inflection_score": score_data["inflection_score"],
                    "score_delta": score_data["score_delta"],
                }
            }
        }
        return packet

    def _compute_input_hash(self, pass_a_packet: Dict[str, Any]) -> str:
        """Computes a hash of the inputs to the AI review to ensure idempotency."""
        # Hash last 90 closes and volumes, prompt version, and model name
        last_90_ohlcv = pass_a_packet['ohlcv'][-90:]
        hash_content = {
            "ohlcv_90": [(r[4], r[5]) for r in last_90_ohlcv],
            "prompt_version": self.PROMPT_VERSION,
            "model": self.model_name
        }
        return hashlib.sha256(json.dumps(hash_content, sort_keys=True).encode()).hexdigest()

    def _run_ai_review(
        self, 
        asset: Dict[str, Any], 
        as_of_date: str, 
        run_pass_b: bool = False
    ) -> Optional[Dict[str, Any]]:
        """Runs the two-pass AI review for a single asset."""
        asset_id = asset["asset_id"]
        logger.info(f"Running AI review for asset {asset_id} ({asset['symbol']})")

        # Pass A: Independent Chart Score
        pass_a_packet = self._build_pass_a_packet(
            asset_id=asset["asset_id"],
            as_of_date=as_of_date,
            symbol=asset["symbol"],
            name=asset["name"],
            asset_type=asset["asset_type"],
            universe_id=asset["universe_id"],
            config_id=asset["config_id"],
            scope=asset["scope"]
        )
        
        input_hash = self._compute_input_hash(pass_a_packet)

        try:
            pass_a_response = self.model.generate_content([self.pass_a_prompt, json.dumps(pass_a_packet)])
            pass_a_result = json.loads(pass_a_response.text)
        except Exception as e:
            logger.error(f"Error in Pass A for asset {asset_id}: {e}")
            return None

        # Pass B: Reconciliation (optional)
        pass_b_result = {}
        if run_pass_b:
            pass_b_packet = self._build_pass_b_packet(pass_a_result, asset)
            try:
                pass_b_response = self.model.generate_content([self.pass_b_prompt, json.dumps(pass_b_packet)])
                pass_b_result = json.loads(pass_b_response.text)
            except Exception as e:
                logger.error(f"Error in Pass B for asset {asset_id}: {e}")

        # Combine results and save to DB
        final_result = {
            **pass_a_result,
            **pass_b_result,
            "asset_id": asset_id,
            "as_of_date": as_of_date,
            "universe_id": asset["universe_id"],
            "config_id": asset["config_id"],
            "scope": asset["scope"],
            "model": self.model_name,
            "prompt_version": self.PROMPT_VERSION,
            "input_hash": input_hash,
            "pass_a_packet": json.dumps(pass_a_packet),
            "pass_b_packet": json.dumps(pass_b_packet) if run_pass_b else None,
            "created_at": datetime.utcnow().isoformat(),
            "token_usage": pass_a_response.usage_metadata
        }
        
        self._save_review(final_result)
        return final_result

    def _save_review(self, result: Dict[str, Any]) -> None:
        """Saves the AI review to the database."""
        # Map result keys to DB columns
        db_record = {
            "asset_id": result["asset_id"],
            "as_of_date": result["as_of_date"],
            "universe_id": result["universe_id"],
            "config_id": result["config_id"],
            "scope": result["scope"],
            "prompt_version": result["prompt_version"],
            "model": result["model"],
            "input_hash": result["input_hash"],
            "ai_direction_score": result.get("ai_direction_score"),
            "ai_setup_quality_score": result.get("ai_setup_quality_score"),
            "ai_attention_level": result.get("attention_level"),
            "ai_setup_type": result.get("setup_type"),
            "ai_time_horizon": result.get("time_horizon"),
            "ai_confidence": result.get("confidence"),
            "ai_summary_text": result.get("summary_text"),
            "ai_key_levels": json.dumps(result.get("key_levels")),
            "ai_entry": json.dumps(result.get("entry_zone")),
            "ai_targets": json.dumps(result.get("targets")),
            "ai_why_now": json.dumps(result.get("why_now")),
            "ai_risks": json.dumps(result.get("risks_and_contradictions")),
            "ai_what_to_watch_next": json.dumps(result.get("what_to_watch_next")),
            "agreement_with_engine": result.get("agreement_with_engine"),
            "engine_notes": json.dumps(result.get("engine_notes")),
            "confidence_adjustment": result.get("confidence_adjustment"),
            "raw_response": json.dumps(result) # Store the full response for debugging
        }
        
        # Upsert into asset_ai_reviews
        self.db.upsert("asset_ai_reviews", [db_record], on_conflict=['asset_id', 'as_of_date', 'universe_id', 'config_id', 'scope', 'prompt_version'])
        logger.info(f"Saved AI review for asset {result['asset_id']}")

    def run(
        self, 
        as_of_date: str, 
        universe_id: Optional[str] = None, 
        config_id: Optional[str] = None, 
        limit_per_scope: int = 50, 
        run_pass_b: bool = False
    ) -> None:
        """Main entry point for Stage 5."""
        logger.info(f"Starting Stage5AIReview for {as_of_date}")
        
        assets_to_review = self._get_flashed_assets(as_of_date, universe_id, config_id, limit_per_scope)
        
        for asset in assets_to_review:
            self._run_ai_review(asset, as_of_date, run_pass_b)
            
        logger.info("Stage5AIReview finished.")
