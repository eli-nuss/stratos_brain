#!/usr/bin/env python3
"""
Run AI analysis for all crypto assets using parallel processing.
Uses gemini-3-pro-preview model with concurrent API calls for faster execution.

VERSION 3: Improved prompting to decouple direction score from quality score.
Based on Gemini recommendations for independent scoring.
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
    """Build the analysis prompt with improved decoupling of direction and quality."""
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
    
    prompt = f"""You are a professional technical analyst. Analyze this cryptocurrency chart and return a JSON assessment.

[CRITICAL INDEPENDENCE MANDATE]
You MUST evaluate TWO SEPARATE dimensions:
1. DIRECTION: Where is price likely to go? (bullish/bearish conviction)
2. QUALITY: How clean and tradeable is the chart structure? (INDEPENDENT of direction!)

IMPORTANT RULES:
- A BEARISH asset with a clean breakdown pattern MUST have HIGH quality (80+)
- A BULLISH asset with a messy chart MUST have LOW quality (below 50)
- Quality measures STRUCTURAL CLARITY, not directional conviction
- Quality = How easy is it to define entry, stop-loss, and targets?

ASSET: {symbol} ({name})
CURRENT PRICE: {current_price}

OHLCV DATA (Date,Open,High,Low,Close,Volume):
{ohlcv_text}
{features_text}
{signals_text}

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
  "subscores": {{
    "boundary_definition": integer 0-5 (clarity of S/R levels),
    "structural_compliance": integer 0-5 (textbook pattern adherence),
    "volatility_profile": integer 0-5 (clean vs choppy price action),
    "volume_coherence": integer 0-5 (volume confirms pattern),
    "risk_reward_clarity": integer 0-5 (ease of placing SL/TP)
  }},
  "why_now": ["reason1", "reason2"],
  "risks": ["risk1", "risk2"]
}}

EXAMPLES OF CORRECT SCORING:
- Bearish (-85) + High Quality (90): Clean head-and-shoulders breakdown with defined neckline
- Bullish (+80) + Low Quality (35): Strong momentum but messy chart, no clear levels
- Neutral (0) + High Quality (80): Clean range consolidation with clear boundaries

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
    
    # Extract fields from result
    direction = result.get('direction', 'neutral')
    direction_score = result.get('ai_direction_score', 0)
    quality_score = result.get('ai_setup_quality_score', 50)
    setup_type = result.get('setup_type')
    attention_level = result.get('attention_level')
    confidence = result.get('confidence', 0.5)
    summary = result.get('summary_text', '')
    
    # Extract entry zone
    entry_zone = result.get('entry_zone', {})
    ai_entry = f"{entry_zone.get('low', 0)}-{entry_zone.get('high', 0)}" if entry_zone else None
    
    # Extract targets
    targets = result.get('targets', [])
    ai_targets = ','.join([str(t) for t in targets]) if targets else None
    
    query = """
    INSERT INTO asset_ai_reviews (
        asset_id, as_of_date, direction, ai_direction_score, ai_setup_quality_score,
        setup_type, attention_level, confidence, summary_text, ai_entry, ai_targets,
        review_json, model, review_version, created_at
    ) VALUES (
        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()
    )
    ON CONFLICT (asset_id, as_of_date) DO UPDATE SET
        direction = EXCLUDED.direction,
        ai_direction_score = EXCLUDED.ai_direction_score,
        ai_setup_quality_score = EXCLUDED.ai_setup_quality_score,
        setup_type = EXCLUDED.setup_type,
        attention_level = EXCLUDED.attention_level,
        confidence = EXCLUDED.confidence,
        summary_text = EXCLUDED.summary_text,
        ai_entry = EXCLUDED.ai_entry,
        ai_targets = EXCLUDED.ai_targets,
        review_json = EXCLUDED.review_json,
        model = EXCLUDED.model,
        review_version = EXCLUDED.review_version,
        created_at = NOW()
    """
    
    try:
        db.execute(query, (
            str(asset_id), as_of_date, direction, direction_score, quality_score,
            setup_type, attention_level, confidence, summary, ai_entry, ai_targets,
            json.dumps(result), MODEL_NAME, AI_REVIEW_VERSION
        ))
        return True
    except Exception as e:
        logger.error(f"Database error for asset {asset_id}: {e}")
        return False


