#!/usr/bin/env python3
"""Quick test to see base range distribution."""
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
        LIMIT 500
    """, (target_date,))
    candidates = cur.fetchall()

print(f"Testing {len(candidates)} assets")

def get_base_stats(asset_id, base_days):
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
        return None
    
    recent = bars[-base_days:]
    high = max(float(b['high']) for b in recent)
    low = min(float(b['low']) for b in recent)
    base_range = (high - low) / low if low > 0 else None
    current_close = float(bars[-1]['close'])
    pct_from_high = (current_close - high) / high
    
    return {
        'base_range': base_range,
        'pct_from_high': pct_from_high,
        'high': high,
        'current': current_close
    }

base_ranges = []
print("\nChecking 100-day base ranges...")
for i, c in enumerate(candidates):
    stats = get_base_stats(c['asset_id'], 100)
    if stats:
        base_ranges.append({
            'symbol': c['symbol'],
            **stats
        })
    if (i + 1) % 100 == 0:
        print(f"  Checked {i + 1}/{len(candidates)}")

# Analyze distribution
ranges = [b['base_range'] for b in base_ranges if b['base_range']]
pct_from_highs = [b['pct_from_high'] for b in base_ranges if b['pct_from_high']]

print("\n" + "=" * 60)
print("100-DAY BASE RANGE DISTRIBUTION")
print("=" * 60)
print(f"Assets analyzed: {len(ranges)}")
print(f"\nBase Range (high-low)/low:")
print(f"  Min: {min(ranges)*100:.1f}%")
print(f"  Max: {max(ranges)*100:.1f}%")
print(f"  Median: {sorted(ranges)[len(ranges)//2]*100:.1f}%")
print(f"  < 15%: {sum(1 for r in ranges if r < 0.15)}")
print(f"  < 20%: {sum(1 for r in ranges if r < 0.20)}")
print(f"  < 25%: {sum(1 for r in ranges if r < 0.25)}")
print(f"  < 30%: {sum(1 for r in ranges if r < 0.30)}")

print(f"\nDistance from 100-day high:")
print(f"  At or above high (breakout): {sum(1 for p in pct_from_highs if p >= 0)}")
print(f"  Within 2% of high: {sum(1 for p in pct_from_highs if p >= -0.02)}")
print(f"  Within 5% of high: {sum(1 for p in pct_from_highs if p >= -0.05)}")

# Find tightest bases
tight_bases = sorted(base_ranges, key=lambda x: x['base_range'])[:10]
print(f"\nTightest 10 bases:")
for b in tight_bases:
    print(f"  {b['symbol']}: {b['base_range']*100:.1f}% range, {b['pct_from_high']*100:.1f}% from high")
