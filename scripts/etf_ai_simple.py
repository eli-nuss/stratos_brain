#!/usr/bin/env python3
"""
Simple ETF AI Analysis - Direct execution without E2B.
Processes all ETFs sequentially in a single GitHub Actions job.
"""

import os
import sys
import json
import logging
from datetime import datetime
from decimal import Decimal

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

# Check dependencies
try:
    import psycopg2
    from google import genai
    from google.genai import types
except ImportError as e:
    logger.error(f"Missing dependency: {e}")
    logger.error("Run: pip install psycopg2-binary google-genai")
    sys.exit(1)

DB_URL = os.environ.get('DATABASE_URL') or os.environ.get('SUPABASE_DATABASE_URL')
GEMINI_KEY = os.environ.get('GEMINI_API_KEY')

if not DB_URL:
    logger.error("DATABASE_URL not set")
    sys.exit(1)
if not GEMINI_KEY:
    logger.error("GEMINI_API_KEY not set")
    sys.exit(1)

# Simple prompt for ETF analysis
SYSTEM_PROMPT = """You are a technical analyst reviewing ETFs.

Analyze the provided price data and return a JSON response with:
- direction: "bullish" | "bearish" | "neutral"
- confidence: 0.0 to 1.0
- summary: 2-3 sentence technical assessment
- key_levels: object with support and resistance arrays

Be specific and cite price levels."""

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "direction": {"enum": ["bullish", "bearish", "neutral"]},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "summary": {"type": "string"},
        "key_levels": {
            "type": "object",
            "properties": {
                "support": {"type": "array", "items": {"type": "number"}},
                "resistance": {"type": "array", "items": {"type": "number"}}
            }
        }
    },
    "required": ["direction", "confidence", "summary"]
}


def get_etfs_with_features(date_str):
    """Get ETFs that have features calculated for the target date."""
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("""
        SELECT a.asset_id, a.symbol, a.name, df.close, df.rsi_14, 
               df.ma_dist_50, df.trend_regime, df.return_21d
        FROM assets a
        JOIN daily_features df ON a.asset_id = df.asset_id
        WHERE df.date = %s
          AND a.asset_type = 'etf'
          AND a.is_active = TRUE
        ORDER BY a.asset_id
    """, (date_str,))
    results = cur.fetchall()
    conn.close()
    return results


def get_ohlcv(asset_id, date_str, limit=90):
    """Get OHLCV data for an ETF."""
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("""
        SELECT date, open, high, low, close, volume
        FROM daily_bars
        WHERE asset_id = %s AND date <= %s
        ORDER BY date DESC
        LIMIT %s
    """, (asset_id, date_str, limit))
    rows = cur.fetchall()
    conn.close()
    return list(reversed(rows))


def analyze_etf(symbol, name, features, ohlcv, model_name):
    """Run Gemini analysis on an ETF."""
    client = genai.Client(api_key=GEMINI_KEY)
    
    # Build simple prompt
    close, rsi, ma_dist, trend, ret_21d = features[3:]
    
    price_history = "\n".join([
        f"{row[0]}: O:{row[1]:.2f} H:{row[2]:.2f} L:{row[3]:.2f} C:{row[4]:.2f}"
        for row in ohlcv[-10:]
    ])
    
    prompt = f"""Analyze ETF: {symbol} ({name})

Current Status:
- Price: ${close:.2f}
- RSI: {rsi:.1f}
- Trend: {trend}
- 21-day return: {ret_21d*100:.1f}%

Recent price history:
{price_history}

{SYSTEM_PROMPT}

Output valid JSON matching this schema:
{json.dumps(OUTPUT_SCHEMA, indent=2)}"""

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=2000,
                response_mime_type="application/json"
            )
        )
        return json.loads(response.text)
    except Exception as e:
        logger.error(f"Error analyzing {symbol}: {e}")
        return None


def save_review(asset_id, symbol, date_str, model, analysis):
    """Save AI review to database."""
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    review_json = json.dumps({
        "direction": analysis.get("direction"),
        "confidence": analysis.get("confidence"),
        "summary": analysis.get("summary"),
        "key_levels": analysis.get("key_levels", {})
    })
    
    # Use simplified columns
    cur.execute("""
        INSERT INTO asset_ai_reviews (
            asset_id, as_of_date, model, 
            ai_direction, ai_confidence, ai_summary_text,
            review_json, created_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT (asset_id, as_of_date) DO UPDATE SET
            model = EXCLUDED.model,
            ai_direction = EXCLUDED.ai_direction,
            ai_confidence = EXCLUDED.ai_confidence,
            ai_summary_text = EXCLUDED.ai_summary_text,
            review_json = EXCLUDED.review_json,
            updated_at = NOW()
    """, (
        asset_id, date_str, model,
        analysis.get("direction"),
        analysis.get("confidence"),
        analysis.get("summary"),
        review_json
    ))
    
    conn.commit()
    conn.close()


def main():
    if len(sys.argv) < 2:
        print("Usage: python etf_ai_simple.py <date> [model]")
        sys.exit(1)
    
    date_str = sys.argv[1]
    model = sys.argv[2] if len(sys.argv) > 2 else "gemini-3-flash-preview"
    
    logger.info(f"Starting ETF AI Analysis for {date_str}")
    logger.info(f"Using model: {model}")
    
    # Get ETFs
    etfs = get_etfs_with_features(date_str)
    logger.info(f"Found {len(etfs)} ETFs with features")
    
    if not etfs:
        logger.warning("No ETFs to process")
        return
    
    # Process each ETF
    success = 0
    failed = 0
    
    for i, etf in enumerate(etfs):
        asset_id, symbol, name = etf[0], etf[1], etf[2]
        logger.info(f"[{i+1}/{len(etfs)}] Analyzing {symbol}...")
        
        try:
            ohlcv = get_ohlcv(asset_id, date_str)
            if not ohlcv:
                logger.warning(f"  No OHLCV data for {symbol}")
                failed += 1
                continue
            
            analysis = analyze_etf(symbol, name, etf, ohlcv, model)
            if analysis:
                save_review(asset_id, symbol, date_str, model, analysis)
                logger.info(f"  ✓ Saved: {analysis.get('direction')} (confidence: {analysis.get('confidence'):.2f})")
                success += 1
            else:
                logger.warning(f"  ✗ Analysis failed")
                failed += 1
                
        except Exception as e:
            logger.error(f"  ✗ Error: {e}")
            failed += 1
    
    logger.info("=" * 50)
    logger.info(f"Complete: {success} successful, {failed} failed, {len(etfs)} total")


if __name__ == "__main__":
    main()
