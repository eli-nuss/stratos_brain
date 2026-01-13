#!/usr/bin/env python3
"""
Daily Fundamental Score Update

This script performs the daily update of fundamental scores by:
1. Reading the pre-calculated base scores from fundamental_snapshot
2. Fetching live valuation data from existing tables (equity_metadata, daily_features)
3. Calculating the final composite score with real-time valuation adjustments
4. Updating rankings

This is the "fast path" that doesn't make FMP API calls - it uses existing data.

Usage:
    python fundamental_daily_update.py
    python fundamental_daily_update.py --date 2026-01-13  # Specific date

Author: Claude
Date: 2026-01-13
"""

import os
import sys
import logging
import argparse
import psycopg2
import json
from datetime import datetime, date
from typing import Dict, List, Optional, Tuple

# Database configuration
DB_HOST = os.environ.get('DB_HOST', 'db.wfogbaipiqootjrsprde.supabase.co')
DB_PORT = os.environ.get('DB_PORT', '5432')
DB_NAME = os.environ.get('DB_NAME', 'postgres')
DB_USER = os.environ.get('DB_USER', 'postgres')
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'stratosbrainpostgresdbpw')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============================================================================
# Scoring Configuration
# ============================================================================
# How much weight to give each component in the final score
COMPONENT_WEIGHTS = {
    'fundamental': 0.60,   # Base fundamental score from monthly analysis
    'valuation': 0.25,     # Real-time valuation metrics
    'technical': 0.15,     # Price trend indicators
}

# Growth stocks: more technical, less valuation sensitivity
GROWTH_COMPONENT_WEIGHTS = {
    'fundamental': 0.55,
    'valuation': 0.20,
    'technical': 0.25,
}

# Value stocks: more valuation sensitivity
VALUE_COMPONENT_WEIGHTS = {
    'fundamental': 0.55,
    'valuation': 0.35,
    'technical': 0.10,
}


def get_db_connection():
    """Create and return a database connection."""
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )


def normalize_score(value: Optional[float], perfect: float, zero: float,
                    higher_is_better: bool = True) -> float:
    """Normalize a value to 0-100 scale."""
    if value is None:
        return 50.0  # Neutral

    if higher_is_better:
        if value >= perfect:
            return 100.0
        elif value <= zero:
            return 0.0
        else:
            return 100.0 * (value - zero) / (perfect - zero)
    else:
        if value <= perfect:
            return 100.0
        elif value >= zero:
            return 0.0
        else:
            return 100.0 * (zero - value) / (zero - perfect)


def calculate_valuation_score(pe_ratio: Optional[float], peg_ratio: Optional[float],
                              pe_vs_5y: Optional[float], fcf_yield: Optional[float],
                              classification: str) -> Tuple[float, Dict]:
    """
    Calculate real-time valuation score.

    For Growth: Focus on PEG ratio (growth-adjusted P/E)
    For Value: Focus on FCF yield and P/E discount
    """
    breakdown = {}

    if classification == 'growth':
        # Growth valuation: PEG ratio is key
        peg_score = normalize_score(peg_ratio, 1.0, 3.0, higher_is_better=False)
        pe_score = normalize_score(pe_ratio, 15, 60, higher_is_better=False)

        breakdown['peg_score'] = peg_score
        breakdown['pe_score'] = pe_score

        # Weighted average for growth
        valuation_score = peg_score * 0.7 + pe_score * 0.3

    elif classification == 'value':
        # Value valuation: FCF yield and P/E discount
        fcf_score = normalize_score(fcf_yield, 0.08, 0, higher_is_better=True) if fcf_yield else 50
        pe_discount_score = normalize_score(pe_vs_5y, 0.8, 1.3, higher_is_better=False) if pe_vs_5y else 50
        pe_score = normalize_score(pe_ratio, 10, 25, higher_is_better=False) if pe_ratio else 50

        breakdown['fcf_yield_score'] = fcf_score
        breakdown['pe_discount_score'] = pe_discount_score
        breakdown['pe_score'] = pe_score

        # Weighted average for value
        valuation_score = fcf_score * 0.4 + pe_discount_score * 0.3 + pe_score * 0.3

    else:  # hybrid
        # Blend of both approaches
        peg_score = normalize_score(peg_ratio, 1.5, 3.0, higher_is_better=False) if peg_ratio else 50
        fcf_score = normalize_score(fcf_yield, 0.06, 0, higher_is_better=True) if fcf_yield else 50
        pe_score = normalize_score(pe_ratio, 15, 35, higher_is_better=False) if pe_ratio else 50

        breakdown['peg_score'] = peg_score
        breakdown['fcf_yield_score'] = fcf_score
        breakdown['pe_score'] = pe_score

        valuation_score = (peg_score + fcf_score + pe_score) / 3

    return valuation_score, breakdown


