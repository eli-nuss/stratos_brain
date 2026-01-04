"""Stage 5: AI Chart Review - LLM-powered chart analysis for dashboard assets.

Uses Gemini 3 Pro Preview as the primary model for highest confidence and urgency detection.
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
    """Stage 5: AI-powered chart review for dashboard-surfaced assets.
    
    Uses Gemini 3 Pro Preview for primary analysis:
    - Highest confidence calibration (avg 0.89)
    - Best urgency detection (60% URGENT signals)
    - Richest contextual analysis
    """
    
    PROMPT_VERSION = "v3_gemini_pro"
    SCOPES = ["inflections_bullish", "inflections_bearish", "trends", "risk"]
    LOOKBACK_BARS = 45  # Optimized for Gemini token limits
    
    # Model configuration
    DEFAULT_MODEL = "gemini-3-pro-preview"
    FALLBACK_MODEL = "gemini-3-flash-preview"
    
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
        """Load system prompt and output schema."""
        system_prompt_path = PROMPT_DIR / "chart_review_system.txt"
        schema_path = PROMPT_DIR / "chart_review_schema.json"
        
        if system_prompt_path.exists():
            self.system_prompt = system_prompt_path.read_text()
        else:
            logger.warning("Chart review system prompt not found, using default")
            self.system_prompt = self._default_system_prompt()
        
        if schema_path.exists():
            self.output_schema = json.loads(schema_path.read_text())
        else:
            logger.warning("Chart review schema not found, using default")
            self.output_schema = {}
    
    def _default_system_prompt(self) -> str:
        return """You are a chart review analyst. Analyze the provided OHLCV data and signals.
