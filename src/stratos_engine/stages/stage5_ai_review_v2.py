"""Stage 5 v2: AI Chart Review - Simplified without Stage 4 dependency.

This version processes:
- ALL crypto assets (no filtering)
- Top 500 equity assets by dollar volume

No dependency on daily_asset_scores table.
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


class Stage5AIReviewV2:
    """Stage 5 v2: AI-powered chart review without Stage 4 dependency."""
    
    PROMPT_VERSION = AI_REVIEW_VERSION
    
    # Lookback settings
    PASS1_BARS = 365  # Full year for analysis
    
    # Model configuration
    DEFAULT_MODEL = "gemini-3-flash"
    FALLBACK_MODEL = "gemini-2.5-pro"
    
    # Asset limits
    EQUITY_LIMIT = 500  # Top 500 equities by volume
    
    # Smoothing configuration
    SIMILARITY_THRESHOLD = 0.98
    QUALITY_CLAMP = 10.0
    DIRECTION_CLAMP = 20.0
    
    def __init__(self, db: Database, api_key: Optional[str] = None, model: Optional[str] = None):
        self.db = db
        self.chart_analyzer = ChartAnalyzer(window_size=60)
        
        # Configure Gemini API
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not set in environment or provided")
        
        self.client = genai.Client(api_key=self.api_key)
        self.model_name = model or os.environ.get("GEMINI_MODEL") or self.DEFAULT_MODEL
        
        self._load_prompts()
        logger.info(f"Stage5AIReviewV2 initialized with model: {self.model_name}, version: {self.PROMPT_VERSION}")
    
    def _load_prompts(self) -> None:
        """Load system prompts and schemas."""
        self.pass_a_prompt = (PROMPT_DIR / "ai_score_system.txt").read_text()
        self.pass_a_schema = json.loads((PROMPT_DIR / "ai_score_schema.json").read_text())

    def _get_assets_to_review(self, as_of_date: str, asset_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get assets to review based on new simplified logic:
        - Crypto: ALL active assets with data for the date
        - Equity: Top 500 by dollar volume with data for the date
        """
        targets = []
        
        if asset_type is None or asset_type == 'crypto':
            # Get ALL crypto assets with data for the date
            crypto_query = """
            SELECT DISTINCT 
                a.asset_id, 
                a.symbol, 
                a.name, 
                a.asset_type,
                df.dollar_volume_sma_20
            FROM assets a
            JOIN daily_bars db ON a.asset_id = db.asset_id
            LEFT JOIN daily_features df ON a.asset_id = df.asset_id AND df.date = %s
            WHERE a.asset_type = 'crypto'
              AND a.is_active = true
              AND db.date = %s
            ORDER BY a.symbol
            """
            crypto_assets = self.db.fetch_all(crypto_query, (as_of_date, as_of_date))
            for row in crypto_assets:
                row_dict = dict(row)
                row_dict['scope'] = 'crypto_all'
                targets.append(row_dict)
            logger.info(f"Found {len(crypto_assets)} crypto assets for review")
        
        if asset_type is None or asset_type == 'equity':
            # Get top 500 equity assets by dollar volume
            equity_query = """
            SELECT 
                a.asset_id, 
                a.symbol, 
                a.name, 
                a.asset_type,
                df.dollar_volume_sma_20
            FROM assets a
            JOIN daily_features df ON a.asset_id = df.asset_id AND df.date = %s
            WHERE a.asset_type = 'equity'
              AND a.is_active = true
              AND df.dollar_volume_sma_20 IS NOT NULL
              AND EXISTS (SELECT 1 FROM daily_bars db WHERE db.asset_id = a.asset_id AND db.date = %s)
            ORDER BY df.dollar_volume_sma_20 DESC
            LIMIT %s
            """
            equity_assets = self.db.fetch_all(equity_query, (as_of_date, as_of_date, self.EQUITY_LIMIT))
            for row in equity_assets:
                row_dict = dict(row)
                row_dict['scope'] = 'equity_top500'
                targets.append(row_dict)
            logger.info(f"Found {len(equity_assets)} equity assets for review (top {self.EQUITY_LIMIT} by volume)")
        
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

    def _get_signal_facts(self, asset_id: int, as_of_date: str) -> List[Dict[str, Any]]:
        """Get signal facts from Stage 3 if available."""
        query = """
        SELECT signal_type, direction, strength, weight
        FROM daily_signal_facts
        WHERE asset_id = %s AND date = %s
        ORDER BY strength DESC
        """
        signals = self.db.fetch_all(query, (asset_id, as_of_date))
        return [dict(s) for s in signals] if signals else []

    def _get_features(self, asset_id: int, as_of_date: str) -> Dict[str, Any]:
        """Get calculated features from Stage 2."""
        query = """
        SELECT *
        FROM daily_features
        WHERE asset_id = %s AND date = %s
        """
        row = self.db.fetch_one(query, (asset_id, as_of_date))
        if row:
            # Convert to dict and filter out None values
            features = {k: v for k, v in dict(row).items() if v is not None and k not in ['asset_id', 'date']}
            return features
        return {}

    def _build_pass_a_packet(
        self, 
        asset_id: int, 
        as_of_date: str,
        symbol: str,
        name: str,
        asset_type: str,
        scope: str
    ) -> Dict[str, Any]:
        """Build OHLCV packet for AI analysis."""
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
        
        # Get features from Stage 2
        features = self._get_features(asset_id, as_of_date)
        
        # Get signals from Stage 3 (if available)
        signals = self._get_signal_facts(asset_id, as_of_date)
        
        packet = {
            "asset": {
                "symbol": symbol,
                "name": name,
                "asset_type": asset_type,
            },
            "context": {
                "scope": scope,
                "as_of_date": as_of_date,
            },
            "ohlcv": ohlcv_data,
            "features": features,
            "signals": signals,
        }
        
        return packet

    def _compute_input_hash(self, pass_a_packet: Dict[str, Any]) -> str:
        """Computes a hash of the inputs for idempotency."""
        ohlcv_data = pass_a_packet['ohlcv']
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
        """Calculate raw and smoothed scores."""
        
        # Calculate raw setup quality score from subscores
        subscores = pass_a_result.get("subscores", {})
        total_subscore = sum(subscores.values()) if subscores else 0
        raw_ai_setup_quality_score = total_subscore * 4.0
        
        # Calculate fingerprint
        fingerprint = self.chart_analyzer.calculate_fingerprint(ohlcv_data)
        
        # Get previous day's scores for smoothing
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
            
            prev_review_query = """
            SELECT smoothed_ai_setup_quality_score, smoothed_ai_direction_score, fingerprint
            FROM asset_ai_reviews
            WHERE asset_id = %s::text AND as_of_date = %s
            ORDER BY created_at DESC
            LIMIT 1
            """
            prev_review = self.db.fetch_one(prev_review_query, (str(asset_id), prev_date))
            
            if prev_review:
                prev_smoothed_quality = float(prev_review.get("smoothed_ai_setup_quality_score") or 0)
                prev_smoothed_direction = float(prev_review.get("smoothed_ai_direction_score") or 0)
                prev_fingerprint = prev_review.get("fingerprint")
                
                if prev_fingerprint and fingerprint:
                    similarity_to_prev = self.chart_analyzer.calculate_similarity(fingerprint, prev_fingerprint)
        
        # Raw direction score from AI
        raw_ai_direction_score = float(pass_a_result.get("ai_direction_score", 0))
        
        # Smoothing logic
        if similarity_to_prev >= self.SIMILARITY_THRESHOLD:
            quality_delta = raw_ai_setup_quality_score - prev_smoothed_quality
            direction_delta = raw_ai_direction_score - prev_smoothed_direction
            
            clamped_quality_delta = max(-self.QUALITY_CLAMP, min(self.QUALITY_CLAMP, quality_delta))
            clamped_direction_delta = max(-self.DIRECTION_CLAMP, min(self.DIRECTION_CLAMP, direction_delta))
            
            smoothed_ai_setup_quality_score = prev_smoothed_quality + clamped_quality_delta
            smoothed_ai_direction_score = prev_smoothed_direction + clamped_direction_delta
        else:
            smoothed_ai_setup_quality_score = raw_ai_setup_quality_score
            smoothed_ai_direction_score = raw_ai_direction_score
        
        return {
            "fingerprint": fingerprint,
            "similarity_to_prev": similarity_to_prev,
            "raw_ai_setup_quality_score": raw_ai_setup_quality_score,
            "smoothed_ai_setup_quality_score": smoothed_ai_setup_quality_score,
            "raw_ai_direction_score": raw_ai_direction_score,
            "smoothed_ai_direction_score": smoothed_ai_direction_score,
        }

    def _run_ai_review(self, asset: Dict[str, Any], as_of_date: str) -> Optional[Dict[str, Any]]:
        """Run AI review for a single asset."""
        asset_id = asset["asset_id"]
        symbol = asset["symbol"]
        name = asset["name"]
        asset_type = asset["asset_type"]
        scope = asset["scope"]
        
        # Build packet
        pass_a_packet = self._build_pass_a_packet(
            asset_id, as_of_date, symbol, name, asset_type, scope
        )
        
        if not pass_a_packet["ohlcv"]:
            logger.warning(f"No OHLCV data for {symbol}, skipping")
            return None
        
        # Check for existing review with same input
        input_hash = self._compute_input_hash(pass_a_packet)
        
        existing_query = """
        SELECT review_json FROM asset_ai_reviews
        WHERE asset_id = %s AND as_of_date = %s AND input_hash = %s
        LIMIT 1
        """
        existing = self.db.fetch_one(existing_query, (str(asset_id), as_of_date, input_hash))
        if existing:
            logger.info(f"Reusing existing review for {symbol}")
            return json.loads(existing["review_json"])
        
        # Call AI
        try:
            prompt_with_schema = f"{self.pass_a_prompt}\n\nYou MUST respond with valid JSON matching this schema:\n{json.dumps(self.pass_a_schema, indent=2)}"
            
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[prompt_with_schema, json.dumps(pass_a_packet)],
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=4000,
                    response_mime_type="application/json",
                )
            )
            pass_a_result = json.loads(response.text)
        except Exception as e:
            logger.error(f"Error in AI review for {symbol}: {e}")
            return None

        # Calculate scores
        ohlcv_data_dicts = self._get_ohlcv_data(asset_id, as_of_date, self.chart_analyzer.window_size)
        score_data = self._calculate_scores(asset_id, as_of_date, ohlcv_data_dicts, pass_a_result)

        # Combine results
        final_result = {
            **pass_a_result,
            **score_data,
            "asset_id": asset_id,
            "as_of_date": as_of_date,
            "scope": scope,
            "model": self.model_name,
            "ai_review_version": self.PROMPT_VERSION,
            "input_hash": input_hash,
            "created_at": datetime.utcnow().isoformat(),
        }
        
        self._save_review(final_result)
        return final_result

    def _save_review(self, result: Dict[str, Any]) -> None:
        """Saves the AI review to the database."""
        db_record = {
            "asset_id": str(result["asset_id"]),
            "as_of_date": result["as_of_date"],
            "prompt_version": result["ai_review_version"],
            "source_scope": result["scope"],
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
            }),
            "fingerprint": result.get("fingerprint"),
            "similarity_to_prev": result.get("similarity_to_prev"),
            "raw_ai_setup_quality_score": result.get("raw_ai_setup_quality_score"),
            "smoothed_ai_setup_quality_score": result.get("smoothed_ai_setup_quality_score"),
            "raw_ai_direction_score": result.get("raw_ai_direction_score"),
            "smoothed_ai_direction_score": result.get("smoothed_ai_direction_score"),
            "subscores": json.dumps(result.get("subscores")),
            "ai_direction_score": result.get("smoothed_ai_direction_score"),
            "ai_setup_quality_score": result.get("smoothed_ai_setup_quality_score"),
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
        }
        
        columns = list(db_record.keys())
        placeholders = ', '.join(['%s'] * len(columns))
        column_names = ', '.join(columns)
        update_clause = ', '.join([f"{col} = EXCLUDED.{col}" for col in columns if col not in ['asset_id', 'as_of_date', 'prompt_version']])
        
        query = f"""
        INSERT INTO asset_ai_reviews ({column_names})
        VALUES ({placeholders})
        ON CONFLICT (asset_id, as_of_date, prompt_version)
        DO UPDATE SET {update_clause}, updated_at = NOW()
        """
        
        values = [db_record[col] for col in columns]
        self.db.execute(query, tuple(values))
        logger.debug(f"Saved AI review for asset {result['asset_id']}")

    def run(
        self, 
        as_of_date: str, 
        asset_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Main entry point for Stage 5 v2.
        
        Args:
            as_of_date: Date to run analysis for
            asset_type: Optional filter - 'crypto', 'equity', or None for both
        
        Returns:
            Summary dict with counts
        """
        logger.info(f"Starting Stage5AIReviewV2 for {as_of_date}")
        
        assets_to_review = self._get_assets_to_review(as_of_date, asset_type)
        
        success = 0
        failed = 0
        skipped = 0
        
        for i, asset in enumerate(assets_to_review):
            try:
                result = self._run_ai_review(asset, as_of_date)
                if result:
                    success += 1
                    if (i + 1) % 10 == 0:
                        logger.info(f"Progress: {i+1}/{len(assets_to_review)} ({success} success, {failed} failed)")
                else:
                    skipped += 1
            except Exception as e:
                logger.error(f"Error processing {asset['symbol']}: {e}")
                failed += 1
        
        summary = {
            "total": len(assets_to_review),
            "success": success,
            "failed": failed,
            "skipped": skipped,
        }
        
        logger.info(f"Stage5AIReviewV2 finished: {summary}")
        return summary