def calculate_technical_score(price_vs_sma_200: Optional[float],
                              price_vs_sma_50: Optional[float],
                              dist_52w_high: Optional[float],
                              trend_regime: Optional[str]) -> Tuple[float, Dict]:
    """
    Calculate technical/trend score.

    Components:
    - Price vs 200 SMA: Long-term trend
    - Price vs 50 SMA: Short-term trend
    - Distance from 52-week high: Momentum
    - Trend regime: Overall classification
    """
    breakdown = {}
    scores = []

    # Price vs 200 SMA (> 1 = above SMA = bullish)
    if price_vs_sma_200 is not None:
        sma_200_score = normalize_score(price_vs_sma_200, 1.1, 0.9, higher_is_better=True)
        breakdown['sma_200_score'] = sma_200_score
        scores.append(sma_200_score)

    # Price vs 50 SMA
    if price_vs_sma_50 is not None:
        sma_50_score = normalize_score(price_vs_sma_50, 1.05, 0.95, higher_is_better=True)
        breakdown['sma_50_score'] = sma_50_score
        scores.append(sma_50_score)

    # Distance from 52-week high (0 = at high, -0.5 = 50% below)
    if dist_52w_high is not None:
        # Convert to positive for easier scoring (0 = at high, 0.5 = 50% below)
        dist_positive = abs(dist_52w_high)
        high_score = normalize_score(dist_positive, 0, 0.3, higher_is_better=False)
        breakdown['dist_52w_high_score'] = high_score
        scores.append(high_score)

    # Trend regime
    if trend_regime:
        if trend_regime == 'uptrend':
            regime_score = 80.0
        elif trend_regime == 'downtrend':
            regime_score = 20.0
        else:
            regime_score = 50.0
        breakdown['trend_regime_score'] = regime_score
        scores.append(regime_score)

    if scores:
        technical_score = sum(scores) / len(scores)
    else:
        technical_score = 50.0  # Neutral if no data

    return technical_score, breakdown


