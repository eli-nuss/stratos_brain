#!/usr/bin/env python3
"""
ETF Daily Scoring Job
=====================
Calculates composite technical scores for all ETFs.
Runs after ETF features are calculated to generate rankings.

Usage:
    python jobs/etf_daily_scoring.py --date 2026-01-27
    python jobs/etf_daily_scoring.py  # defaults to today

Environment Variables:
    DATABASE_URL: PostgreSQL connection string
"""

import os
import sys
import argparse
import logging
from datetime import datetime, date

import numpy as np
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor, execute_values

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


def get_connection():
    """Get database connection."""
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL not set")
    return psycopg2.connect(database_url)


def calculate_etf_scores(target_date: str) -> int:
    """Calculate and insert ETF scores for target_date."""
    conn = get_connection()
    
    logger.info(f"Calculating ETF scores for {target_date}")
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Query ETFs with features
        cur.execute("""
            SELECT 
                df.asset_id,
                a.symbol,
                df.close,
                df.return_1d,
                df.return_21d,
                df.return_63d,
                df.ma_dist_50,
                df.ma_dist_200,
                df.rsi_14,
                df.trend_regime,
                df.macd_histogram,
                df.bb_width,
                df.rvol_20,
                df.dollar_volume_sma_20,
                df.above_ma200,
                df.ma50_above_ma200
            FROM daily_features df
            JOIN assets a ON df.asset_id = a.asset_id
            WHERE df.date = %s
              AND a.asset_type = 'etf'
              AND a.is_active = true
        """, (target_date,))
        
        etfs = cur.fetchall()
        logger.info(f"Found {len(etfs)} ETFs with features")
        
        if not etfs:
            logger.warning("No ETFs found with features for this date")
            return 0
        
        # Calculate scores
        scores = []
        for etf in etfs:
            score = calculate_single_etf_score(etf, target_date)
            scores.append(score)
        
        # Insert scores
        with conn.cursor() as insert_cur:
            execute_values(insert_cur, """
                INSERT INTO daily_asset_scores (
                    as_of_date, asset_id, universe_id, config_id,
                    weighted_score, inflection_score,
                    score_bullish, score_bearish,
                    components, created_at
                ) VALUES %s
                ON CONFLICT (as_of_date, asset_id, universe_id, config_id) DO UPDATE SET
                    weighted_score = EXCLUDED.weighted_score,
                    inflection_score = EXCLUDED.inflection_score,
                    score_bullish = EXCLUDED.score_bullish,
                    score_bearish = EXCLUDED.score_bearish,
                    components = EXCLUDED.components,
                    created_at = EXCLUDED.created_at
            """, scores)
        
        conn.commit()
        logger.info(f"Inserted/updated {len(scores)} ETF scores")
        
        # Update latest_dates for etf_scores
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO latest_dates (asset_type, latest_date, updated_at)
                    VALUES ('etf_scores', %s, NOW())
                    ON CONFLICT (asset_type) 
                    DO UPDATE SET latest_date = EXCLUDED.latest_date, updated_at = NOW()
                    WHERE latest_dates.latest_date < EXCLUDED.latest_date
                """, (target_date,))
                logger.info(f"Updated latest_dates for etf_scores to {target_date}")
        except Exception as e:
            logger.warning(f"Failed to update latest_dates: {e}")
        
        return len(scores)


def calculate_single_etf_score(etf: dict, target_date: str) -> tuple:
    """Calculate composite score for a single ETF."""
    components = {}
    
    # Trend score (0-100)
    trend_score = 50
    if etf['trend_regime'] == 'bullish':
        trend_score = 80
    elif etf['trend_regime'] == 'bearish':
        trend_score = 20
    
    # MA alignment bonus
    if etf['above_ma200'] and etf['ma50_above_ma200']:
        trend_score += 10
    elif not etf['above_ma200'] and not etf['ma50_above_ma200']:
        trend_score -= 10
    
    components['trend'] = min(max(trend_score, 0), 100)
    
    # Momentum score based on returns
    mom_score = 50
    if etf['return_21d']:
        if etf['return_21d'] > 0.05:
            mom_score += 20
        elif etf['return_21d'] > 0.02:
            mom_score += 10
        elif etf['return_21d'] < -0.05:
            mom_score -= 20
        elif etf['return_21d'] < -0.02:
            mom_score -= 10
    
    components['momentum'] = min(max(mom_score, 0), 100)
    
    # Mean reversion / RSI
    rsi_score = 50
    if etf['rsi_14']:
        if etf['rsi_14'] < 30:  # Oversold - bullish
            rsi_score = 70
        elif etf['rsi_14'] > 70:  # Overbought - bearish
            rsi_score = 30
        else:
            rsi_score = 50
    
    components['mean_reversion'] = rsi_score
    
    # Volume / attention
    vol_score = 50
    if etf['rvol_20'] and etf['rvol_20'] > 1.5:
        vol_score = 70  # High volume interest
    
    components['volume'] = vol_score
    
    # Calculate composite weighted score
    weighted_score = (
        components['trend'] * 0.35 +
        components['momentum'] * 0.25 +
        components['mean_reversion'] * 0.25 +
        components['volume'] * 0.15
    )
    
    # Inflection score (how much it changed recently)
    inflection_score = abs(components['momentum'] - 50) + abs(components['mean_reversion'] - 50)
    inflection_score = min(inflection_score, 100)
    
    return (
        target_date,
        etf['asset_id'],
        'etf_universe',
        'etf_v1',
        round(weighted_score, 2),
        round(inflection_score, 2),
        round(weighted_score, 2) if weighted_score > 50 else 0,
        round(100 - weighted_score, 2) if weighted_score < 50 else 0,
        str(components),
        datetime.now().isoformat()
    )


def main():
    parser = argparse.ArgumentParser(description='ETF Daily Scoring')
    parser.add_argument('--date', type=str, help='Target date (YYYY-MM-DD)')
    args = parser.parse_args()
    
    if args.date:
        target_date = args.date
    else:
        target_date = date.today().isoformat()
    
    logger.info("=" * 60)
    logger.info("ETF DAILY SCORING")
    logger.info(f"Target Date: {target_date}")
    logger.info("=" * 60)
    
    count = calculate_etf_scores(target_date)
    
    logger.info("=" * 60)
    if count > 0:
        logger.info(f"✅ Complete: Processed {count} ETFs")
    else:
        logger.info("⚠️ No ETFs processed")
    logger.info("=" * 60)


if __name__ == '__main__':
    main()
