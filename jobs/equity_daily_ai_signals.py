#!/usr/bin/env python3
"""
Equity Daily AI Signals Generation Job

Generates AI-powered trading signals for top 500 equity assets using Gemini.
Designed to run after equity_daily_features.py completes.

Usage:
    python jobs/equity_daily_ai_signals.py --date 2026-01-06
    python jobs/equity_daily_ai_signals.py  # defaults to yesterday
"""

import os
import sys
import argparse
import logging
import time
import json
import hashlib
from datetime import datetime, timedelta, date
from typing import Dict, Any, List, Optional

import numpy as np
import psycopg2
from psycopg2.extras import RealDictCursor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Constants
ASSET_TYPE = 'equity'
AI_REVIEW_VERSION = "2.1"
LOOKBACK_BARS = 365  # 1 year of data for analysis
EQUITY_LIMIT = 500  # Top 500 equities by dollar volume

# Rate limiting
REQUESTS_PER_MINUTE = 15  # Conservative rate for Gemini API
REQUEST_DELAY = 60.0 / REQUESTS_PER_MINUTE


def get_connection():
    """Get database connection."""
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL environment variable not set")
    return psycopg2.connect(database_url)


def get_gemini_client():
    """Initialize Gemini client."""
    try:
        from google import genai
        api_key = os.environ.get('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")
        return genai.Client(api_key=api_key)
    except ImportError:
        raise ImportError("google-genai package not installed. Run: pip install google-genai")


def get_top_equity_assets(conn, target_date: str, limit: int = EQUITY_LIMIT) -> List[Dict]:
    """Get top equity assets by dollar volume with data for the target date."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT 
                a.asset_id, 
                a.symbol, 
                a.name, 
                a.asset_type,
                df.dollar_volume_sma_20
            FROM assets a
            JOIN daily_features df ON a.asset_id = df.asset_id AND df.date = %s
            WHERE a.asset_type = %s
              AND a.is_active = true
              AND df.dollar_volume_sma_20 IS NOT NULL
              AND EXISTS (SELECT 1 FROM daily_bars db WHERE db.asset_id = a.asset_id AND db.date = %s)
            ORDER BY df.dollar_volume_sma_20 DESC
            LIMIT %s
        """, (target_date, ASSET_TYPE, target_date, limit))
        return cur.fetchall()


def get_ohlcv_data(conn, asset_id: int, target_date: str, limit: int = LOOKBACK_BARS) -> List[Dict]:
    """Fetch OHLCV data for an asset."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT date, open, high, low, close, volume
            FROM daily_bars
            WHERE asset_id = %s AND date <= %s
            ORDER BY date DESC
            LIMIT %s
        """, (asset_id, target_date, limit))
        rows = cur.fetchall()
    return list(reversed(rows))


def get_features(conn, asset_id: int, target_date: str) -> Dict[str, Any]:
    """Get calculated features for an asset."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT *
            FROM daily_features
            WHERE asset_id = %s AND date = %s
        """, (asset_id, target_date))
        row = cur.fetchone()
    
    if row:
        return {k: v for k, v in dict(row).items() if v is not None and k not in ['asset_id', 'date']}
    return {}


def check_existing_review(conn, asset_id: int, target_date: str) -> bool:
    """Check if a review already exists for this asset and date."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT 1 FROM asset_ai_reviews
            WHERE asset_id = %s AND as_of_date = %s
            LIMIT 1
        """, (str(asset_id), target_date))
        return cur.fetchone() is not None


