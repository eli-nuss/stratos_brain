#!/usr/bin/env python3
"""Quick test to see how many assets would qualify for weinstein_stage2 with different criteria."""
import os
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta

DATABASE_URL = os.environ.get('DATABASE_URL')
conn = psycopg2.connect(DATABASE_URL)

target_date = '2026-01-23'

# Get all equity assets with features
with conn.cursor(cursor_factory=RealDictCursor) as cur:
    cur.execute("""
        SELECT df.asset_id, a.symbol, df.close, df.rvol_20, df.ma_slope_200
        FROM daily_features df
        JOIN assets a ON df.asset_id = a.asset_id
        WHERE df.date = %s AND a.asset_type = 'equity'
          AND df.rvol_20 > 1.5
          AND df.ma_slope_200 > -0.5
    """, (target_date,))
    candidates = cur.fetchall()

print(f"Candidates with high volume and good MA slope: {len(candidates)}")

# For each candidate, check the base range
def get_base_range(asset_id, base_days):
    start_date = (datetime.strptime(target_date, '%Y-%m-%d') - timedelta(days=base_days + 50)).strftime('%Y-%m-%d')
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT date, high, low, close
            FROM daily_bars
            WHERE asset_id = %s AND date >= %s AND date <= %s
            ORDER BY date ASC
        """, (asset_id, start_date, target_date))
        bars = cur.fetchall()
    
    if len(bars) < base_days:
        return None, None, None
    
    recent = bars[-base_days:]
    high = max(b['high'] for b in recent)
    low = min(b['low'] for b in recent)
    base_range = (high - low) / low if low > 0 else None
    
    # Check if current close is above base high
    current_close = bars[-1]['close']
    breakout = current_close > high
    
    return base_range, breakout, high

results = {
    '15%_100d': [],
    '20%_100d': [],
    '25%_100d': [],
    '20%_80d': [],
    '25%_60d': [],
}

print("\nChecking base ranges for candidates...")
for i, c in enumerate(candidates[:200]):  # Check first 200 to save time
    asset_id = c['asset_id']
    symbol = c['symbol']
    
    # Test 100-day base
    base_range_100, breakout_100, high_100 = get_base_range(asset_id, 100)
    if base_range_100 is not None and breakout_100:
        if base_range_100 < 0.15:
            results['15%_100d'].append(symbol)
        if base_range_100 < 0.20:
            results['20%_100d'].append(symbol)
        if base_range_100 < 0.25:
            results['25%_100d'].append(symbol)
    
    # Test 80-day base
    base_range_80, breakout_80, high_80 = get_base_range(asset_id, 80)
    if base_range_80 is not None and breakout_80 and base_range_80 < 0.20:
        results['20%_80d'].append(symbol)
    
    # Test 60-day base
    base_range_60, breakout_60, high_60 = get_base_range(asset_id, 60)
    if base_range_60 is not None and breakout_60 and base_range_60 < 0.25:
        results['25%_60d'].append(symbol)
    
    if (i + 1) % 50 == 0:
        print(f"  Checked {i + 1}/{min(200, len(candidates))}")

print("\n" + "=" * 60)
print("WEINSTEIN STAGE 2 CRITERIA TEST RESULTS")
print("=" * 60)
print(f"Candidates tested: {min(200, len(candidates))} (of {len(candidates)} with vol/MA criteria)")
print()
for criteria, symbols in results.items():
    print(f"{criteria}: {len(symbols)} signals")
    if symbols:
        print(f"  Examples: {', '.join(symbols[:5])}")
print()
