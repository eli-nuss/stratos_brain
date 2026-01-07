#!/usr/bin/env python3
"""
Run AI analysis for top 500 equities by volume using parallel processing.
Uses gemini-3-pro-preview model with concurrent API calls for faster execution.

VERSION 3: Improved prompting to decouple direction score from quality score.
Based on Gemini recommendations for independent scoring.

Usage:
    python run_all_equities.py --date 2026-01-06
    python run_all_equities.py --date 2026-01-06 --limit 100
    python run_all_equities.py  # defaults to yesterday
"""

import os
import sys
import json
import logging
import asyncio
import aiohttp
import argparse
from datetime import datetime, date, timedelta
from concurrent.futures import ThreadPoolExecutor
import threading
import hashlib

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from dotenv import load_dotenv
load_dotenv()

from stratos_engine.db import Database

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
AI_REVIEW_VERSION = "v3.0"
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


def get_ohlcv_data(asset_id: str, as_of_date: str) -> list:
    """Fetch OHLCV data for an asset."""
    db = get_db()
    query = """
        SELECT date, open, high, low, close, volume
        FROM daily_bars
        WHERE asset_id = %s AND date <= %s
        ORDER BY date DESC
        LIMIT 365
    """
    rows = db.fetch_all(query, (asset_id, as_of_date))
    return list(reversed(rows))


def get_features(asset_id: str, as_of_date: str) -> dict:
    """Fetch technical features for an asset."""
    db = get_db()
    query = """
        SELECT * FROM daily_features
        WHERE asset_id = %s AND date = %s
    """
    row = db.fetch_one(query, (asset_id, as_of_date))
    if row:
        # Convert to regular dict and filter out None values
        return {k: float(v) if isinstance(v, (int, float)) and v is not None else v 
                for k, v in dict(row).items() 
                if v is not None and k not in ['asset_id', 'date', 'created_at', 'updated_at']}
    return {}


def get_top_equities(as_of_date: str, limit: int = 500) -> list:
    """Get top equities by dollar volume."""
    db = get_db()
    query = """
        SELECT a.asset_id, a.symbol, a.name
        FROM daily_features df
        JOIN assets a ON df.asset_id = a.asset_id
        WHERE a.asset_type = 'equity' 
          AND df.date = %s 
          AND a.is_active = true
        ORDER BY df.dollar_volume DESC NULLS LAST
        LIMIT %s
    """
    return db.fetch_all(query, (as_of_date, limit))


def build_prompt(symbol: str, name: str, bars: list, features: dict) -> str:
    """Build the analysis prompt with improved decoupling of direction and quality."""
    if not bars:
        return None
    
    current_price = float(bars[-1]['close'])
    
    # Format OHLCV data (last 60 bars)
    recent_bars = bars[-60:] if len(bars) > 60 else bars
    ohlcv_lines = []
    for b in recent_bars:
        ohlcv_lines.append(f"{b['date']},{b['open']},{b['high']},{b['low']},{b['close']},{b['volume']}")
    ohlcv_text = "\n".join(ohlcv_lines)
    
    # Format features (key ones only)
    features_text = ""
    if features:
        key_features = ['sma_20', 'sma_50', 'sma_200', 'rsi_14', 'macd_line', 'macd_signal',
                       'bb_upper', 'bb_lower', 'atr_14', 'return_1d', 'return_5d', 'return_21d',
                       'ma_dist_20', 'ma_dist_50', 'ma_dist_200', 'rvol_20']
        features_lines = []
        for k in key_features:
            if k in features and features[k] is not None:
                v = features[k]
                if isinstance(v, float):
                    features_lines.append(f"  {k}: {v:.4f}")
                else:
                    features_lines.append(f"  {k}: {v}")
        if features_lines:
            features_text = "\nTECHNICAL INDICATORS:\n" + "\n".join(features_lines)
    
    prompt = f"""You are a professional technical analyst. Analyze this equity chart and return a JSON assessment.

[CRITICAL INDEPENDENCE MANDATE]
You MUST evaluate TWO SEPARATE dimensions:
1. DIRECTION: Where is price likely to go? (bullish/bearish conviction)
2. QUALITY: How clean and tradeable is the chart structure? (INDEPENDENT of direction!)

IMPORTANT RULES:
- A BEARISH asset with a clean breakdown pattern MUST have HIGH quality (80+)
- A BULLISH asset with a messy chart MUST have LOW quality (below 50)
- Quality measures STRUCTURAL CLARITY, not directional conviction
- Quality = How easy is it to define entry, stop-loss, and targets?

ASSET: {symbol} ({name or symbol})
CURRENT PRICE: {current_price}

OHLCV DATA (Date,Open,High,Low,Close,Volume):
{ohlcv_text}
{features_text}

TASK 1 - DIRECTIONAL ANALYSIS:
Evaluate the probability and magnitude of price movement. Score from -100 (max bearish) to +100 (max bullish).

TASK 2 - STRUCTURAL QUALITY (Direction-Agnostic):
Evaluate the chart's structural integrity and tradability. This is INDEPENDENT of direction.
- Boundary Definition: How precisely defined are support/resistance levels?
- Structural Compliance: Does the pattern conform to textbook technical analysis?
- Volatility Profile: Is price action clean or choppy/noisy?
- Volume Coherence: Does volume confirm the pattern?
- Risk-Reward Clarity: How easy is it to place a logical stop-loss?

Return ONLY a valid JSON object with this exact structure:
{{
  "direction": "bullish" or "bearish" or "neutral",
  "ai_direction_score": integer from -100 to +100 (directional conviction only),
  "ai_setup_quality_score": integer from 0 to 100 (structural quality only - INDEPENDENT of direction!),
  "setup_type": "breakout" or "reversal" or "continuation" or "range",
  "attention_level": "URGENT" or "FOCUS" or "WATCH" or "IGNORE",
  "confidence": float from 0.0 to 1.0,
  "summary_text": "5-7 sentence technical analysis. Include: 1) Current trend context, 2) Recent price action with levels, 3) Pattern identification, 4) Trade thesis, 5) Risk definition. Use specific prices.",
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
  "why_now": "1-2 sentences on why this setup is relevant today",
  "risks": ["risk1", "risk2"],
  "what_to_watch": "Key thing to monitor",
  "quality_subscores": {{
    "boundary_definition": 1-5,
    "structural_compliance": 1-5,
    "volatility_profile": 1-5,
    "volume_coherence": 1-5,
    "risk_reward_clarity": 1-5
  }}
}}"""

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


