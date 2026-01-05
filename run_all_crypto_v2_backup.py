#!/usr/bin/env python3
"""
Run AI analysis for all crypto assets using parallel processing.
Uses gemini-3-pro-preview model with concurrent API calls for faster execution.

This is the simplified v2 approach:
- No dependency on Stage 4 (daily_asset_scores)
- Processes ALL crypto assets
- Includes features from Stage 2 and signals from Stage 3 as context
"""

import os
import sys
import json
import logging
import asyncio
import aiohttp
from datetime import datetime, date
from concurrent.futures import ThreadPoolExecutor
import threading

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from stratos_engine.db import Database

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
AI_REVIEW_VERSION = "v2.1"
MAX_CONCURRENT_REQUESTS = 10  # Number of parallel API calls
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
MODEL_NAME = "gemini-3-pro-preview"

# Thread-local storage for database connections
thread_local = threading.local()

def get_db():
    """Get thread-local database connection."""
    if not hasattr(thread_local, 'db'):
        thread_local.db = Database()
    return thread_local.db


def get_ohlcv_data(asset_id: int, as_of_date: str) -> list:
    """Fetch OHLCV data for an asset."""
    db = get_db()
    query = """
    SELECT date, open, high, low, close, volume
    FROM daily_bars
    WHERE asset_id = %s AND date <= %s
    ORDER BY date DESC
    LIMIT 60
    """
    bars = db.fetch_all(query, (asset_id, as_of_date))
    return list(reversed(bars)) if bars else []


def get_features(asset_id: int, as_of_date: str) -> dict:
    """Fetch calculated features from daily_features."""
    db = get_db()
    query = """
    SELECT 
        sma_20, sma_50, sma_200,
        ma_dist_20, ma_dist_50, ma_dist_200,
        rsi_14, macd_line, macd_signal, macd_histogram,
        bb_upper, bb_lower, bb_width, bb_pct,
        atr_14, atr_pct,
        realized_vol_20, realized_vol_60,
        return_1d, return_5d, return_21d, return_63d,
        roc_5, roc_10, roc_20,
        rvol_20, volume_z_60,
        squeeze_flag, trend_regime
    FROM daily_features
    WHERE asset_id = %s AND date = %s
    """
    row = db.fetch_one(query, (asset_id, as_of_date))
    if row:
        return {k: float(v) if v is not None and isinstance(v, (int, float)) else v 
                for k, v in dict(row).items() if v is not None}
    return {}


def get_signals(asset_id: int, as_of_date: str) -> list:
    """Fetch signals from daily_signal_facts."""
    db = get_db()
    query = """
    SELECT signal_type, direction, strength, weight
    FROM daily_signal_facts
    WHERE asset_id = %s AND date = %s
    ORDER BY strength DESC
    LIMIT 10
    """
    signals = db.fetch_all(query, (asset_id, as_of_date))
    return [dict(s) for s in signals] if signals else []


def build_prompt(symbol: str, name: str, bars: list, features: dict, signals: list) -> str:
    """Build the analysis prompt for an asset with features and signals context."""
    if not bars:
        return None
    
    current_price = float(bars[-1]['close'])
    
    # Format OHLCV data
    ohlcv_lines = []
    for b in bars:
        ohlcv_lines.append(f"{b['date']},{b['open']},{b['high']},{b['low']},{b['close']},{b['volume']}")
    ohlcv_text = "\n".join(ohlcv_lines)
    
    # Format features
    features_text = ""
    if features:
        features_lines = []
        for k, v in features.items():
            if isinstance(v, float):
                features_lines.append(f"  {k}: {v:.4f}")
            else:
                features_lines.append(f"  {k}: {v}")
        features_text = "\nTECHNICAL INDICATORS:\n" + "\n".join(features_lines)
    
    # Format signals
    signals_text = ""
    if signals:
        signals_lines = []
        for s in signals:
            signals_lines.append(f"  {s['signal_type']}: {s['direction']} (strength: {s['strength']}, weight: {s.get('weight', 1.0)})")
        signals_text = "\nACTIVE SIGNALS:\n" + "\n".join(signals_lines)
    
    prompt = f"""Analyze this cryptocurrency chart and return a JSON assessment.

ASSET: {symbol} ({name})
CURRENT PRICE: {current_price}

OHLCV DATA (Date,Open,High,Low,Close,Volume):
{ohlcv_text}
{features_text}
{signals_text}

Return ONLY a valid JSON object with this exact structure:
{{
  "direction": "bullish" or "bearish" or "neutral",
  "ai_direction_score": integer from -100 to +100,
  "setup_type": "breakout" or "reversal" or "continuation" or "range",
  "attention_level": "URGENT" or "FOCUS" or "WATCH" or "IGNORE",
  "confidence": float from 0.0 to 1.0,
  "summary_text": "5-7 sentence comprehensive technical analysis including: 1) Current price structure and trend context, 2) Recent price action with specific levels, 3) Setup rationale and pattern identification, 4) Key thesis for the trade, 5) Risk definition and invalidation logic. Use specific prices and percentages.",
  "key_levels": {{
    "support": [price1, price2],
    "resistance": [price1, price2],
    "invalidation": price
  }},
  "entry_zone": {{
    "low": price,
    "high": price
  }},
  "targets": [price1, price2, price3],
  "subscores": {{
    "trend_structure": integer 0-5,
    "momentum_alignment": integer 0-5,
    "volatility_regime": integer 0-5,
    "volume_confirmation": integer 0-5,
    "risk_reward_clarity": integer 0-5
  }},
  "why_now": ["reason1", "reason2"],
  "risks": ["risk1", "risk2"]
}}

Return ONLY the JSON object, no additional text or markdown."""

    return prompt


