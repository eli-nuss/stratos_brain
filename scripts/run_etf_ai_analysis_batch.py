#!/usr/bin/env python3
"""
ETF Batch AI Analysis Runner for E2B Parallel Processing.

Processes ETFs using Gemini AI for sector/macro analysis.
Each sandbox handles a batch of ETFs.

Usage:
    python run_etf_ai_analysis_batch.py --date 2026-01-27 --offset 0 --batch-size 20
"""

import argparse
import logging
import os
import sys
from datetime import datetime
from typing import Dict, Any, List, Optional

import psycopg2
from psycopg2.extras import RealDictCursor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def get_db_url():
    """Get database URL from environment."""
    db_url = os.environ.get('DATABASE_URL') or os.environ.get('SUPABASE_DATABASE_URL')
    if not db_url:
        raise ValueError("DATABASE_URL or SUPABASE_DATABASE_URL not set")
    return db_url


def get_gemini_client():
    """Initialize Gemini client."""
    try:
        from google import genai
        api_key = os.environ.get('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set")
        return genai.Client(api_key=api_key)
    except ImportError:
        raise ImportError("google-genai not installed. Run: pip install google-genai")


def get_etf_batch(db_url: str, as_of_date: str, offset: int, batch_size: int) -> List[Dict]:
    """Get a specific batch of ETFs based on offset and batch_size."""
    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get ETFs sorted by dollar volume (largest first)
            cur.execute("""
                SELECT 
                    a.asset_id,
                    a.symbol,
                    a.name,
                    a.sector,
                    a.industry,
                    df.close,
                    df.return_21d,
                    df.return_63d,
                    df.return_252d,
                    df.rsi_14,
                    df.ma_dist_50,
                    df.ma_dist_200,
                    df.trend_regime,
                    df.macd_histogram,
                    df.bb_width,
                    df.rvol_20,
                    df.dollar_volume_sma_20,
                    CASE WHEN ss.asset_id IS NOT NULL THEN TRUE ELSE FALSE END as has_active_setup
                FROM assets a
                JOIN daily_features df ON a.asset_id = df.asset_id AND df.date = %s
                LEFT JOIN (
                    SELECT DISTINCT asset_id 
                    FROM setup_signals 
                    WHERE signal_date = %s AND setup_name LIKE 'etf_%%'
                ) ss ON a.asset_id = ss.asset_id
                WHERE a.asset_type = 'etf'
                  AND a.is_active = TRUE
                ORDER BY df.dollar_volume_sma_20 DESC NULLS LAST
                LIMIT %s OFFSET %s
            """, (as_of_date, as_of_date, batch_size, offset))
            return list(cur.fetchall())
    finally:
        conn.close()


def get_ohlcv_data(db_url: str, asset_id: int, target_date: str, limit: int = 90) -> List[Dict]:
    """Fetch OHLCV data for an ETF (last 90 days for context)."""
    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT date, open, high, low, close, volume
                FROM daily_bars
                WHERE asset_id = %s AND date <= %s
                ORDER BY date DESC
                LIMIT %s
            """, (asset_id, target_date, limit))
            rows = cur.fetchall()
            return [dict(row) for row in reversed(rows)]
    finally:
        conn.close()


def analyze_etf(client, etf: Dict, ohlcv: List[Dict], model: str) -> Optional[Dict]:
    """Analyze an ETF using Gemini AI."""
    try:
        # Build the prompt
        prompt = f"""Analyze this ETF and provide a trading assessment:

ETF: {etf['symbol']} - {etf['name']}
Sector: {etf.get('sector', 'N/A')}
Industry: {etf.get('industry', 'N/A')}

Current Technical Status:
- Price: ${etf['close']:.2f}
- RSI (14): {etf.get('rsi_14', 'N/A'):.1f if etf.get('rsi_14') else 'N/A'}
- Distance from 50MA: {etf.get('ma_dist_50', 0)*100:.1f}%
- Distance from 200MA: {etf.get('ma_dist_200', 0)*100:.1f}%
- Trend Regime: {etf.get('trend_regime', 'N/A')}
- 21-day Return: {etf.get('return_21d', 0)*100:.1f}%
- 63-day Return: {etf.get('return_63d', 0)*100:.1f}%
- Relative Volume: {etf.get('rvol_20', 'N/A'):.2f}x
- Has Active Setup: {'Yes' if etf.get('has_active_setup') else 'No'}

Recent Price History (last 10 days):
"""
        
        # Add recent price data
        for bar in ohlcv[-10:]:
            prompt += f"- {bar['date']}: O:{bar['open']:.2f} H:{bar['high']:.2f} L:{bar['low']:.2f} C:{bar['close']:.2f}\n"
        
        prompt += """
Provide your analysis in this JSON format:
{
  "direction": "bullish" | "bearish" | "neutral",
  "confidence": 0-100,
  "thesis": "One paragraph explaining the technical setup and outlook",
  "key_levels": {
    "support": [price1, price2],
    "resistance": [price1, price2]
  },
  "risk_factors": ["factor1", "factor2"],
  "time_horizon": "short_term" | "medium_term" | "long_term"
}

Be concise and specific. Focus on actionable insights."""

        # Call Gemini API
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config={'response_mime_type': 'application/json'}
        )
        
        # Parse the JSON response
        import json
        result = json.loads(response.text)
        
        return {
            'asset_id': etf['asset_id'],
            'as_of_date': etf.get('date'),
            'ai_direction': result.get('direction', 'neutral'),
            'confidence': result.get('confidence', 50),
            'thesis': result.get('thesis', ''),
            'key_levels': result.get('key_levels', {}),
            'risk_factors': result.get('risk_factors', []),
            'time_horizon': result.get('time_horizon', 'medium_term'),
            'model_version': model,
            'review_version': 'etf_v1'
        }
        
    except Exception as e:
        logger.error(f"Error analyzing {etf['symbol']}: {e}")
        return None


def save_ai_review(db_url: str, review: Dict) -> bool:
    """Save AI review to database."""
    import json
    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO asset_ai_reviews (
                    asset_id, as_of_date, ai_direction, confidence, thesis,
                    key_levels, risk_factors, time_horizon, model_version, review_version,
                    created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (asset_id, as_of_date) DO UPDATE SET
                    ai_direction = EXCLUDED.ai_direction,
                    confidence = EXCLUDED.confidence,
                    thesis = EXCLUDED.thesis,
                    key_levels = EXCLUDED.key_levels,
                    risk_factors = EXCLUDED.risk_factors,
                    time_horizon = EXCLUDED.time_horizon,
                    model_version = EXCLUDED.model_version,
                    review_version = EXCLUDED.review_version,
                    created_at = EXCLUDED.created_at
            """, (
                review['asset_id'],
                review['as_of_date'],
                review['ai_direction'],
                review['confidence'],
                review['thesis'],
                json.dumps(review['key_levels']),
                json.dumps(review['risk_factors']),
                review['time_horizon'],
                review['model_version'],
                review['review_version']
            ))
        conn.commit()
        return True
    except Exception as e:
        logger.error(f"Error saving review for asset {review['asset_id']}: {e}")
        return False
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description='Run ETF AI analysis for a batch')
    parser.add_argument('--date', type=str, required=True, help='Target date (YYYY-MM-DD)')
    parser.add_argument('--model', type=str, default='gemini-3-flash-preview',
                        help='Gemini model to use')
    parser.add_argument('--offset', type=int, required=True, help='Starting offset (0-indexed)')
    parser.add_argument('--batch-size', type=int, required=True, help='Number of ETFs to process')
    
    args = parser.parse_args()
    
    logger.info(f"Starting ETF AI Analysis Batch")
    logger.info(f"  Date: {args.date}")
    logger.info(f"  Model: {args.model}")
    logger.info(f"  Offset: {args.offset}")
    logger.info(f"  Batch Size: {args.batch_size}")
    
    db_url = get_db_url()
    client = get_gemini_client()
    
    # Get batch of ETFs
    etfs = get_etf_batch(db_url, args.date, args.offset, args.batch_size)
    logger.info(f"Found {len(etfs)} ETFs in batch")
    
    if not etfs:
        logger.info("No ETFs to process in this batch")
        return
    
    # Process each ETF
    processed = 0
    errors = 0
    
    for i, etf in enumerate(etfs):
        try:
            logger.info(f"Processing {etf['symbol']} ({i+1}/{len(etfs)})...")
            
            # Get OHLCV data
            ohlcv = get_ohlcv_data(db_url, etf['asset_id'], args.date)
            
            # Analyze with AI
            review = analyze_etf(client, etf, ohlcv, args.model)
            
            if review:
                # Add the date from args
                review['as_of_date'] = args.date
                
                # Save to database
                if save_ai_review(db_url, review):
                    processed += 1
                    logger.info(f"✓ Saved analysis for {etf['symbol']}")
                else:
                    errors += 1
                    logger.warning(f"✗ Failed to save {etf['symbol']}")
            else:
                errors += 1
                logger.warning(f"✗ No analysis result for {etf['symbol']}")
                
        except Exception as e:
            errors += 1
            logger.error(f"Error processing {etf['symbol']}: {e}")
    
    logger.info(f"Batch complete: {processed} processed, {errors} errors")
    
    # Exit with error code if too many failures
    if errors > len(etfs) * 0.5:
        logger.error("Too many errors, marking batch as failed")
        sys.exit(1)


if __name__ == '__main__':
    main()
