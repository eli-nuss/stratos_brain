"""Stage 5: AI Chart Review - Two-pass LLM-powered chart analysis.

Pass 1: OHLCV-only (365 bars) - Initial read: setup_type, key levels, entry/targets/invalidation
Pass 2: Enriched - Pass 1 output + signals + indicators for final analysis

Uses Gemini 3 Pro Preview as the primary model.
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
    """Stage 5: Two-pass AI-powered chart review for dashboard-surfaced assets.
    
    Pass 1 (OHLCV-only):
    - 365 daily bars of OHLCV data
    - Initial technical read: setup_type, key levels, entry/targets/invalidation
    
    Pass 2 (Enriched):
    - Pass 1 output + OHLCV
    - Signal facts + evidence
    - Curated indicators
    - Final JSON output with all fields
    """
    
    PROMPT_VERSION = "v4_two_pass"
    SCOPES = ["inflections_bullish", "inflections_bearish", "trends", "risk"]
    
    # Lookback settings
    PASS1_BARS = 365  # Full year for Pass 1
    PASS2_BARS = 90   # Last 90 days for Pass 2 (with Pass 1 context)
    
    # Model configuration
    DEFAULT_MODEL = "gemini-3-pro-preview"
    FALLBACK_MODEL = "gemini-3-flash-preview"
    
    # Safety ceiling per scope
    MAX_ASSETS_PER_SCOPE = 500
    
    def __init__(self, db: Database, api_key: Optional[str] = None, model: Optional[str] = None):
        self.db = db
        
        # Configure Gemini API
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not set in environment or provided")
        
        genai.configure(api_key=self.api_key)
        
        # Set model (default to Gemini 3 Pro)
        self.model_name = model or self.DEFAULT_MODEL
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
        """Load system prompts for both passes."""
        # Pass 1: OHLCV-only prompt
        self.pass1_prompt = """You are a technical chart analyst. Analyze the provided OHLCV data (365 daily bars).

Focus on:
1. Price structure and trend
2. Key support/resistance levels
3. Entry zones and price targets
4. Invalidation levels

Output valid JSON with:
{
  "setup_type": "breakout|breakdown|pullback|consolidation|reversal",
  "direction": "bullish|bearish|neutral",
  "time_horizon": "days|weeks|months",
  "key_levels": {
    "support": [array of 2-3 price levels],
    "resistance": [array of 2-3 price levels]
  },
  "entry": {"low": number, "high": number},
  "targets": [array of 2-3 price targets],
  "invalidation": number,
  "initial_read": "2-3 sentence summary of the chart structure"
}"""

        # Pass 2: Enriched prompt
        pass2_path = PROMPT_DIR / "chart_review_system.txt"
        if pass2_path.exists():
            self.pass2_prompt = pass2_path.read_text()
        else:
            self.pass2_prompt = self._default_pass2_prompt()
        
        # Load output schema
        schema_path = PROMPT_DIR / "chart_review_schema.json"
        if schema_path.exists():
            self.output_schema = json.loads(schema_path.read_text())
        else:
            self.output_schema = {}
    
    def _default_pass2_prompt(self) -> str:
        return """You are a chart review analyst. You have already performed an initial OHLCV analysis (Pass 1).
Now incorporate the signal facts and indicators to produce a final analysis.

