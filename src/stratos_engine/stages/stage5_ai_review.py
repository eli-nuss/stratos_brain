"""Stage 5: AI Chart Review - LLM-powered chart analysis for dashboard assets."""

import json
import hashlib
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

from openai import OpenAI

from ..config import config
from ..db import Database

logger = logging.getLogger(__name__)

# Load prompts
PROMPT_DIR = Path(__file__).parent.parent / "prompts"


class Stage5AIReview:
    """Stage 5: AI-powered chart review for dashboard-surfaced assets."""
    
    PROMPT_VERSION = "v2_chart_review"
    SCOPES = ["inflections_bullish", "inflections_bearish", "trends", "risk"]
    LOOKBACK_BARS = 60  # Number of OHLCV bars to include (reduced for token efficiency)
    
    def __init__(self, db: Database, client: Optional[OpenAI] = None):
        self.db = db
        self.client = client or OpenAI(
            api_key=config.openai.api_key,
            base_url=config.openai.base_url,
        )
        self.model = config.openai.model
        self._load_prompts()
    
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
why_now (array), key_levels (object with support, resistance, invalidation), 
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
        asset_id: str, 
        as_of_date: str, 
        config_id: str,
        universe_id: str,
        scope: str,
        score_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Build the complete chart packet for LLM analysis.
        Includes OHLCV bars, features, signals, and scores.
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
            "signal_instances": [],
            "scores": {
                "weighted_score": score_data.get("weighted_score"),
                "score_delta": score_data.get("score_delta"),
                "new_signal_count": score_data.get("new_signal_count"),
                "inflection_score": score_data.get("inflection_score"),
                "components": score_data.get("components"),
            }
        }
        
        # 1. Get OHLCV bars (last 200 days)
        ohlcv_query = """
        SELECT date, open, high, low, close, volume
        FROM daily_bars
        WHERE asset_id = %s AND date <= %s
        ORDER BY date DESC
        LIMIT %s
        """
        bars = self.db.fetch_all(ohlcv_query, (asset_id, as_of_date, self.LOOKBACK_BARS))
        # Reverse to chronological order
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
        
        # 2. Get daily features for as_of_date
        features_query = """
        SELECT *
        FROM daily_features
        WHERE asset_id = %s AND date = %s
        """
        features = self.db.fetch_one(features_query, (asset_id, as_of_date))
        if features:
            # Include key features (not all to save tokens)
            key_features = [
                "close", "dollar_volume_sma_20", "rs_vs_benchmark",
                "atr_pct", "bb_width", "rsi_14", "macd_histogram",
                "sma_20", "sma_50", "sma_200", "ema_21",
                "squeeze_on", "squeeze_pctile", "coverage_252"
            ]
            packet["features"] = {
                k: float(v) if v is not None and k in key_features else v
                for k, v in features.items()
                if k in key_features and v is not None
            }
        
        # 3. Get signal facts for today
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
        
        # 4. Get signal instance states
        instances_query = """
        SELECT signal_type, direction, state, triggered_at, last_seen_at
        FROM signal_instances
        WHERE asset_id = %s AND config_id = %s::uuid AND state IN ('new', 'active')
        """
        instances = self.db.fetch_all(instances_query, (asset_id, config_id))
        packet["signal_instances"] = [
            {
                "signal_type": i["signal_type"],
                "direction": i["direction"],
                "state": i["state"],
                "triggered_at": str(i["triggered_at"]) if i["triggered_at"] else None,
                "last_seen_at": str(i["last_seen_at"]) if i["last_seen_at"] else None,
            }
            for i in instances
        ]
        
        return packet

    def _compute_input_hash(self, packet: Dict[str, Any]) -> str:
        """
        Compute hash of input data for caching/idempotency.
        Hash includes: OHLCV closes, signal facts, scores, scope, prompt version.
        """
        hash_data = {
            "closes": [b["close"] for b in packet["ohlcv"][-50:]],  # Last 50 closes
            "volumes": [b["volume"] for b in packet["ohlcv"][-10:]],  # Last 10 volumes
            "signal_facts": [(f["signal_type"], f["strength"]) for f in packet["signal_facts"]],
            "scores": packet["scores"],
            "scope": packet["context"]["scope"],
            "prompt_version": self.PROMPT_VERSION,
        }
        data_str = json.dumps(hash_data, sort_keys=True, default=str)
        return hashlib.md5(data_str.encode()).hexdigest()

    def _call_llm(self, packet: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Call the LLM (Gemini 3 Flash) to generate chart review.
        Returns parsed JSON response or None on failure.
        """
        try:
            # Prepare user message with chart packet
            user_content = json.dumps(packet, default=str)
            
            # Add schema hint to system prompt
            schema_hint = f"\n\nOutput JSON schema:\n{json.dumps(self.output_schema, indent=2)}"
            full_system_prompt = self.system_prompt + schema_hint
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": full_system_prompt},
                    {"role": "user", "content": user_content}
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
                max_tokens=1500,
            )
            
            content = response.choices[0].message.content
            result = json.loads(content)
            
            # Add token usage
            tokens_in = response.usage.prompt_tokens if response.usage else 0
            tokens_out = response.usage.completion_tokens if response.usage else 0
            result["_tokens_in"] = tokens_in
            result["_tokens_out"] = tokens_out
            
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error from LLM: {e}")
            # Retry with explicit JSON instruction
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": full_system_prompt},
                        {"role": "user", "content": user_content + "\n\nReturn ONLY valid JSON."}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.1,
                    max_tokens=1500,
                )
                content = response.choices[0].message.content
                result = json.loads(content)
                result["_tokens_in"] = response.usage.prompt_tokens if response.usage else 0
                result["_tokens_out"] = response.usage.completion_tokens if response.usage else 0
                return result
            except Exception as retry_e:
                logger.error(f"Retry also failed: {retry_e}")
                return None
                
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            return None

    def _store_review(
        self,
        asset_id: str,
        as_of_date: str,
        universe_id: str,
        config_id: str,
        scope: str,
        input_hash: str,
        review: Dict[str, Any]
    ) -> bool:
        """Store the AI review in the database."""
        try:
            # Extract denormalized fields
            attention_level = review.get("attention_level")
            direction = review.get("direction")
            setup_type = review.get("setup_type")
            confidence = review.get("confidence")
            summary_text = review.get("summary_text", "")[:500]  # Truncate if needed
            tokens_in = review.pop("_tokens_in", 0)
            tokens_out = review.pop("_tokens_out", 0)
            
            query = """
            INSERT INTO asset_ai_reviews (
                asset_id, as_of_date, universe_id, config_id, source_scope,
                prompt_version, model, input_hash, review_json, summary_text,
                attention_level, direction, setup_type, confidence,
                tokens_in, tokens_out
            ) VALUES (
                %s, %s, %s, %s::uuid, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s
            )
            ON CONFLICT (asset_id, as_of_date, prompt_version) 
            DO UPDATE SET
                universe_id = EXCLUDED.universe_id,
                config_id = EXCLUDED.config_id,
                source_scope = EXCLUDED.source_scope,
                model = EXCLUDED.model,
                input_hash = EXCLUDED.input_hash,
                review_json = EXCLUDED.review_json,
                summary_text = EXCLUDED.summary_text,
                attention_level = EXCLUDED.attention_level,
                direction = EXCLUDED.direction,
                setup_type = EXCLUDED.setup_type,
                confidence = EXCLUDED.confidence,
                tokens_in = EXCLUDED.tokens_in,
                tokens_out = EXCLUDED.tokens_out,
                updated_at = NOW()
            """
            
            self.db.execute(query, (
                asset_id, as_of_date, universe_id, config_id, scope,
                self.PROMPT_VERSION, self.model, input_hash, json.dumps(review), summary_text,
                attention_level, direction, setup_type, confidence,
                tokens_in, tokens_out
            ))
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to store review for {asset_id}: {e}")
            return False

    def run(
        self,
        as_of_date: str,
        config_id: str,
        universe_id: Optional[str] = None,
        limit_per_scope: int = 25,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Run the Stage 5 AI Chart Review pipeline.
        
        Args:
            as_of_date: Date to run review for
            config_id: Signal configuration ID
            universe_id: Optional universe filter
            limit_per_scope: Max assets per scope to review
            dry_run: If True, don't actually call LLM or store results
        
        Returns:
            Dict with counts: reviewed, reused, failed, total_tokens
        """
        logger.info(f"Starting Stage 5 (AI Chart Review) for {as_of_date}")
        
        # Get target assets from dashboard views
        targets = self._get_target_assets(
            as_of_date=as_of_date,
            universe_id=universe_id,
            config_id=config_id,
            limit_per_scope=limit_per_scope
        )
        
        if not targets:
            logger.info("No target assets found for review")
            return {"reviewed": 0, "reused": 0, "failed": 0, "total_tokens": 0, "targets": 0}
        
        reviewed_count = 0
        reused_count = 0
        failed_count = 0
        total_tokens = 0
        
        for target in targets:
            asset_id = target["asset_id"]
            scope = target["scope"]
            target_universe_id = str(target["universe_id"])
            target_config_id = str(target["config_id"])
            
            # Build chart packet
            packet = self._build_chart_packet(
                asset_id=asset_id,
                as_of_date=as_of_date,
                config_id=target_config_id,
                universe_id=target_universe_id,
                scope=scope,
                score_data=target
            )
            
            # Compute input hash
            input_hash = self._compute_input_hash(packet)
            
            # Check for existing review with same hash (idempotency)
            existing = self.db.fetch_one(
                """SELECT 1 FROM asset_ai_reviews 
                   WHERE asset_id = %s AND as_of_date = %s 
                   AND prompt_version = %s AND input_hash = %s""",
                (asset_id, as_of_date, self.PROMPT_VERSION, input_hash)
            )
            
            if existing:
                logger.debug(f"Reusing existing review for {asset_id} (hash match)")
                reused_count += 1
                continue
            
            if dry_run:
                logger.info(f"[DRY RUN] Would review {target.get('symbol')} ({scope})")
                reviewed_count += 1
                continue
            
            # Call LLM
            logger.info(f"Generating review for {target.get('symbol')} ({scope})")
            review = self._call_llm(packet)
            
            if review is None:
                logger.error(f"Failed to generate review for {asset_id}")
                failed_count += 1
                continue
            
            # Track tokens
            total_tokens += review.get("_tokens_in", 0) + review.get("_tokens_out", 0)
            
            # Store review
            if self._store_review(
                asset_id=asset_id,
                as_of_date=as_of_date,
                universe_id=target_universe_id,
                config_id=target_config_id,
                scope=scope,
                input_hash=input_hash,
                review=review
            ):
                reviewed_count += 1
                logger.info(f"Stored review for {target.get('symbol')}: "
                           f"{review.get('attention_level')} / {review.get('direction')} / "
                           f"confidence={review.get('confidence')}")
            else:
                failed_count += 1
        
        result = {
            "reviewed": reviewed_count,
            "reused": reused_count,
            "failed": failed_count,
            "total_tokens": total_tokens,
            "targets": len(targets)
        }
        
        logger.info(f"Stage 5 complete: {result}")
        return result