async def call_gemini_api(session: aiohttp.ClientSession, prompt: str) -> dict:
    """Make async API call to Gemini."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent"
    
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
    }
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 8192,
            "responseMimeType": "application/json"
        }
    }
    
    try:
        async with session.post(url, headers=headers, json=payload, timeout=60) as response:
            if response.status == 200:
                data = await response.json()
                if data.get("candidates") and data["candidates"][0].get("content"):
                    parts = data["candidates"][0]["content"].get("parts", [])
                    if parts and parts[0].get("text"):
                        return json.loads(parts[0]["text"])
            else:
                error_text = await response.text()
                logger.warning(f"API error {response.status}: {error_text[:200]}")
    except json.JSONDecodeError as e:
        logger.warning(f"JSON parse error: {e}")
    except asyncio.TimeoutError:
        logger.warning("API timeout")
    except Exception as e:
        logger.warning(f"API error: {e}")
    
    return None


def save_to_database(asset_id: int, as_of_date: str, result: dict) -> bool:
    """Save analysis result to database."""
    db = get_db()
    
    try:
        direction = result.get("direction", "neutral")
        direction_score = result.get("ai_direction_score", 0)
        confidence = result.get("confidence", 0.5)
        summary_text = result.get("summary_text", "")
        setup_type = result.get("setup_type", "")
        attention_level = result.get("attention_level", "WATCH")
        key_levels = result.get("key_levels", {})
        subscores = result.get("subscores", {})
        
        # Calculate quality score from subscores
        if subscores:
            subscore_values = [
                subscores.get("trend_structure", 0),
                subscores.get("momentum_alignment", 0),
                subscores.get("volatility_regime", 0),
                subscores.get("volume_confirmation", 0),
                subscores.get("risk_reward_clarity", 0)
            ]
            quality_score = int(sum(subscore_values) / len(subscore_values) * 20)
        else:
            quality_score = 50
        
        db_record = {
            "asset_id": str(asset_id),
            "as_of_date": as_of_date,
            "prompt_version": AI_REVIEW_VERSION,
            "ai_review_version": 2,
            "model": MODEL_NAME,
            "direction": direction,
            "ai_direction_score": direction_score,
            "ai_setup_quality_score": quality_score,
            "ai_confidence": confidence,
            "ai_summary_text": summary_text[:800] if summary_text else "",
            "ai_setup_type": setup_type,
            "ai_attention_level": attention_level,
            "ai_key_levels": json.dumps(key_levels) if key_levels else None,
            "review_json": json.dumps(result),
            "input_hash": "",
            "created_at": datetime.utcnow().isoformat(),
            "subscores": json.dumps(subscores) if subscores else None,
            "scope": "crypto"
        }
        
        insert_query = """
        INSERT INTO asset_ai_reviews (
            asset_id, as_of_date, prompt_version, ai_review_version, model, direction,
            ai_direction_score, ai_setup_quality_score, ai_confidence, ai_summary_text,
            ai_setup_type, ai_attention_level, ai_key_levels, review_json,
            input_hash, created_at, subscores, scope
        ) VALUES (
            %(asset_id)s, %(as_of_date)s, %(prompt_version)s, %(ai_review_version)s, %(model)s, %(direction)s,
            %(ai_direction_score)s, %(ai_setup_quality_score)s, %(ai_confidence)s, %(ai_summary_text)s,
            %(ai_setup_type)s, %(ai_attention_level)s, %(ai_key_levels)s, %(review_json)s,
            %(input_hash)s, %(created_at)s, %(subscores)s, %(scope)s
        )
        ON CONFLICT (asset_id, as_of_date, prompt_version) DO UPDATE SET
            ai_review_version = EXCLUDED.ai_review_version,
            model = EXCLUDED.model,
            direction = EXCLUDED.direction,
            ai_direction_score = EXCLUDED.ai_direction_score,
            ai_setup_quality_score = EXCLUDED.ai_setup_quality_score,
            ai_confidence = EXCLUDED.ai_confidence,
            ai_summary_text = EXCLUDED.ai_summary_text,
            ai_setup_type = EXCLUDED.ai_setup_type,
            ai_attention_level = EXCLUDED.ai_attention_level,
            ai_key_levels = EXCLUDED.ai_key_levels,
            review_json = EXCLUDED.review_json,
            created_at = EXCLUDED.created_at,
            subscores = EXCLUDED.subscores
        """
        db.execute(insert_query, db_record)
        return True
    except Exception as e:
        logger.error(f"Database error: {e}")
        return False


async def process_asset(session: aiohttp.ClientSession, semaphore: asyncio.Semaphore, 
                        asset: dict, as_of_date: str, progress: dict) -> dict:
    """Process a single asset with rate limiting."""
    asset_id = asset['asset_id']
    symbol = asset['symbol']
    name = asset['name']
    
    async with semaphore:
        try:
            # Get OHLCV data (run in thread pool to avoid blocking)
            loop = asyncio.get_event_loop()
            bars = await loop.run_in_executor(None, get_ohlcv_data, asset_id, as_of_date)
            
            if not bars:
                progress['skipped'] += 1
                return {'symbol': symbol, 'status': 'skipped', 'reason': 'no data'}
            
            # Get features and signals
            features = await loop.run_in_executor(None, get_features, asset_id, as_of_date)
            signals = await loop.run_in_executor(None, get_signals, asset_id, as_of_date)
            
            # Build prompt with features and signals
            prompt = build_prompt(symbol, name, bars, features, signals)
            if not prompt:
                progress['skipped'] += 1
                return {'symbol': symbol, 'status': 'skipped', 'reason': 'no prompt'}
            
            # Call API with retries
            result = None
            for attempt in range(3):
                result = await call_gemini_api(session, prompt)
                if result:
                    break
                await asyncio.sleep(1)
            
            if not result:
                progress['failed'] += 1
                return {'symbol': symbol, 'status': 'failed', 'reason': 'api error'}
            
            # Save to database (run in thread pool)
            success = await loop.run_in_executor(None, save_to_database, asset_id, as_of_date, result)
            
            if success:
                progress['success'] += 1
                direction = result.get('direction', 'unknown')
                score = result.get('ai_direction_score', 0)
                logger.info(f"  [{progress['success']}/{progress['total']}] {symbol}: {direction} | Score: {score}")
                return {'symbol': symbol, 'status': 'success', 'direction': direction, 'score': score}
            else:
                progress['failed'] += 1
                return {'symbol': symbol, 'status': 'failed', 'reason': 'db error'}
                
        except Exception as e:
            progress['failed'] += 1
            logger.error(f"Error processing {symbol}: {e}")
            return {'symbol': symbol, 'status': 'error', 'reason': str(e)}


async def main():
    """Main async entry point."""
    if not GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY environment variable not set")
        sys.exit(1)
    
    # Get database connection for initial query
    db = Database()
    
    # Determine date
    as_of_date = str(date.today())
    logger.info(f"Using date: {as_of_date}")
    logger.info(f"Using model: {MODEL_NAME}")
    logger.info(f"Max concurrent requests: {MAX_CONCURRENT_REQUESTS}")
    
    # Get all crypto assets with data for the date (no Stage 4 dependency)
    query = """
    SELECT DISTINCT a.asset_id, a.symbol, a.name
    FROM assets a
    JOIN daily_bars db ON a.asset_id = db.asset_id
    WHERE a.asset_type = 'crypto'
      AND a.is_active = true
      AND db.date = %s
    ORDER BY a.symbol
    """
    assets = db.fetch_all(query, (as_of_date,))
    
    if not assets:
        logger.error("No crypto assets found")
        db.close()
        sys.exit(1)
    
    logger.info(f"Found {len(assets)} crypto assets to process")
    db.close()
    
    # Progress tracking
    progress = {
        'total': len(assets),
        'success': 0,
        'failed': 0,
        'skipped': 0
    }
    
    # Create semaphore for rate limiting
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    
    # Create aiohttp session
    connector = aiohttp.TCPConnector(limit=MAX_CONCURRENT_REQUESTS)
    async with aiohttp.ClientSession(connector=connector) as session:
        # Create tasks for all assets
        tasks = [
            process_asset(session, semaphore, asset, as_of_date, progress)
            for asset in assets
        ]
        
        # Run all tasks concurrently
        start_time = datetime.now()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        end_time = datetime.now()
    
    # Summary
    duration = (end_time - start_time).total_seconds()
    logger.info(f"\n{'='*50}")
    logger.info(f"COMPLETED in {duration:.1f} seconds ({duration/60:.1f} minutes)")
    logger.info(f"Success: {progress['success']}")
    logger.info(f"Failed: {progress['failed']}")
    logger.info(f"Skipped: {progress['skipped']}")
    logger.info(f"Rate: {progress['success']/duration*60:.1f} assets/minute")
    logger.info(f"{'='*50}")


if __name__ == "__main__":
    asyncio.run(main())
