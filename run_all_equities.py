#!/usr/bin/env python3
"""
Run AI analysis for operating companies using parallel processing.
Uses gemini-3-flash-preview model with concurrent API calls for faster execution.

VERSION 3.3: Filter by market cap and volume, exclude ETFs/Funds/Trusts/REITs.
- Default: $100M+ market cap, $1M+ daily volume
- Excludes: ETFs, Funds, Trusts (by name pattern), REITs (by industry)
- Resume capability: skips assets already processed for the date
- Increased concurrency to 10 for faster processing
- Auto-detects latest date with features data when no date specified
- Based on Gemini recommendations for independent direction/quality scoring.

Usage:
    python run_all_equities.py --date 2026-01-06
    python run_all_equities.py --date 2026-01-06 --min-market-cap 50000000
    python run_all_equities.py --min-daily-volume 2000000
    python run_all_equities.py  # auto-detects latest date with features data
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
import psycopg2
import psycopg2.extras

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
AI_REVIEW_VERSION = "v3.3"
MAX_CONCURRENT_REQUESTS = 10  # Number of parallel API calls (increased for faster processing)
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
MODEL_NAME = "gemini-3-flash-preview"  # Gemini 3 Flash Preview model

# Thread-local storage for database connections
thread_local = threading.local()

def get_db(force_reconnect=False):
    """Get thread-local database connection with reconnection support."""
    if force_reconnect and hasattr(thread_local, 'db'):
        try:
            thread_local.db.close()
        except:
            pass
        delattr(thread_local, 'db')
    
    if not hasattr(thread_local, 'db'):
        thread_local.db = Database()
    return thread_local.db

def db_execute_with_retry(func, *args, max_retries=3, **kwargs):
    """Execute a database function with retry logic for connection drops."""
    for attempt in range(max_retries):
        try:
            return func(*args, **kwargs)
        except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
            logger.warning(f"Database connection error (attempt {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                get_db(force_reconnect=True)  # Force reconnection
                time.sleep(1)  # Brief pause before retry
            else:
                raise


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


def get_latest_features_date() -> str:
    """
    Get the latest date that has features data in the database.
    Used for auto-detecting the correct date when none is specified.
    """
    db = get_db()
    query = """
        SELECT MAX(date) as latest_date
        FROM daily_features df
        JOIN assets a ON df.asset_id = a.asset_id
        WHERE a.asset_type = 'equity' AND a.is_active = true
    """
    row = db.fetch_one(query)
    if row and row['latest_date']:
        return row['latest_date'].isoformat() if hasattr(row['latest_date'], 'isoformat') else str(row['latest_date'])
    return None


def get_already_processed_assets(as_of_date: str) -> set:
    """
    Get set of asset_ids that have already been processed for the given date.
    Used for resume capability - skip assets that already have AI reviews.
    """
    db = get_db()
    query = """
        SELECT DISTINCT asset_id
        FROM asset_ai_reviews
        WHERE as_of_date = %s
    """
    rows = db.fetch_all(query, (as_of_date,))
    return {row['asset_id'] for row in rows}


def get_operating_companies(as_of_date: str, min_market_cap: float = 100_000_000, min_daily_volume: float = 1_000_000) -> list:
    """
    Get operating companies (excluding ETFs, Funds, Trusts, and REITs).
    
    Filters:
    - Market cap >= $100M (default)
    - Daily dollar volume >= $1M (default)
    - Excludes ETFs, Funds, Trusts by name pattern
    - Excludes REITs by industry
    """
    db = get_db()
    query = """
        SELECT a.asset_id, a.symbol, a.name
        FROM daily_features df
        JOIN assets a ON df.asset_id = a.asset_id
        JOIN equity_metadata em ON a.asset_id = em.asset_id
        WHERE a.asset_type = 'equity' 
          AND df.date = %s 
          AND a.is_active = true
          AND em.market_cap >= %s
          AND df.dollar_volume >= %s
          -- Exclude ETFs, Funds, Trusts by name pattern
          AND NOT (
            a.name ILIKE '%%ETF%%'
            OR a.name ILIKE '%%Fund%%'
            OR a.name ILIKE '%%Trust%%'
            OR a.name ILIKE '%%Index%%'
            OR a.name ILIKE '%%ProShares%%'
            OR a.name ILIKE '%%iShares%%'
            OR a.name ILIKE '%%SPDR%%'
            OR a.name ILIKE '%%Vanguard%%'
            OR a.name ILIKE '%%Invesco%%'
            OR em.industry ILIKE '%%ETF%%'
            OR em.industry ILIKE '%%Fund%%'
          )
          -- Exclude REITs by industry
          AND NOT em.industry ILIKE '%%REIT%%'
        ORDER BY df.dollar_volume DESC NULLS LAST
    """
    return db.fetch_all(query, (as_of_date, min_market_cap, min_daily_volume))


# Keep legacy function for backwards compatibility
def get_top_equities(as_of_date: str, limit: int = 500) -> list:
    """Legacy function - Get top equities by dollar volume (deprecated, use get_operating_companies)."""
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


async def call_gemini_api(session: aiohttp.ClientSession, prompt: str, max_retries: int = 3) -> dict:
    """Make async API call to Gemini with retry logic."""
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
    
    for attempt in range(max_retries):
        try:
            async with session.post(url, headers=headers, json=payload, timeout=90) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("candidates") and data["candidates"][0].get("content"):
                        parts = data["candidates"][0]["content"].get("parts", [])
                        if parts and parts[0].get("text"):
                            return json.loads(parts[0]["text"])
                elif response.status == 429:  # Rate limited
                    wait_time = (attempt + 1) * 5
                    logger.warning(f"Rate limited, waiting {wait_time}s before retry {attempt + 1}/{max_retries}")
                    await asyncio.sleep(wait_time)
                    continue
                elif response.status >= 500:  # Server error
                    wait_time = (attempt + 1) * 2
                    logger.warning(f"Server error {response.status}, waiting {wait_time}s before retry {attempt + 1}/{max_retries}")
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    error_text = await response.text()
                    logger.warning(f"API error {response.status}: {error_text[:200]}")
        except json.JSONDecodeError as e:
            logger.warning(f"JSON parse error: {e}")
        except asyncio.TimeoutError:
            if attempt < max_retries - 1:
                logger.warning(f"API timeout, retry {attempt + 1}/{max_retries}")
                await asyncio.sleep(2)
                continue
            logger.warning("API timeout after all retries")
        except aiohttp.ServerDisconnectedError:
            if attempt < max_retries - 1:
                wait_time = (attempt + 1) * 3
                logger.warning(f"Server disconnected, waiting {wait_time}s before retry {attempt + 1}/{max_retries}")
                await asyncio.sleep(wait_time)
                continue
            logger.warning("Server disconnected after all retries")
        except Exception as e:
            if attempt < max_retries - 1 and "disconnected" in str(e).lower():
                wait_time = (attempt + 1) * 3
                logger.warning(f"Connection error, waiting {wait_time}s before retry {attempt + 1}/{max_retries}")
                await asyncio.sleep(wait_time)
                continue
            logger.warning(f"API error: {e}")
    
    return None


def to_json_safe(value):
    """Convert a value to psycopg2.extras.Json, handling strings and None.
    
    If value is a string, wrap it in a dict with 'text' key.
    If value is already a dict/list, use it directly.
    If value is None or empty, return None.
    """
    if value is None:
        return None
    if isinstance(value, str):
        if not value.strip():
            return None
        # Wrap string in a JSON object
        return psycopg2.extras.Json({"text": value})
    if isinstance(value, (dict, list)):
        if not value:  # Empty dict or list
            return None
        return psycopg2.extras.Json(value)
    # For other types, try to convert
    return psycopg2.extras.Json(value)


def save_to_database(asset_id: str, as_of_date: str, result) -> bool:
    """Save analysis result to database."""
    db = get_db()
    
    # Handle case where result is a list (malformed API response)
    if isinstance(result, list):
        if len(result) > 0 and isinstance(result[0], dict):
            result = result[0]
        else:
            logger.error(f"Invalid result format for {asset_id}: got list with no valid dict")
            return False
    
    if not isinstance(result, dict):
        logger.error(f"Invalid result format for {asset_id}: expected dict, got {type(result).__name__}")
        return False
    
    # Extract fields from result
    direction = result.get('direction', 'neutral')
    direction_score = result.get('ai_direction_score', 0)
    quality_score = result.get('ai_setup_quality_score', 50)
    setup_type = result.get('setup_type')
    attention_level = result.get('attention_level')
    confidence = result.get('confidence', 0.5)
    summary = result.get('summary_text', '')
    
    # Extract key_levels as JSON - use to_json_safe for proper handling
    key_levels = result.get('key_levels')
    ai_key_levels = to_json_safe(key_levels)
    
    # Extract entry zone as JSON
    entry_zone = result.get('entry_zone')
    ai_entry = to_json_safe(entry_zone)
    
    # Extract targets as JSON
    targets = result.get('targets')
    ai_targets = to_json_safe(targets)
    
    # Extract why_now, risks, what_to_watch - ALL are jsonb columns!
    why_now = result.get('why_now')
    ai_why_now = to_json_safe(why_now)
    
    risks = result.get('risks')
    ai_risks = to_json_safe(risks)
    
    what_to_watch = result.get('what_to_watch')
    ai_what_to_watch = to_json_safe(what_to_watch)
    
    # Extract quality_subscores
    quality_subscores = result.get('quality_subscores', {})
    subscores_json = to_json_safe(quality_subscores)
    
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
            ai_key_levels, ai_entry, ai_targets, ai_why_now, ai_risks, ai_what_to_watch,
            subscores_json, psycopg2.extras.Json(result), MODEL_NAME, AI_REVIEW_VERSION, input_hash, "equity_top500"
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
            # Handle list result (extract first element if valid)
            actual_result = result
            if isinstance(result, list):
                if len(result) > 0 and isinstance(result[0], dict):
                    actual_result = result[0]
                else:
                    logger.warning(f"✗ {symbol}: Invalid list response from API")
                    return {"success": False, "symbol": symbol, "error": "Invalid list response"}
            
            # Save to database
            saved = await loop.run_in_executor(None, save_to_database, asset_id, as_of_date, actual_result)
            if saved:
                direction_score = actual_result.get('ai_direction_score', 0) if isinstance(actual_result, dict) else 0
                quality_score = actual_result.get('ai_setup_quality_score', 50) if isinstance(actual_result, dict) else 50
                direction = actual_result.get('direction', 'neutral') if isinstance(actual_result, dict) else 'neutral'
                logger.info(f"✓ {symbol}: dir={direction_score:+d}, qual={quality_score}, {direction}")
                return {"success": True, "symbol": symbol, "direction_score": direction_score, "quality_score": quality_score}
            else:
                logger.warning(f"✗ {symbol}: Database save failed")
                return {"success": False, "symbol": symbol, "error": "Database save failed"}
        
        logger.warning(f"✗ {symbol}: API call failed")
        return {"success": False, "symbol": symbol, "error": "API call failed"}


async def main_async(as_of_date: str, min_market_cap: float = 100_000_000, min_daily_volume: float = 1_000_000):
    """Main async function with resume capability."""
    logger.info("=" * 60)
    logger.info("EQUITY AI ANALYSIS - VERSION 3.3")
    logger.info(f"Date: {as_of_date}")
    logger.info(f"Model: {MODEL_NAME}")
    logger.info(f"Min Market Cap: ${min_market_cap/1e6:.0f}M")
    logger.info(f"Min Daily Volume: ${min_daily_volume/1e6:.0f}M")
    logger.info(f"Filter: Operating companies only (no ETFs, Funds, Trusts, REITs)")
    logger.info(f"Concurrency: {MAX_CONCURRENT_REQUESTS} parallel requests")
    logger.info("=" * 60)
    
    # Get operating companies (filtered by market cap, volume, excluding ETFs/Funds/REITs)
    all_equities = get_operating_companies(as_of_date, min_market_cap=min_market_cap, min_daily_volume=min_daily_volume)
    logger.info(f"Found {len(all_equities)} total operating companies")
    
    if not all_equities:
        logger.warning("No equities found for the specified date. Check if data exists.")
        return
    
    # Resume capability: filter out already processed assets
    already_processed = get_already_processed_assets(as_of_date)
    logger.info(f"Already processed: {len(already_processed)} assets")
    
    # Filter to only unprocessed assets
    equities = [e for e in all_equities if str(e['asset_id']) not in already_processed]
    logger.info(f"Remaining to process: {len(equities)} assets")
    
    if not equities:
        logger.info("All assets already processed for this date. Nothing to do.")
        return
    
    # Create semaphore for rate limiting
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    
    # Process remaining assets
    successful = 0
    failed = 0
    skipped = len(already_processed)
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
    logger.info(f"Previously processed (skipped): {skipped}")
    logger.info(f"Newly processed: {successful}")
    logger.info(f"Failed: {failed}")
    logger.info(f"Total complete: {skipped + successful} / {len(all_equities)}")
    
    # Check if complete
    if skipped + successful >= len(all_equities):
        logger.info("✓ All assets processed successfully!")
    else:
        remaining = len(all_equities) - skipped - successful
        logger.info(f"⚠ {remaining} assets remaining - re-run to continue")
    
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
    global MODEL_NAME
    
    parser = argparse.ArgumentParser(
        description='Run AI analysis for operating companies (v3.3) - auto-detects latest features date'
    )
    parser.add_argument(
        '--date', 
        type=str, 
        help='Target date (YYYY-MM-DD). Auto-detects latest features date if not specified.',
        default=None
    )
    parser.add_argument(
        '--min-market-cap',
        type=float,
        default=100_000_000,
        help='Minimum market cap in dollars (default: 100000000 = $100M)'
    )
    parser.add_argument(
        '--min-daily-volume',
        type=float,
        default=1_000_000,
        help='Minimum daily dollar volume (default: 1000000 = $1M)'
    )
    parser.add_argument(
        '--model',
        type=str,
        default=MODEL_NAME,
        help=f'Gemini model to use (default: {MODEL_NAME})'
    )
    # Keep --limit for backwards compatibility but it's ignored
    parser.add_argument(
        '--limit', 
        type=int, 
        default=None,
        help='DEPRECATED: No longer used. Filtering is now based on market cap and volume.'
    )
    
    args = parser.parse_args()
    
    # Warn if --limit is used
    if args.limit is not None:
        logger.warning("--limit is deprecated and ignored. Filtering now uses --min-market-cap and --min-daily-volume.")
    
    # Determine target date - auto-detect from database if not specified
    if args.date:
        as_of_date = args.date
        logger.info(f"Using specified date: {as_of_date}")
    else:
        # Auto-detect the latest date with features data
        as_of_date = get_latest_features_date()
        if as_of_date:
            logger.info(f"Auto-detected latest features date: {as_of_date}")
        else:
            logger.error("No features data found in database. Cannot auto-detect date.")
            sys.exit(1)
    
    # Update model if specified
    MODEL_NAME = args.model
    
    if not GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY not set in environment")
        sys.exit(1)
    
    asyncio.run(main_async(as_of_date, args.min_market_cap, args.min_daily_volume))


if __name__ == "__main__":
    main()