Output valid JSON with: attention_level, direction, setup_type, time_horizon, summary_text,
why_now (array of 3-7 bullets grounded in data), key_levels (object with support, resistance, invalidation), 
what_to_watch_next (array), risks_and_contradictions (array), confidence (0-1)."""

    def _get_target_assets(
        self, 
        as_of_date: str, 
        universe_id: Optional[str] = None,
        config_id: Optional[str] = None,
        limit_per_scope: int = 25
    ) -> List[Dict[str, Any]]:
        """
        Select assets from dashboard views for review.
        Pulls from inflections (bullish/bearish), trends, and risk views.
        Deduplicates: if same asset appears in multiple scopes, prioritize inflections > risk > trends.
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
        
        # 1. Inflections Bullish (highest priority)
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
        bullish = self.db.fetch_all(query_bullish, params + [limit_per_scope])
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
        bearish = self.db.fetch_all(query_bearish, params + [limit_per_scope])
        for row in bearish:
            if row["asset_id"] not in seen_assets:
                targets.append(row)
                seen_assets.add(row["asset_id"])
        
        # 3. Risk (second priority)
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
        risk = self.db.fetch_all(query_risk, params + [limit_per_scope])
        for row in risk:
            if row["asset_id"] not in seen_assets:
                targets.append(row)
                seen_assets.add(row["asset_id"])
        
        # 4. Trends (lowest priority - established, less urgent)
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
        trends = self.db.fetch_all(query_trends, params + [limit_per_scope])
        for row in trends:
            if row["asset_id"] not in seen_assets:
                targets.append(row)
                seen_assets.add(row["asset_id"])
        
        logger.info(f"Found {len(targets)} target assets for review "
                   f"(bullish: {len([t for t in targets if t['scope'] == 'inflections_bullish'])}, "
                   f"bearish: {len([t for t in targets if t['scope'] == 'inflections_bearish'])}, "
                   f"risk: {len([t for t in targets if t['scope'] == 'risk'])}, "
                   f"trends: {len([t for t in targets if t['scope'] == 'trends'])})")
        
        return targets

    def _build_chart_packet(
        self, 
        asset_id: int, 
        as_of_date: str, 
        config_id: str,
        universe_id: str,
        scope: str,
        score_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Build the complete chart packet for LLM analysis.
        Includes OHLCV bars, features, signals, and scores.
        Enhanced with more features for better context.
        """
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
        
        # 1. Get OHLCV bars
        ohlcv_query = """
        SELECT date, open, high, low, close, volume
        FROM daily_bars
        WHERE asset_id = %s AND date <= %s
        ORDER BY date DESC
        LIMIT %s
        """
        bars = self.db.fetch_all(ohlcv_query, (asset_id, as_of_date, self.LOOKBACK_BARS))
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
        
        # 2. Get daily features (enhanced set)
        features_query = """
        SELECT *
        FROM daily_features
        WHERE asset_id = %s AND date = %s
        """
        features = self.db.fetch_one(features_query, (asset_id, as_of_date))
        if features:
            # Enhanced feature set for better context
            key_features = [
                # Price
                "close", "open", "high", "low",
                # Moving averages
                "sma_20", "sma_50", "sma_200", "ema_21",
                # MA distances
                "ma_dist_20", "ma_dist_50", "ma_dist_200",
                # Momentum
                "rsi_14", "macd_histogram", "macd_signal",
                # Volatility
                "atr_pct", "bb_width", "bb_width_pctile", "bb_width_pctile_expanding",
                # Volume
                "dollar_volume_sma_20", "rvol_20", "volume_z_60", "obv_slope_20",
                # Donchian
                "donchian_high_20", "donchian_low_20", "donchian_high_55", "donchian_low_55",
                # Breakout flags
                "breakout_up_20", "breakout_down_20", "breakout_confirmed_up", "breakout_confirmed_down",
                # Squeeze
                "squeeze_on", "squeeze_pctile", "squeeze_fired",
                # Trend
                "rs_vs_benchmark", "trend_regime",
                # Drawdown
                "drawdown_63d", "drawdown_252d",
                # Coverage
                "coverage_252"
            ]
            packet["features"] = {
                k: (float(v) if isinstance(v, (int, float)) and v is not None else v)
                for k, v in features.items()
                if k in key_features and v is not None
            }
        
        # 3. Get signal facts with evidence
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

    def _compute_input_hash(self, packet: Dict[str, Any]) -> str:
        """Compute hash of input packet for caching/deduplication."""
        # Include key fields that affect output
        hash_input = {
            "asset_id": packet["asset"]["asset_id"],
            "as_of_date": packet["context"]["as_of_date"],
            "scope": packet["context"]["scope"],
            "ohlcv_last": packet["ohlcv"][-1] if packet["ohlcv"] else None,
            "signal_count": len(packet["signal_facts"]),
            "model": self.model_name,
            "prompt_version": self.PROMPT_VERSION,
        }
        hash_str = json.dumps(hash_input, sort_keys=True, default=str)
        return hashlib.sha256(hash_str.encode()).hexdigest()[:16]

    def _call_llm(self, packet: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Call Gemini 3 Pro to analyze the chart packet."""
        
        user_content = json.dumps(packet, default=str)
        schema_hint = f"\n\nOutput JSON schema:\n{json.dumps(self.output_schema, indent=2)}"
        full_prompt = self.system_prompt + schema_hint + "\n\nChart Data:\n" + user_content
        
        try:
            response = self.model.generate_content(full_prompt)
            content = response.text
            result = json.loads(content)
            
            # Add metadata
            if hasattr(response, 'usage_metadata'):
                result["_tokens_in"] = response.usage_metadata.prompt_token_count
                result["_tokens_out"] = response.usage_metadata.candidates_token_count
            
            result["_model"] = self.model_name
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}")
            return None
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            return None

    def _store_review(
        self,
        asset_id: int,
        as_of_date: str,
        config_id: str,
        scope: str,
        input_hash: str,
        review: Dict[str, Any]
    ) -> None:
        """Store the AI review in the database."""
        
        insert_query = """
        INSERT INTO asset_ai_reviews (
            asset_id, as_of_date, config_id, scope, model_version, prompt_version, input_hash,
            attention_level, direction, setup_type, time_horizon, summary_text, why_now,
            key_levels, what_to_watch_next, risks_and_contradictions, confidence,
            tokens_in, tokens_out
        ) VALUES (
            %s, %s, %s::uuid, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s
        )
        ON CONFLICT (asset_id, as_of_date, config_id, scope, input_hash)
        DO UPDATE SET
            attention_level = EXCLUDED.attention_level,
            direction = EXCLUDED.direction,
            setup_type = EXCLUDED.setup_type,
            time_horizon = EXCLUDED.time_horizon,
            summary_text = EXCLUDED.summary_text,
            why_now = EXCLUDED.why_now,
            key_levels = EXCLUDED.key_levels,
            what_to_watch_next = EXCLUDED.what_to_watch_next,
            risks_and_contradictions = EXCLUDED.risks_and_contradictions,
            confidence = EXCLUDED.confidence,
            tokens_in = EXCLUDED.tokens_in,
            tokens_out = EXCLUDED.tokens_out,
            reviewed_at = NOW()
        """
        
        params = (
            asset_id,
            as_of_date,
            config_id,
            scope,
            self.model_name,
            self.PROMPT_VERSION,
            input_hash,
            review.get("attention_level"),
            review.get("direction"),
            review.get("setup_type"),
            review.get("time_horizon"),
            review.get("summary_text"),
            json.dumps(review.get("why_now", [])),
            json.dumps(review.get("key_levels", {})),
            json.dumps(review.get("what_to_watch_next", [])),
            json.dumps(review.get("risks_and_contradictions", [])),
            review.get("confidence"),
            review.get("_tokens_in"),
            review.get("_tokens_out"),
        )
        
        self.db.execute(insert_query, params)

    def _check_existing_review(
        self,
        asset_id: int,
        as_of_date: str,
        config_id: str,
        scope: str,
        input_hash: str
    ) -> bool:
        """Check if a review already exists with the same input hash."""
        
        query = """
        SELECT 1 FROM asset_ai_reviews
        WHERE asset_id = %s AND as_of_date = %s AND config_id = %s::uuid 
              AND scope = %s AND input_hash = %s
        """
        result = self.db.fetch_one(query, (asset_id, as_of_date, config_id, scope, input_hash))
        return result is not None

    def run(
        self,
        as_of_date: str,
        config_id: str,
        universe_id: Optional[str] = None,
        limit_per_scope: int = 25,
        skip_existing: bool = True
    ) -> Dict[str, Any]:
        """
        Run AI reviews for all dashboard-surfaced assets.
        
        Args:
            as_of_date: Date to run reviews for
            config_id: Signal configuration ID
            universe_id: Optional universe filter
            limit_per_scope: Max assets per scope
            skip_existing: Skip if review with same input hash exists
            
        Returns:
            Summary of reviews processed
        """
        logger.info(f"Starting Stage 5 AI Review for {as_of_date}")
        
        # Get target assets
        targets = self._get_target_assets(
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
            asset_id = target["asset_id"]
            symbol = target["symbol"]
            scope = target["scope"]
            
            logger.info(f"Processing {symbol} ({scope})")
            
            # Build chart packet
            packet = self._build_chart_packet(
                asset_id=asset_id,
                as_of_date=as_of_date,
                config_id=config_id,
                universe_id=str(target["universe_id"]),
                scope=scope,
                score_data=target
            )
            
            # Compute input hash
            input_hash = self._compute_input_hash(packet)
            
            # Check for existing review
            if skip_existing and self._check_existing_review(
                asset_id, as_of_date, config_id, scope, input_hash
            ):
                logger.info(f"  Skipping {symbol} - review exists with same input hash")
                results["skipped"] += 1
                continue
            
            # Call LLM
            review = self._call_llm(packet)
            
            if review:
                # Store review
                self._store_review(
                    asset_id=asset_id,
                    as_of_date=as_of_date,
                    config_id=config_id,
                    scope=scope,
                    input_hash=input_hash,
                    review=review
                )
                
                results["processed"] += 1
                results["reviews"].append({
                    "symbol": symbol,
                    "scope": scope,
                    "attention_level": review.get("attention_level"),
                    "direction": review.get("direction"),
                    "confidence": review.get("confidence"),
                })
                
                logger.info(f"  ✓ {symbol}: {review.get('attention_level')} / "
                           f"{review.get('direction')} / conf={review.get('confidence')}")
            else:
                results["failed"] += 1
                logger.warning(f"  ✗ {symbol}: LLM call failed")
        
        logger.info(f"Stage 5 complete: {results['processed']} processed, "
                   f"{results['skipped']} skipped, {results['failed']} failed")
        
        return results


def run_stage5(
    as_of_date: str,
    config_id: str,
    universe_id: Optional[str] = None,
    limit_per_scope: int = 25,
    model: Optional[str] = None
) -> Dict[str, Any]:
    """Convenience function to run Stage 5 AI Review."""
    
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