def run_daily_update(conn, target_date: Optional[date] = None):
    """
    Run daily score update for all equities with fundamental snapshots.
    """
    if target_date is None:
        target_date = date.today()

    logger.info("=" * 60)
    logger.info(f"DAILY FUNDAMENTAL SCORE UPDATE - {target_date}")
    logger.info("=" * 60)

    with conn.cursor() as cur:
        # Get all equities with fundamental snapshots and their latest data
        cur.execute("""
            SELECT
                fs.asset_id,
                a.symbol,
                fs.classification,
                fs.base_fundamental_score,
                fs.pe_5y_avg,
                fs.fcf_yield,
                em.pe_ratio,
                em.peg_ratio,
                em.forward_pe,
                em.price_to_sales_ttm,
                em.price_to_book,
                em.ev_to_ebitda,
                em.ev_to_revenue,
                df.ma_dist_200,
                df.ma_dist_50,
                df.dist_52w_high,
                df.trend_regime
            FROM fundamental_snapshot fs
            JOIN assets a ON fs.asset_id = a.asset_id
            LEFT JOIN equity_metadata em ON a.asset_id = em.asset_id
            LEFT JOIN daily_features df ON a.asset_id = df.asset_id
                AND df.date = (SELECT MAX(date) FROM daily_features WHERE asset_id = a.asset_id)
            WHERE a.is_active = true
            ORDER BY em.market_cap DESC NULLS LAST
        """)

        rows = cur.fetchall()
        logger.info(f"Processing {len(rows)} equities")

        processed = 0
        errors = 0

        for row in rows:
            (asset_id, symbol, classification, base_score, pe_5y_avg, fcf_yield,
             pe_ratio, peg_ratio, forward_pe, price_to_sales, price_to_book,
             ev_to_ebitda, ev_to_revenue, ma_dist_200, ma_dist_50,
             dist_52w_high, trend_regime) = row

            try:
                # Calculate P/E vs 5-year average
                pe_vs_5y = None
                if pe_ratio and pe_5y_avg and pe_5y_avg > 0:
                    pe_vs_5y = pe_ratio / pe_5y_avg

                # Calculate price vs SMA (convert from distance to ratio)
                # ma_dist is typically stored as % distance, convert to ratio
                price_vs_sma_200 = 1 + (ma_dist_200 / 100) if ma_dist_200 is not None else None
                price_vs_sma_50 = 1 + (ma_dist_50 / 100) if ma_dist_50 is not None else None

                # Calculate component scores
                val_score, val_breakdown = calculate_valuation_score(
                    pe_ratio, peg_ratio, pe_vs_5y, fcf_yield, classification
                )

                tech_score, tech_breakdown = calculate_technical_score(
                    price_vs_sma_200, price_vs_sma_50, dist_52w_high, trend_regime
                )

                # Select weights based on classification
                if classification == 'growth':
                    weights = GROWTH_COMPONENT_WEIGHTS
                elif classification == 'value':
                    weights = VALUE_COMPONENT_WEIGHTS
                else:
                    weights = COMPONENT_WEIGHTS

                # Calculate final score
                fundamental_component = (base_score or 50) * weights['fundamental']
                valuation_component = val_score * weights['valuation']
                technical_component = tech_score * weights['technical']

                final_score = fundamental_component + valuation_component + technical_component

                # Clamp to 0-100
                final_score = max(0, min(100, final_score))

                # Build score breakdown
                score_breakdown = {
                    'fundamental': {
                        'score': base_score,
                        'weight': weights['fundamental'],
                        'contribution': fundamental_component
                    },
                    'valuation': {
                        'score': val_score,
                        'weight': weights['valuation'],
                        'contribution': valuation_component,
                        'details': val_breakdown
                    },
                    'technical': {
                        'score': tech_score,
                        'weight': weights['technical'],
                        'contribution': technical_component,
                        'details': tech_breakdown
                    }
                }

                # Upsert daily score
                cur.execute("""
                    INSERT INTO fundamental_scores (
                        asset_id, as_of_date, classification,
                        pe_ratio, forward_pe, peg_ratio, price_to_sales, price_to_book,
                        ev_to_ebitda, ev_to_revenue,
                        pe_vs_5y_avg,
                        price_vs_sma_200, price_vs_sma_50, dist_from_52w_high,
                        valuation_score, technical_score, fundamental_base_score,
                        final_score, score_breakdown
                    ) VALUES (
                        %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s,
                        %s,
                        %s, %s, %s,
                        %s, %s, %s,
                        %s, %s
                    )
                    ON CONFLICT (asset_id, as_of_date) DO UPDATE SET
                        classification = EXCLUDED.classification,
                        pe_ratio = EXCLUDED.pe_ratio,
                        forward_pe = EXCLUDED.forward_pe,
                        peg_ratio = EXCLUDED.peg_ratio,
                        price_to_sales = EXCLUDED.price_to_sales,
                        price_to_book = EXCLUDED.price_to_book,
                        ev_to_ebitda = EXCLUDED.ev_to_ebitda,
                        ev_to_revenue = EXCLUDED.ev_to_revenue,
                        pe_vs_5y_avg = EXCLUDED.pe_vs_5y_avg,
                        price_vs_sma_200 = EXCLUDED.price_vs_sma_200,
                        price_vs_sma_50 = EXCLUDED.price_vs_sma_50,
                        dist_from_52w_high = EXCLUDED.dist_from_52w_high,
                        valuation_score = EXCLUDED.valuation_score,
                        technical_score = EXCLUDED.technical_score,
                        fundamental_base_score = EXCLUDED.fundamental_base_score,
                        final_score = EXCLUDED.final_score,
                        score_breakdown = EXCLUDED.score_breakdown,
                        updated_at = NOW()
                """, (
                    asset_id, target_date, classification,
                    pe_ratio, forward_pe, peg_ratio, price_to_sales, price_to_book,
                    ev_to_ebitda, ev_to_revenue,
                    pe_vs_5y,
                    price_vs_sma_200, price_vs_sma_50, dist_52w_high,
                    val_score, tech_score, base_score,
                    final_score, json.dumps(score_breakdown)
                ))

                processed += 1

                if processed % 100 == 0:
                    logger.info(f"  Processed {processed} equities...")
                    conn.commit()

            except Exception as e:
                logger.error(f"Error processing {symbol}: {e}")
                errors += 1
                continue

        conn.commit()

    # Calculate rankings
    logger.info("Calculating rankings...")
    calculate_rankings(conn, target_date)

    logger.info("=" * 60)
    logger.info("SUMMARY")
    logger.info(f"  Processed: {processed}")
    logger.info(f"  Errors: {errors}")
    logger.info("=" * 60)