async def process_asset(session: aiohttp.ClientSession, asset: dict, as_of_date: str, semaphore: asyncio.Semaphore) -> dict:
    """Process a single asset with rate limiting."""
    async with semaphore:
        asset_id = asset['asset_id']
        symbol = asset['symbol']
        name = asset['name']
        
        # Get data (run in thread pool to avoid blocking)
        loop = asyncio.get_event_loop()
        bars = await loop.run_in_executor(None, get_ohlcv_data, asset_id, as_of_date)
        features = await loop.run_in_executor(None, get_features, asset_id, as_of_date)
        signals = await loop.run_in_executor(None, get_signals, asset_id, as_of_date)
        
        if not bars:
            logger.warning(f"No OHLCV data for {symbol}")
            return {'asset_id': asset_id, 'symbol': symbol, 'success': False, 'reason': 'no_data'}
        
        # Build prompt and call API
        prompt = build_prompt(symbol, name, bars, features, signals)
        result = await call_gemini_api(session, prompt)
        
        if result:
            # Save to database
            success = await loop.run_in_executor(None, save_to_database, asset_id, as_of_date, result)
            if success:
                dir_score = result.get('ai_direction_score', 0)
                qual_score = result.get('ai_setup_quality_score', 0)
                logger.info(f"✓ {symbol}: dir={dir_score:+d}, qual={qual_score}, {result.get('direction')}")
                return {'asset_id': asset_id, 'symbol': symbol, 'success': True, 'result': result}
        
        logger.warning(f"✗ {symbol}: API call failed")
        return {'asset_id': asset_id, 'symbol': symbol, 'success': False, 'reason': 'api_error'}


async def main():
    """Main async function to process all crypto assets."""
    # Get target date
    as_of_date = os.environ.get('AS_OF_DATE', str(date.today()))
    logger.info(f"Starting AI analysis for {as_of_date} (v3 - improved prompting)")
    
    # Get all active crypto assets
    db = Database()
    query = """
    SELECT a.asset_id, a.symbol, a.name
    FROM assets a
    WHERE a.asset_type = 'crypto'
    AND a.is_active = true
    ORDER BY a.symbol
    """
    assets = db.fetch_all(query)
    logger.info(f"Found {len(assets)} active crypto assets")
    
    # Process with rate limiting
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    
    async with aiohttp.ClientSession() as session:
        tasks = [process_asset(session, dict(a), as_of_date, semaphore) for a in assets]
        results = await asyncio.gather(*tasks)
    
    # Summary
    successful = sum(1 for r in results if r.get('success'))
    failed = len(results) - successful
    logger.info(f"Completed: {successful} successful, {failed} failed")
    
    # Check correlation improvement
    if successful > 10:
        dir_scores = [r['result']['ai_direction_score'] for r in results if r.get('success') and r.get('result')]
        qual_scores = [r['result']['ai_setup_quality_score'] for r in results if r.get('success') and r.get('result')]
        if dir_scores and qual_scores:
            import numpy as np
            corr = np.corrcoef(dir_scores, qual_scores)[0,1]
            abs_corr = np.corrcoef([abs(d) for d in dir_scores], qual_scores)[0,1]
            logger.info(f"Correlation check: dir vs qual = {corr:.3f}, |dir| vs qual = {abs_corr:.3f}")


if __name__ == "__main__":
    if not GEMINI_API_KEY:
        print("Error: GEMINI_API_KEY environment variable not set")
        sys.exit(1)
    
    asyncio.run(main())
