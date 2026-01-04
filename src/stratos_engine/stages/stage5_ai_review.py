"""Stage 5: AI Chart Review - Two-pass LLM-powered chart analysis.

Pass A: Independent Chart Score (OHLCV-only, 365 bars) - `ai_direction_score`, `subscores`
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

from google import genai
from google.genai import types
import numpy as np

from ..db import Database
from ..utils.chart_analyzer import ChartAnalyzer, AI_REVIEW_VERSION

logger = logging.getLogger(__name__)

# Load prompts
PROMPT_DIR = Path(__file__).parent.parent.parent.parent / "prompts"


class Stage5AIReview:
    """Stage 5: Two-pass AI-powered chart review for dashboard-surfaced assets."""
    
    # Use the version from chart_analyzer
    PROMPT_VERSION = AI_REVIEW_VERSION
    SCOPES = ["inflections_bullish", "inflections_bearish", "trends", "risk"]
    
    # Lookback settings
    PASS1_BARS = 365  # Full year for Pass A
    
    # Model configuration
    DEFAULT_MODEL = "gemini-3-flash"
    FALLBACK_MODEL = "gemini-2.5-pro"
    
    # Smoothing configuration
    SIMILARITY_THRESHOLD = 0.98
    QUALITY_CLAMP = 10.0
    DIRECTION_CLAMP = 20.0
    
    # Safety ceiling per scope
    MAX_ASSETS_PER_SCOPE = 500
    
    def __init__(self, db: Database, api_key: Optional[str] = None, model: Optional[str] = None):
        self.db = db
        self.chart_analyzer = ChartAnalyzer(window_size=60) # Use 60 bars for fingerprinting
        
        # Configure Gemini API using the new google.genai SDK
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not set in environment or provided")
        
        # Initialize the client with API key
        self.client = genai.Client(api_key=self.api_key)
        
        # Set model
        self.model_name = model or os.environ.get("GEMINI_MODEL") or self.DEFAULT_MODEL
        
        self._load_prompts()
        logger.info(f"Stage5AIReview initialized with model: {self.model_name}, version: {self.PROMPT_VERSION}")
    
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
        
        filters = ["ds.as_of_date = %s"]
        params = [as_of_date]
        
        if universe_id:
            filters.append("ds.universe_id = %s")
            params.append(universe_id)
        
        if config_id:
            filters.append("ds.config_id = %s::uuid")
            params.append(config_id)
        
        where_clause = " AND ".join(filters)
        actual_limit = min(limit_per_scope, self.MAX_ASSETS_PER_SCOPE)
        
        # Inflections Bullish (positive inflection_score)
        query_bullish = f"""
        SELECT ds.asset_id::bigint as asset_id, a.symbol, a.name, a.asset_type, ds.universe_id, ds.config_id::text, ds.weighted_score, ds.score_delta, ds.inflection_score, ds.components, 'inflections_bullish' as scope
        FROM daily_asset_scores ds
        JOIN assets a ON ds.asset_id::bigint = a.asset_id
        WHERE {where_clause} AND ds.inflection_score > 0
        ORDER BY ds.inflection_score DESC
        LIMIT %s
        """
        bullish = self.db.fetch_all(query_bullish, params + [actual_limit])
        for row in bullish:
            row_dict = dict(row)
            if row_dict["asset_id"] not in seen_assets:
                targets.append(row_dict)
                seen_assets.add(row_dict["asset_id"])
        
        # Inflections Bearish (negative inflection_score)
        query_bearish = f"""
        SELECT ds.asset_id::bigint as asset_id, a.symbol, a.name, a.asset_type, ds.universe_id, ds.config_id::text, ds.weighted_score, ds.score_delta, ds.inflection_score, ds.components, 'inflections_bearish' as scope
        FROM daily_asset_scores ds
        JOIN assets a ON ds.asset_id::bigint = a.asset_id
        WHERE {where_clause} AND ds.inflection_score < 0
        ORDER BY ds.inflection_score ASC
        LIMIT %s
        """
        bearish = self.db.fetch_all(query_bearish, params + [actual_limit])
        for row in bearish:
            row_dict = dict(row)
            if row_dict["asset_id"] not in seen_assets:
                targets.append(row_dict)
                seen_assets.add(row_dict["asset_id"])

        logger.info(f"Found {len(targets)} flashed assets for review.")
        return targets

    def _get_ohlcv_data(self, asset_id: int, as_of_date: str, limit: int) -> List[Dict[str, Any]]:
        """Fetches OHLCV data for a given asset and date."""
        ohlcv_query = """
        SELECT date, open, high, low, close, volume
        FROM daily_bars
        WHERE asset_id = %s AND date <= %s
        ORDER BY date DESC
        LIMIT %s
        """
        bars = self.db.fetch_all(ohlcv_query, (asset_id, as_of_date, limit))
        return list(reversed(bars))

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
        bars = self._get_ohlcv_data(asset_id, as_of_date, self.PASS1_BARS)
        
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
        # The chart analyzer will use the last 60 bars, so we'll use that for the hash content
        ohlcv_data = pass_a_packet['ohlcv']
        
        # Use the chart analyzer to get the fingerprint, which is a hash of the normalized 60-bar data
        fingerprint = self.chart_analyzer.calculate_fingerprint(ohlcv_data)
        
        hash_content = {
            "fingerprint": fingerprint,
            "prompt_version": self.PROMPT_VERSION,
            "model": self.model_name
        }
        return hashlib.sha256(json.dumps(hash_content, sort_keys=True).encode()).hexdigest()

    def _calculate_scores(
        self, 
        asset_id: int, 
        as_of_date: str, 
        ohlcv_data: List[Dict[str, Any]], 
        pass_a_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Calculates the raw setup quality score, chart similarity, and smoothed scores.
        """
        
        # 1. Calculate raw setup quality score from subscores
        subscores = pass_a_result.get("subscores", {})
        total_subscore = sum(subscores.values())
        raw_ai_setup_quality_score = total_subscore * 4.0 # 5 subscores * 5 max = 25 max. 25 * 4 = 100 max.
        
        # 2. Calculate fingerprint
        fingerprint = self.chart_analyzer.calculate_fingerprint(ohlcv_data)
        
        # 3. Get previous day's smoothed scores and fingerprint
        prev_date_query = """
        SELECT date
        FROM daily_bars
        WHERE asset_id = %s AND date < %s
        ORDER BY date DESC
        LIMIT 1
        """
        prev_date_row = self.db.fetch_one(prev_date_query, (asset_id, as_of_date))
        
        prev_smoothed_quality = 0.0
        prev_smoothed_direction = 0.0
        similarity_to_prev = 0.0
        
        if prev_date_row:
            prev_date = str(prev_date_row["date"])
            
            # Get previous day's review
            prev_review_query = """
            SELECT smoothed_ai_setup_quality_score, smoothed_ai_direction_score, fingerprint
            FROM asset_ai_reviews
            WHERE asset_id = %s::text AND as_of_date = %s
            ORDER BY ai_review_version DESC, created_at DESC
            LIMIT 1
            """
            prev_review = self.db.fetch_one(prev_review_query, (str(asset_id), prev_date))
            
            if prev_review:
                prev_smoothed_quality = prev_review.get("smoothed_ai_setup_quality_score") or 0.0
                prev_smoothed_direction = prev_review.get("smoothed_ai_direction_score") or 0.0
                
                # Calculate similarity
                prev_ohlcv_data = self._get_ohlcv_data(asset_id, prev_date, self.chart_analyzer.window_size)
                similarity_to_prev = self.chart_analyzer.calculate_similarity(ohlcv_data, prev_ohlcv_data) or 0.0

        # 4. Apply smoothing rule
        raw_ai_direction_score = pass_a_result.get("ai_direction_score", 0.0)
        
        if similarity_to_prev >= self.SIMILARITY_THRESHOLD:
            # Clamp quality score
            min_q = prev_smoothed_quality - self.QUALITY_CLAMP
            max_q = prev_smoothed_quality + self.QUALITY_CLAMP
            smoothed_ai_setup_quality_score = np.clip(raw_ai_setup_quality_score, min_q, max_q).item()
            
            # Clamp direction score
            min_d = prev_smoothed_direction - self.DIRECTION_CLAMP
            max_d = prev_smoothed_direction + self.DIRECTION_CLAMP
            smoothed_ai_direction_score = np.clip(raw_ai_direction_score, min_d, max_d).item()
        else:
            # No clamp
            smoothed_ai_setup_quality_score = raw_ai_setup_quality_score
            smoothed_ai_direction_score = raw_ai_direction_score
            
        return {
            "fingerprint": fingerprint,
            "similarity_to_prev": similarity_to_prev,
            "raw_ai_setup_quality_score": raw_ai_setup_quality_score,
            "smoothed_ai_setup_quality_score": smoothed_ai_setup_quality_score,
            "raw_ai_direction_score": raw_ai_direction_score,
            "smoothed_ai_direction_score": smoothed_ai_direction_score,
            "subscores": subscores
        }

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
            # Include schema in the prompt
            prompt_with_schema = f"{self.pass_a_prompt}\n\nYou MUST respond with valid JSON matching this schema:\n{json.dumps(self.pass_a_schema, indent=2)}"
            
            # Use the new google.genai SDK
            pass_a_response = self.client.models.generate_content(
                model=self.model_name,
                contents=[prompt_with_schema, json.dumps(pass_a_packet)],
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=4000,
                    response_mime_type="application/json",
                )
            )
            pass_a_result = json.loads(pass_a_response.text)
        except Exception as e:
            logger.error(f"Error in Pass A for asset {asset_id}: {e}")
            return None

        # Calculate scores (raw quality, smoothed scores, fingerprint, similarity)
        ohlcv_data_dicts = self._get_ohlcv_data(asset_id, as_of_date, self.chart_analyzer.window_size)
        score_data = self._calculate_scores(asset_id, as_of_date, ohlcv_data_dicts, pass_a_result)

        # Pass B: Reconciliation (optional)
        pass_b_result = {}
        if run_pass_b:
            pass_b_packet = self._build_pass_b_packet(pass_a_result, asset)
            try:
                # Include schema in the prompt
                prompt_with_schema = f"{self.pass_b_prompt}\n\nYou MUST respond with valid JSON matching this schema:\n{json.dumps(self.pass_b_schema, indent=2)}"
                
                # Use the new google.genai SDK
                pass_b_response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=[prompt_with_schema, json.dumps(pass_b_packet)],
                    config=types.GenerateContentConfig(
                        temperature=0.2,
                        max_output_tokens=4000,
                        response_mime_type="application/json",
                    )
                )
                pass_b_result = json.loads(pass_b_response.text)
            except Exception as e:
                logger.error(f"Error in Pass B for asset {asset_id}: {e}")

        # Combine results and save to DB
        final_result = {
            **pass_a_result,
            **pass_b_result,
            **score_data, # Add calculated scores
            "asset_id": asset_id,
            "as_of_date": as_of_date,
            "universe_id": asset["universe_id"],
            "config_id": asset["config_id"],
            "scope": asset["scope"],
            "model": self.model_name,
            "ai_review_version": self.PROMPT_VERSION, # Use new version column
            "input_hash": input_hash,
            "pass_a_packet": json.dumps(pass_a_packet),
            "pass_b_packet": json.dumps(pass_b_packet) if run_pass_b else None,
            "created_at": datetime.utcnow().isoformat(),
            "token_usage": None  # Skip usage metadata to avoid serialization issues
        }
        
        self._save_review(final_result)
        return final_result

    def _save_review(self, result: Dict[str, Any]) -> None:
        """Saves the AI review to the database."""
        # Map result keys to DB columns
        db_record = {
            "asset_id": str(result["asset_id"]),  # asset_id is text in the table
            "as_of_date": result["as_of_date"],
            "prompt_version": result["ai_review_version"],  # Primary key column
            "universe_id": result["universe_id"],
            "config_id": result["config_id"],
            "scope": result["scope"],
            "source_scope": result["scope"],  # Required column
            "ai_review_version": result["ai_review_version"], # New column
            "model": result["model"],
            "input_hash": result["input_hash"],
            "review_json": json.dumps({
                "ai_direction_score": result.get("ai_direction_score"),
                "subscores": result.get("subscores"),
                "attention_level": result.get("attention_level"),
                "setup_type": result.get("setup_type"),
                "time_horizon": result.get("time_horizon"),
                "confidence": result.get("confidence"),
                "summary_text": result.get("summary_text"),
                "key_levels": result.get("key_levels"),
                "entry_zone": result.get("entry_zone"),
                "targets": result.get("targets"),
                "why_now": result.get("why_now"),
                "risks_and_contradictions": result.get("risks_and_contradictions"),
                "what_to_watch_next": result.get("what_to_watch_next"),
            }),
            
            # New columns
            "fingerprint": result.get("fingerprint"),
            "similarity_to_prev": result.get("similarity_to_prev"),
            "raw_ai_setup_quality_score": result.get("raw_ai_setup_quality_score"),
            "smoothed_ai_setup_quality_score": result.get("smoothed_ai_setup_quality_score"),
            "raw_ai_direction_score": result.get("raw_ai_direction_score"),
            "smoothed_ai_direction_score": result.get("smoothed_ai_direction_score"),
            "subscores": json.dumps(result.get("subscores")),
            
            # Existing columns
            "ai_direction_score": result.get("smoothed_ai_direction_score"), # Store smoothed score in old column for compatibility
            "ai_setup_quality_score": result.get("smoothed_ai_setup_quality_score"), # Store smoothed score in old column for compatibility
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
            # Don't store raw_response to avoid serialization issues with non-JSON objects
        }
        
        # Build the INSERT ON CONFLICT statement
        columns = list(db_record.keys())
        placeholders = ', '.join(['%s'] * len(columns))
        column_names = ', '.join(columns)
        update_clause = ', '.join([f"{col} = EXCLUDED.{col}" for col in columns if col not in ['asset_id', 'as_of_date', 'ai_review_version']])
        
        # Use the primary key columns for ON CONFLICT (asset_id, as_of_date, prompt_version)
        update_clause = ', '.join([f"{col} = EXCLUDED.{col}" for col in columns if col not in ['asset_id', 'as_of_date', 'prompt_version']])
        
        query = f"""
        INSERT INTO asset_ai_reviews ({column_names})
        VALUES ({placeholders})
        ON CONFLICT (asset_id, as_of_date, prompt_version)
        DO UPDATE SET {update_clause}, updated_at = NOW()
        """
        
        values = [db_record[col] for col in columns]
        self.db.execute(query, tuple(values))
        logger.info(f"Saved AI review for asset {result['asset_id']} with version {result['ai_review_version']}")

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