def calculate_rankings(conn, target_date: date):
    """Calculate rankings for the specified date."""
    with conn.cursor() as cur:
        # Rank in universe
        cur.execute("""
            WITH ranked AS (
                SELECT
                    asset_id,
                    ROW_NUMBER() OVER (ORDER BY final_score DESC) as rank_universe,
                    PERCENT_RANK() OVER (ORDER BY final_score DESC) * 100 as percentile
                FROM fundamental_scores
                WHERE as_of_date = %s
            )
            UPDATE fundamental_scores fs
            SET
                rank_in_universe = r.rank_universe,
                percentile = r.percentile
            FROM ranked r
            WHERE fs.asset_id = r.asset_id AND fs.as_of_date = %s
        """, (target_date, target_date))

        # Rank within classification
        cur.execute("""
            WITH ranked AS (
                SELECT
                    asset_id,
                    ROW_NUMBER() OVER (PARTITION BY classification ORDER BY final_score DESC) as rank_class
                FROM fundamental_scores
                WHERE as_of_date = %s
            )
            UPDATE fundamental_scores fs
            SET rank_in_classification = r.rank_class
            FROM ranked r
            WHERE fs.asset_id = r.asset_id AND fs.as_of_date = %s
        """, (target_date, target_date))

        # Calculate deltas
        cur.execute("""
            UPDATE fundamental_scores fs
            SET
                score_delta_1d = fs.final_score - COALESCE(
                    (SELECT final_score FROM fundamental_scores
                     WHERE asset_id = fs.asset_id AND as_of_date = fs.as_of_date - 1),
                    fs.final_score
                ),
                score_delta_5d = fs.final_score - COALESCE(
                    (SELECT final_score FROM fundamental_scores
                     WHERE asset_id = fs.asset_id AND as_of_date = fs.as_of_date - 5),
                    fs.final_score
                )
            WHERE as_of_date = %s
        """, (target_date,))

    conn.commit()


def main():
    parser = argparse.ArgumentParser(description='Daily Fundamental Score Update')
    parser.add_argument('--date', type=str, help='Target date (YYYY-MM-DD)')

    args = parser.parse_args()

    target_date = None
    if args.date:
        try:
            target_date = datetime.strptime(args.date, "%Y-%m-%d").date()
        except ValueError:
            logger.error("Invalid date format. Use YYYY-MM-DD")
            sys.exit(1)

    conn = get_db_connection()

    try:
        run_daily_update(conn, target_date)
    finally:
        conn.close()


if __name__ == '__main__':
    main()