def build_analysis_prompt(symbol: str, name: str, ohlcv_data: List[Dict], features: Dict) -> str:
    """Build the analysis prompt for Gemini."""
    # Format OHLCV data
    ohlcv_str = "Date,Open,High,Low,Close,Volume\n"
    for bar in ohlcv_data[-60:]:  # Last 60 days
        ohlcv_str += f"{bar['date']},{bar['open']:.2f},{bar['high']:.2f},{bar['low']:.2f},{bar['close']:.2f},{bar['volume']:.0f}\n"
    
    # Format key features
    key_features = {
        'rsi_14': features.get('rsi_14'),
        'macd_histogram': features.get('macd_histogram'),
        'bb_pct': features.get('bb_pct'),
        'return_21d': features.get('return_21d'),
        'return_63d': features.get('return_63d'),
        'ma_dist_50': features.get('ma_dist_50'),
        'ma_dist_200': features.get('ma_dist_200'),
        'squeeze_flag': features.get('squeeze_flag'),
        'rvol_20': features.get('rvol_20'),
        'atr_pct': features.get('atr_pct'),
        'dist_52w_high': features.get('dist_52w_high'),
        'dist_52w_low': features.get('dist_52w_low'),
    }
    features_str = json.dumps({k: v for k, v in key_features.items() if v is not None}, indent=2)
    
    prompt = f"""Analyze the following equity for trading signals.

Asset: {symbol} ({name})
Asset Type: Equity (Stock)

Recent OHLCV Data (last 60 trading days):
{ohlcv_str}

Technical Features:
{features_str}

Provide a JSON response with the following structure:
{{
    "ai_direction_score": <float from -100 to 100, positive = bullish, negative = bearish>,
    "confidence": <float from 0 to 100>,
    "subscores": {{
        "trend": <float from 0 to 5>,
        "momentum": <float from 0 to 5>,
        "volatility": <float from 0 to 5>,
        "volume": <float from 0 to 5>,
        "pattern": <float from 0 to 5>
    }},
    "primary_signal": <string: "strong_buy", "buy", "neutral", "sell", "strong_sell">,
    "reasoning": <string: brief explanation of the analysis>
}}

Focus on:
1. Trend direction and strength (MA alignment, slope)
2. Momentum indicators (RSI, MACD)
3. Volatility regime (squeeze, ATR, Bollinger position)
4. Volume confirmation (relative volume)
5. Position relative to 52-week range
6. Key support/resistance levels
"""
    return prompt


def analyze_asset(client, model: str, symbol: str, name: str, ohlcv_data: List[Dict], features: Dict) -> Optional[Dict]:
    """Run AI analysis on a single asset."""
    try:
        prompt = build_analysis_prompt(symbol, name, ohlcv_data, features)
        
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "temperature": 0.3,
            }
        )
        
        # Parse response
        result_text = response.text.strip()
        if result_text.startswith("```json"):
            result_text = result_text[7:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]
        
        result = json.loads(result_text)
        return result
        
    except Exception as e:
        logger.error(f"Error analyzing {symbol}: {e}")
        return None


def calculate_fingerprint(ohlcv_data: List[Dict]) -> str:
    """Calculate a fingerprint of the OHLCV data for change detection."""
    if not ohlcv_data:
        return ""
    
    # Use last 20 closes for fingerprint
    closes = [str(round(bar['close'], 2)) for bar in ohlcv_data[-20:]]
    content = ",".join(closes)
    return hashlib.sha256(content.encode()).hexdigest()[:16]