def save_to_database(asset_id: str, as_of_date: str, result: dict) -> bool:
    """Save analysis result to database."""
    db = get_db()
    
    # Extract fields from result
    direction = result.get('direction', 'neutral')
    direction_score = result.get('ai_direction_score', 0)
    quality_score = result.get('ai_setup_quality_score', 50)
    setup_type = result.get('setup_type')
    attention_level = result.get('attention_level')
    confidence = result.get('confidence', 0.5)
    summary = result.get('summary_text', '')
    
    # Extract key_levels as JSON
    key_levels = result.get('key_levels', {})
    ai_key_levels = json.dumps(key_levels) if key_levels else None
    
    # Extract entry zone as JSON
    entry_zone = result.get('entry_zone', {})
    ai_entry = json.dumps(entry_zone) if entry_zone else None
    
    # Extract targets as JSON
    targets = result.get('targets', [])
    ai_targets = json.dumps(targets) if targets else None
    
    # Extract why_now, risks, what_to_watch
    why_now = result.get('why_now', '')
    risks = result.get('risks', [])
    ai_risks = json.dumps(risks) if risks else None
    what_to_watch = result.get('what_to_watch', '')
    
    # Extract quality_subscores
    quality_subscores = result.get('quality_subscores', {})
    subscores_json = json.dumps(quality_subscores) if quality_subscores else None
    
    # Generate input_hash
    input_hash = hashlib.md5(f"{asset_id}_{as_of_date}_{json.dumps(result)[:100]}".encode()).hexdigest()
    
    query = """
    INSERT INTO asset_ai_reviews (
        asset_id, as_of_date, direction, ai_direction_score, ai_setup_quality_score,
        setup_type, ai_attention_level, ai_confidence, ai_summary_text, 
        ai_key_levels, ai_entry, ai_targets, ai_why_now, ai_risks, ai_what_to_watch_next,
        subscores, review_json, model, prompt_version, input_hash, scope, created_at
    ) VALUES (
        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()
    )
    ON CONFLICT (asset_id, as_of_date) DO UPDATE SET
        direction = EXCLUDED.direction,
        ai_direction_score = EXCLUDED.ai_direction_score,
        ai_setup_quality_score = EXCLUDED.ai_setup_quality_score,
        setup_type = EXCLUDED.setup_type,
        ai_attention_level = EXCLUDED.ai_attention_level,
        ai_confidence = EXCLUDED.ai_confidence,
        ai_summary_text = EXCLUDED.ai_summary_text,
        ai_key_levels = EXCLUDED.ai_key_levels,
        ai_entry = EXCLUDED.ai_entry,
        ai_targets = EXCLUDED.ai_targets,
        ai_why_now = EXCLUDED.ai_why_now,
        ai_risks = EXCLUDED.ai_risks,
        ai_what_to_watch_next = EXCLUDED.ai_what_to_watch_next,
        subscores = EXCLUDED.subscores,
        review_json = EXCLUDED.review_json,
        model = EXCLUDED.model,
        prompt_version = EXCLUDED.prompt_version,
        input_hash = EXCLUDED.input_hash,
        updated_at = NOW()
    """
    
    try:
        db.execute(query, (
            asset_id, as_of_date, direction, direction_score, quality_score,
            setup_type, attention_level, confidence, summary,
            ai_key_levels, ai_entry, ai_targets, why_now, ai_risks, what_to_watch,
            subscores_json, json.dumps(result), MODEL_NAME, AI_REVIEW_VERSION, input_hash, "equity_top500"
        ))
        return True
    except Exception as e:
        logger.error(f"Database error for {asset_id}: {e}")
        return False