Output valid JSON with:
- attention_level: URGENT, FOCUS, or IGNORE
- direction: bullish or bearish
- setup_type: breakout, breakdown, pullback, etc.
- time_horizon: days, weeks, or months
- summary_text: concise summary (1-2 sentences)
- why_now: array of 3-7 bullets grounded in the data/signals
- key_levels: {support: [...], resistance: [...]}
- entry: {low: number, high: number}
- targets: [array of price targets]
- invalidation: number
- what_to_watch_next: array of 2-3 items
- risks_and_contradictions: array of 1-3 items
- confidence: 0-1"""

    def _get_flashed_assets(
        self, 
        as_of_date: str, 
        universe_id: Optional[str] = None,
        config_id: Optional[str] = None,
        limit_per_scope: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get "flashed" assets - those that warrant AI review.
        
        Criteria:
        - Inflections: new_signal_count > 0 OR abs(score_delta) >= top 10%
        - Trends: ACTIVE bullish, new_signal_count = 0
        - Risk: bearish conditions / big negative delta
        
        Applies safety ceiling of MAX_ASSETS_PER_SCOPE.
        """
        targets = []
        seen_assets = set()
        
        # Build filter conditions
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
        
        # 1. Inflections Bullish
        query_bullish = f"""
        SELECT 
            asset_id, symbol, name, asset_type, universe_id, config_id,
            weighted_score, score_delta, new_signal_count, inflection_score, components,
            'inflections_bullish' as scope
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
        
        # 2. Inflections Bearish
        query_bearish = f"""
        SELECT 
            asset_id, symbol, name, asset_type, universe_id, config_id,
            weighted_score, score_delta, new_signal_count, inflection_score, components,
            'inflections_bearish' as scope
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
        
        # 3. Risk
        query_risk = f"""
        SELECT 
            asset_id, symbol, name, asset_type, universe_id, config_id,
            weighted_score, score_delta, new_signal_count, inflection_score, components,
            'risk' as scope
        FROM v_dashboard_risk
        WHERE {where_clause}
        ORDER BY weighted_score ASC
        LIMIT %s
        """
        risk = self.db.fetch_all(query_risk, params + [actual_limit])
        for row in risk:
            if row["asset_id"] not in seen_assets:
                targets.append(row)
                seen_assets.add(row["asset_id"])
        
        # 4. Trends
        query_trends = f"""
        SELECT 
            asset_id, symbol, name, asset_type, universe_id, config_id,
            weighted_score, score_delta, new_signal_count, inflection_score, components,
            'trends' as scope
        FROM v_dashboard_trends
        WHERE {where_clause}
        ORDER BY weighted_score DESC
        LIMIT %s
        """
        trends = self.db.fetch_all(query_trends, params + [actual_limit])
        for row in trends:
            if row["asset_id"] not in seen_assets:
                targets.append(row)
                seen_assets.add(row["asset_id"])
        
        logger.info(f"Found {len(targets)} flashed assets for review "
                   f"(bullish: {len([t for t in targets if t['scope'] == 'inflections_bullish'])}, "
                   f"bearish: {len([t for t in targets if t['scope'] == 'inflections_bearish'])}, "
                   f"risk: {len([t for t in targets if t['scope'] == 'risk'])}, "
                   f"trends: {len([t for t in targets if t['scope'] == 'trends'])})")
        
        return targets

    def _build_pass1_packet(
        self, 
        asset_id: int, 
        as_of_date: str,
        symbol: str,
        name: str,
        asset_type: str
    ) -> Dict[str, Any]:
        """Build OHLCV-only packet for Pass 1 (365 bars)."""
        packet = {
            "asset": {
                "symbol": symbol,
                "name": name,
                "asset_type": asset_type,
            },
            "as_of_date": as_of_date,
            "ohlcv": []
        }
        
        # Get 365 days of OHLCV
        ohlcv_query = """
        SELECT date, open, high, low, close, volume
        FROM daily_bars
        WHERE asset_id = %s AND date <= %s
        ORDER BY date DESC
        LIMIT %s
        """
        bars = self.db.fetch_all(ohlcv_query, (asset_id, as_of_date, self.PASS1_BARS))
        bars = list(reversed(bars))
        
        packet["ohlcv"] = [
            {
                "date": str(b["date"]),
                "open": float(b["open"]) if b["open"] else None,
                "high": float(b["high"]) if b["high"] else None,
                "low": float(b["low"]) if b["low"] else None,
                "close": float(b["close"]) if b["close"] else None,
                "volume": float(b["volume"]) if b["volume"] else None,
            }
            for b in bars
        ]
        
        return packet

    def _build_pass2_packet(
        self, 
        asset_id: int, 
        as_of_date: str, 
        config_id: str,
        universe_id: str,
        scope: str,
        score_data: Dict[str, Any],
        pass1_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Build enriched packet for Pass 2."""
        packet = {
            "asset": {
                "asset_id": asset_id,
                "symbol": score_data.get("symbol"),
                "name": score_data.get("name"),
                "asset_type": score_data.get("asset_type"),
            },
            "context": {
                "scope": scope,
                "as_of_date": as_of_date,
                "universe_id": universe_id,
            },
            "pass1_analysis": pass1_result,
            "ohlcv": [],
            "features": {},
            "signal_facts": [],
            "scores": {
                "weighted_score": score_data.get("weighted_score"),
                "score_delta": score_data.get("score_delta"),
                "new_signal_count": score_data.get("new_signal_count"),
                "inflection_score": score_data.get("inflection_score"),
                "components": score_data.get("components"),
            }
        }
        
        # Get 90 days of OHLCV for Pass 2
        ohlcv_query = """
        SELECT date, open, high, low, close, volume
        FROM daily_bars
        WHERE asset_id = %s AND date <= %s
        ORDER BY date DESC
        LIMIT %s
        """
        bars = self.db.fetch_all(ohlcv_query, (asset_id, as_of_date, self.PASS2_BARS))
        bars = list(reversed(bars))
        packet["ohlcv"] = [
            {
                "date": str(b["date"]),
                "open": float(b["open"]) if b["open"] else None,
                "high": float(b["high"]) if b["high"] else None,
                "low": float(b["low"]) if b["low"] else None,
                "close": float(b["close"]) if b["close"] else None,
                "volume": float(b["volume"]) if b["volume"] else None,
            }
            for b in bars
        ]
        
        # Get curated features
        features_query = """
        SELECT *
        FROM daily_features
        WHERE asset_id = %s AND date = %s
        """
        features = self.db.fetch_one(features_query, (asset_id, as_of_date))
        if features:
            # Curated indicator set for chart reading
            curated_features = [
                # Trend regime / MA slopes
                "trend_regime", "ma_slope_20", "ma_slope_50", "ma_slope_200",
                "ma_dist_20", "ma_dist_50", "ma_dist_200",
                # Volatility compression
                "squeeze_on", "squeeze_pctile", "bb_width", "bb_width_pctile",
                # Momentum
                "rsi_14", "roc_20", "roc_63", "macd_histogram",
                # Distance to bands/levels
                "dist_52w_high", "dist_52w_low",
                "donchian_high_20", "donchian_low_20", "donchian_high_55", "donchian_low_55",
                # Dollar volume regime
                "dollar_volume_sma_20", "rvol_20", "volume_z_60",
                # Breakout flags
                "breakout_up_20", "breakout_down_20", "breakout_confirmed_up", "breakout_confirmed_down",
                # Current price
                "close", "open", "high", "low"
            ]
            packet["features"] = {
                k: (float(v) if isinstance(v, (int, float)) and v is not None else v)
                for k, v in features.items()
                if k in curated_features and v is not None
            }
        
        # Get signal facts with evidence
        facts_query = """
        SELECT signal_type, direction, strength, evidence
        FROM daily_signal_facts
        WHERE asset_id = %s AND date = %s AND config_id = %s::uuid
        ORDER BY strength DESC
        LIMIT 10
        """
        facts = self.db.fetch_all(facts_query, (asset_id, as_of_date, config_id))
        packet["signal_facts"] = [
            {
                "signal_type": f["signal_type"],
                "direction": f["direction"],
                "strength": float(f["strength"]) if f["strength"] else None,
                "evidence": f["evidence"] if isinstance(f["evidence"], dict) else {},
            }
            for f in facts
        ]
        
        return packet

    def _compute_input_hash(self, asset_id: Any, as_of_date: str, scope: str) -> str:
        """Compute hash for idempotency check."""
        hash_input = {
            "asset_id": str(asset_id),
            "as_of_date": as_of_date,
            "scope": scope,
            "model": self.model_name,
            "prompt_version": self.PROMPT_VERSION,
        }
        hash_str = json.dumps(hash_input, sort_keys=True)
        return hashlib.sha256(hash_str.encode()).hexdigest()[:16]

    def _call_pass1(self, packet: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Call LLM for Pass 1 (OHLCV-only analysis)."""
        user_content = json.dumps(packet, default=str)
        full_prompt = self.pass1_prompt + "\n\nChart Data:\n" + user_content
        
        try:
            response = self.model.generate_content(full_prompt)
            result = json.loads(response.text)
            return result
        except json.JSONDecodeError as e:
            logger.error(f"Pass 1 JSON parse error: {e}")
            return None
        except Exception as e:
            logger.error(f"Pass 1 LLM call failed: {e}")
            return None

    def _call_pass2(self, packet: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Call LLM for Pass 2 (enriched analysis)."""
        user_content = json.dumps(packet, default=str)
        schema_hint = f"\n\nOutput JSON schema:\n{json.dumps(self.output_schema, indent=2)}"
        full_prompt = self.pass2_prompt + schema_hint + "\n\nChart Data (with Pass 1 analysis):\n" + user_content
        
        try:
            response = self.model.generate_content(full_prompt)
            result = json.loads(response.text)
            
            # Add token metadata
            if hasattr(response, 'usage_metadata'):
                result["_tokens_in"] = response.usage_metadata.prompt_token_count
                result["_tokens_out"] = response.usage_metadata.candidates_token_count
            
            result["_model"] = self.model_name
            return result
        except json.JSONDecodeError as e:
            logger.error(f"Pass 2 JSON parse error: {e}")
            return None
        except Exception as e:
            logger.error(f"Pass 2 LLM call failed: {e}")
            return None

    def _store_review(
        self,
        asset_id: Any,
        as_of_date: str,
        config_id: str,
        scope: str,
        input_hash: str,
        pass1_result: Dict[str, Any],
        final_result: Dict[str, Any]
    ) -> None:
        """Store both Pass 1 and final review in the database."""
        
        # Combine both passes into review_json
        review_json = {
            "pass1": pass1_result,
            "final": final_result
        }
        
        insert_query = """
        INSERT INTO asset_ai_reviews (
            asset_id, as_of_date, config_id, scope, model, prompt_version, input_hash,
            attention_level, direction, setup_type, summary_text, confidence,
            entry, targets, invalidation, support, resistance,
            pass1_review, review_json,
            tokens_in, tokens_out
        ) VALUES (
            %s, %s, %s::uuid, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s,
            %s, %s
        )
        ON CONFLICT (asset_id, as_of_date, input_hash)
        DO UPDATE SET
            attention_level = EXCLUDED.attention_level,
            direction = EXCLUDED.direction,
            setup_type = EXCLUDED.setup_type,
            summary_text = EXCLUDED.summary_text,
            confidence = EXCLUDED.confidence,
            entry = EXCLUDED.entry,
            targets = EXCLUDED.targets,
            invalidation = EXCLUDED.invalidation,
            support = EXCLUDED.support,
            resistance = EXCLUDED.resistance,
            pass1_review = EXCLUDED.pass1_review,
            review_json = EXCLUDED.review_json,
            tokens_in = EXCLUDED.tokens_in,
            tokens_out = EXCLUDED.tokens_out,
            updated_at = NOW()
        """
        
        # Extract key_levels for support/resistance
        key_levels = final_result.get("key_levels", {})
        support = key_levels.get("support", pass1_result.get("key_levels", {}).get("support", []))
        resistance = key_levels.get("resistance", pass1_result.get("key_levels", {}).get("resistance", []))
        
        # Get entry from final or pass1
        entry = final_result.get("entry", pass1_result.get("entry"))
        targets = final_result.get("targets", pass1_result.get("targets"))
        invalidation = final_result.get("invalidation", pass1_result.get("invalidation"))
        
        params = (
            str(asset_id),
            as_of_date,
            config_id,
            scope,
            self.model_name,
            self.PROMPT_VERSION,
            input_hash,
            final_result.get("attention_level"),
            final_result.get("direction"),
            final_result.get("setup_type"),
            final_result.get("summary_text"),
            final_result.get("confidence"),
            json.dumps(entry) if entry else None,
            json.dumps(targets) if targets else None,
            invalidation,
            json.dumps(support) if support else None,
            json.dumps(resistance) if resistance else None,
            json.dumps(pass1_result),
            json.dumps(review_json),
            final_result.get("_tokens_in"),
            final_result.get("_tokens_out"),
        )
        
        self.db.execute(insert_query, params)

    def _check_existing_review(
        self,
        asset_id: Any,
        as_of_date: str,
        config_id: str,
        scope: str
    ) -> bool:
        """Check if a review already exists for this asset/date/scope (idempotent)."""
        query = """
        SELECT 1 FROM asset_ai_reviews
        WHERE asset_id = %s AND as_of_date = %s AND config_id = %s::uuid AND scope = %s
        """
        result = self.db.fetch_one(query, (str(asset_id), as_of_date, config_id, scope))
        return result is not None

    def process_single_asset(
        self,
        target: Dict[str, Any],
        as_of_date: str,
        config_id: str,
        skip_existing: bool = True
    ) -> Dict[str, Any]:
        """Process a single asset review (for parallel execution)."""
        asset_id = target["asset_id"]
        symbol = target["symbol"]
        scope = target["scope"]
        
        result = {
            "symbol": symbol,
            "scope": scope,
            "status": "failed",
            "details": None
        }
        
        try:
            # Check for existing review (idempotent)
            if skip_existing and self._check_existing_review(
                asset_id, as_of_date, config_id, scope
            ):
                logger.info(f"  Skipping {symbol} - review exists")
                result["status"] = "skipped"
                return result
            
            # Compute input hash
            input_hash = self._compute_input_hash(asset_id, as_of_date, scope)
            
            # PASS 1: OHLCV-only analysis
            pass1_packet = self._build_pass1_packet(
                asset_id=int(asset_id) if isinstance(asset_id, str) else asset_id,
                as_of_date=as_of_date,
                symbol=symbol,
                name=target.get("name"),
                asset_type=target.get("asset_type")
            )
            
            pass1_result = self._call_pass1(pass1_packet)
            if not pass1_result:
                logger.warning(f"  ✗ {symbol}: Pass 1 failed")
                return result
            
            # PASS 2: Enriched analysis
            pass2_packet = self._build_pass2_packet(
                asset_id=int(asset_id) if isinstance(asset_id, str) else asset_id,
                as_of_date=as_of_date,
                config_id=config_id,
                universe_id=str(target.get("universe_id", "")),
                scope=scope,
                score_data=target,
                pass1_result=pass1_result
            )
            
            final_result = self._call_pass2(pass2_packet)
            if not final_result:
                logger.warning(f"  ✗ {symbol}: Pass 2 failed")
                return result
            
            # Store review
            self._store_review(
                asset_id=asset_id,
                as_of_date=as_of_date,
                config_id=config_id,
                scope=scope,
                input_hash=input_hash,
                pass1_result=pass1_result,
                final_result=final_result
            )
            
            result["status"] = "processed"
            result["details"] = {
                "attention_level": final_result.get("attention_level"),
                "direction": final_result.get("direction"),
                "confidence": final_result.get("confidence"),
                "setup_type": final_result.get("setup_type"),
            }
            
            logger.info(f"  ✓ {symbol}: {final_result.get('attention_level')} / "
                       f"{final_result.get('direction')} / conf={final_result.get('confidence')}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing {symbol}: {e}")
            return result

    def run(
        self,
        as_of_date: str,
        config_id: str,
        universe_id: Optional[str] = None,
        limit_per_scope: int = 100,
        skip_existing: bool = True
    ) -> Dict[str, Any]:
        """
        Run two-pass AI reviews for all flashed assets.
        
        Args:
            as_of_date: Date to run reviews for
            config_id: Signal configuration ID
            universe_id: Optional universe filter
            limit_per_scope: Max assets per scope
            skip_existing: Skip if review exists for this asset/date/scope
            
        Returns:
            Summary of reviews processed
        """
        logger.info(f"Starting Stage 5 Two-Pass AI Review for {as_of_date}")
        
        # Get flashed assets
        targets = self._get_flashed_assets(
            as_of_date=as_of_date,
            universe_id=universe_id,
            config_id=config_id,
            limit_per_scope=limit_per_scope
        )
        
        results = {
            "as_of_date": as_of_date,
            "config_id": config_id,
            "model": self.model_name,
            "total_targets": len(targets),
            "processed": 0,
            "skipped": 0,
            "failed": 0,
            "reviews": []
        }
        
        for target in targets:
            logger.info(f"Processing {target['symbol']} ({target['scope']})")
            res = self.process_single_asset(target, as_of_date, config_id, skip_existing)
            
            if res["status"] == "processed":
                results["processed"] += 1
                results["reviews"].append(res["details"])
            elif res["status"] == "skipped":
                results["skipped"] += 1
            else:
                results["failed"] += 1
        
        logger.info(f"Stage 5 complete: {results['processed']} processed, "
                   f"{results['skipped']} skipped, {results['failed']} failed")
        
        return results


def run_stage5(
    as_of_date: str,
    config_id: str,
    universe_id: Optional[str] = None,
    limit_per_scope: int = 100,
    model: Optional[str] = None
) -> Dict[str, Any]:
    """Convenience function to run Stage 5 Two-Pass AI Review."""
    
    db = Database()
    try:
        stage5 = Stage5AIReview(db=db, model=model)
        return stage5.run(
            as_of_date=as_of_date,
            config_id=config_id,
            universe_id=universe_id,
            limit_per_scope=limit_per_scope
        )
    finally:
        db.close()