def save_review(conn, asset_id: int, target_date: str, symbol: str, 
                ai_result: Dict, fingerprint: str, model: str) -> bool:
    """Save the AI review to the database."""
    try:
        # Calculate scores
        subscores = ai_result.get('subscores', {})
        total_subscore = sum(subscores.values()) if subscores else 0
        raw_quality_score = total_subscore * 4.0  # Scale to 0-100
        
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO asset_ai_reviews (
                    asset_id, as_of_date, model_name, prompt_version,
                    raw_ai_setup_quality_score, smoothed_ai_setup_quality_score,
                    raw_ai_direction_score, smoothed_ai_direction_score,
                    ai_direction_score, confidence, subscores,
                    primary_signal, reasoning, fingerprint,
                    created_at
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, NOW()
                )
                ON CONFLICT (asset_id, as_of_date) DO UPDATE SET
                    model_name = EXCLUDED.model_name,
                    raw_ai_setup_quality_score = EXCLUDED.raw_ai_setup_quality_score,
                    smoothed_ai_setup_quality_score = EXCLUDED.smoothed_ai_setup_quality_score,
                    raw_ai_direction_score = EXCLUDED.raw_ai_direction_score,
                    smoothed_ai_direction_score = EXCLUDED.smoothed_ai_direction_score,
                    ai_direction_score = EXCLUDED.ai_direction_score,
                    confidence = EXCLUDED.confidence,
                    subscores = EXCLUDED.subscores,
                    primary_signal = EXCLUDED.primary_signal,
                    reasoning = EXCLUDED.reasoning,
                    fingerprint = EXCLUDED.fingerprint,
                    created_at = NOW()
            """, (
                str(asset_id), target_date, model, AI_REVIEW_VERSION,
                raw_quality_score, raw_quality_score,  # smoothed = raw for now
                ai_result.get('ai_direction_score', 0), ai_result.get('ai_direction_score', 0),
                ai_result.get('ai_direction_score', 0),
                ai_result.get('confidence', 50),
                json.dumps(subscores),
                ai_result.get('primary_signal', 'neutral'),
                ai_result.get('reasoning', ''),
                fingerprint
            ))
            conn.commit()
        return True
    except Exception as e:
        logger.error(f"Error saving review for {symbol}: {e}")
        conn.rollback()
        return False


def main():
    parser = argparse.ArgumentParser(description='Equity Daily AI Signals Generation')
    parser.add_argument('--date', type=str, help='Target date (YYYY-MM-DD). Defaults to yesterday.')
    parser.add_argument('--model', type=str, default='gemini-2.5-flash', 
                       help='Gemini model to use')
    parser.add_argument('--limit', type=int, default=EQUITY_LIMIT, 
                       help=f'Number of top equities to process (default: {EQUITY_LIMIT})')
    parser.add_argument('--skip-existing', action='store_true', help='Skip assets with existing reviews')
    args = parser.parse_args()
    
    # Determine target date
    if args.date:
        target_date = args.date
    else:
        target_date = (date.today() - timedelta(days=1)).isoformat()
    
    logger.info("=" * 60)
    logger.info("EQUITY DAILY AI SIGNALS GENERATION")
    logger.info(f"Target Date: {target_date}")
    logger.info(f"Model: {args.model}")
    logger.info(f"Processing top {args.limit} equities by dollar volume")
    logger.info("=" * 60)
    
    # Initialize
    conn = get_connection()
    client = get_gemini_client()
    
    # Get top equity assets
    logger.info("Fetching top equity assets by dollar volume...")
    assets = get_top_equity_assets(conn, target_date, args.limit)
    
    total = len(assets)
    logger.info(f"Found {total} equity assets for {target_date}")
    
    if total == 0:
        logger.info("No assets to process!")
        return
    
    # Estimate time
    est_time = total * REQUEST_DELAY
    logger.info(f"Estimated runtime: ~{est_time/60:.1f} minutes (rate limited to {REQUESTS_PER_MINUTE} req/min)")
    
    # Process assets
    start_time = time.time()
    processed = 0
    success = 0
    skipped = 0
    errors = 0
    
    for asset in assets:
        asset_id = asset['asset_id']
        symbol = asset['symbol']
        name = asset['name'] or symbol
        
        processed += 1
        
        # Check for existing review
        if args.skip_existing and check_existing_review(conn, asset_id, target_date):
            skipped += 1
            continue
        
        # Get OHLCV data
        ohlcv_data = get_ohlcv_data(conn, asset_id, target_date)
        if len(ohlcv_data) < 30:
            logger.warning(f"Insufficient data for {symbol}: {len(ohlcv_data)} bars")
            skipped += 1
            continue
        
        # Get features
        features = get_features(conn, asset_id, target_date)
        
        # Run AI analysis
        ai_result = analyze_asset(client, args.model, symbol, name, ohlcv_data, features)
        
        if ai_result:
            fingerprint = calculate_fingerprint(ohlcv_data)
            if save_review(conn, asset_id, target_date, symbol, ai_result, fingerprint, args.model):
                success += 1
                logger.info(f"[{processed}/{total}] {symbol}: {ai_result.get('primary_signal', 'N/A')} "
                          f"(direction: {ai_result.get('ai_direction_score', 0):.1f})")
            else:
                errors += 1
        else:
            errors += 1
        
        # Rate limiting
        time.sleep(REQUEST_DELAY)
        
        # Progress update
        if processed % 50 == 0:
            elapsed = time.time() - start_time
            rate = processed / elapsed * 60 if elapsed > 0 else 0
            eta = (total - processed) / (rate / 60) if rate > 0 else 0
            logger.info(f"Progress: {processed}/{total} ({100*processed/total:.1f}%) | "
                      f"Rate: {rate:.1f}/min | ETA: {eta/60:.1f}m")
    
    elapsed = time.time() - start_time
    
    logger.info("=" * 60)
    logger.info("EQUITY AI SIGNALS GENERATION COMPLETE")
    logger.info("=" * 60)
    logger.info(f"Total processed: {processed}")
    logger.info(f"Success: {success}")
    logger.info(f"Skipped: {skipped}")
    logger.info(f"Errors: {errors}")
    logger.info(f"Time: {elapsed:.1f}s ({elapsed/60:.1f}m)")
    
    conn.close()


if __name__ == '__main__':
    main()