async def process_asset(session: aiohttp.ClientSession, asset: dict, as_of_date: str, semaphore: asyncio.Semaphore) -> dict:
    """Process a single asset with rate limiting."""
    async with semaphore:
        asset_id = asset['asset_id']
        symbol = asset['symbol']
        name = asset.get('name', symbol)
        
        # Get data (run in thread pool to avoid blocking)
        loop = asyncio.get_event_loop()
        bars = await loop.run_in_executor(None, get_ohlcv_data, asset_id, as_of_date)
        features = await loop.run_in_executor(None, get_features, asset_id, as_of_date)
        
        if len(bars) < 20:
            logger.warning(f"✗ {symbol}: Insufficient data ({len(bars)} bars)")
            return {"success": False, "symbol": symbol, "error": "Insufficient data"}
        
        # Build prompt
        prompt = build_prompt(symbol, name, bars, features)
        if not prompt:
            return {"success": False, "symbol": symbol, "error": "Failed to build prompt"}
        
        # Call API
        result = await call_gemini_api(session, prompt)
        
        if result:
            # Save to database
            saved = await loop.run_in_executor(None, save_to_database, asset_id, as_of_date, result)
            if saved:
                direction_score = result.get('ai_direction_score', 0)
                quality_score = result.get('ai_setup_quality_score', 50)
                direction = result.get('direction', 'neutral')
                logger.info(f"✓ {symbol}: dir={direction_score:+d}, qual={quality_score}, {direction}")
                return {"success": True, "symbol": symbol, "direction_score": direction_score, "quality_score": quality_score}
        
        logger.warning(f"✗ {symbol}: API call failed")
        return {"success": False, "symbol": symbol, "error": "API call failed"}


async def main_async(as_of_date: str, limit: int):
    """Main async function."""
    logger.info("=" * 60)
    logger.info("EQUITY AI ANALYSIS - VERSION 3.0")
    logger.info(f"Date: {as_of_date}")
    logger.info(f"Model: {MODEL_NAME}")
    logger.info(f"Limit: {limit} equities")
    logger.info(f"Concurrency: {MAX_CONCURRENT_REQUESTS} parallel requests")
    logger.info("=" * 60)
    
    # Get top equities
    equities = get_top_equities(as_of_date, limit=limit)
    logger.info(f"Found {len(equities)} equities to analyze")
    
    if not equities:
        logger.warning("No equities found for the specified date. Check if data exists.")
        return
    
    # Create semaphore for rate limiting
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    
    # Process all assets
    successful = 0
    failed = 0
    direction_scores = []
    quality_scores = []
    
    async with aiohttp.ClientSession() as session:
        tasks = [process_asset(session, asset, as_of_date, semaphore) for asset in equities]
        results = await asyncio.gather(*tasks)
        
        for result in results:
            if result["success"]:
                successful += 1
                direction_scores.append(result["direction_score"])
                quality_scores.append(result["quality_score"])
            else:
                failed += 1
    
    logger.info("=" * 60)
    logger.info("SUMMARY")
    logger.info(f"Successful: {successful}")
    logger.info(f"Failed: {failed}")
    logger.info(f"Total: {successful + failed}")
    
    # Calculate correlation
    if len(direction_scores) > 10:
        import numpy as np
        dir_arr = np.array(direction_scores)
        qual_arr = np.array(quality_scores)
        corr = np.corrcoef(dir_arr, qual_arr)[0, 1]
        abs_corr = np.corrcoef(np.abs(dir_arr), qual_arr)[0, 1]
        logger.info(f"Correlation check: dir vs qual = {corr:.3f}, |dir| vs qual = {abs_corr:.3f}")
    
    logger.info("=" * 60)


def main():
    """Entry point with argument parsing."""
    parser = argparse.ArgumentParser(
        description='Run AI analysis for top equities by volume using Gemini v3.0 prompt'
    )
    parser.add_argument(
        '--date', 
        type=str, 
        help='Target date (YYYY-MM-DD). Defaults to yesterday.',
        default=None
    )
    parser.add_argument(
        '--limit', 
        type=int, 
        default=500,
        help='Number of top equities to process (default: 500)'
    )
    parser.add_argument(
        '--model',
        type=str,
        default=MODEL_NAME,
        help=f'Gemini model to use (default: {MODEL_NAME})'
    )
    
    args = parser.parse_args()
    
    # Determine target date
    if args.date:
        as_of_date = args.date
    else:
        as_of_date = (date.today() - timedelta(days=1)).isoformat()
    
    # Update model if specified
    global MODEL_NAME
    MODEL_NAME = args.model
    
    if not GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY not set in environment")
        sys.exit(1)
    
    asyncio.run(main_async(as_of_date, args.limit))


if __name__ == "__main__":
    main()
