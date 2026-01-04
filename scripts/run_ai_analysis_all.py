#!/usr/bin/env python3
"""
Run AI analysis on all crypto assets that need review.
Uses the same context and methodology as the production pipeline.
"""

import os
import sys
import json
import time
import hashlib
from datetime import datetime

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

import google.generativeai as genai
import psycopg2
from psycopg2.extras import RealDictCursor

# Configuration
GEMINI_API_KEY = "AIzaSyAHg70im-BbB9HYZm7TOzr3cKRQp7RWY1Q"
MODEL_NAME = "gemini-2.5-pro"  # Using gemini-2.5-pro (latest pro model)
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres")
CONFIG_ID = "6a6cd5d6-1f43-475b-a0e7-2fe6fdffe714"
UNIVERSE_ID = "crypto_top200"
AS_OF_DATE = "2026-01-03"

# Initialize Gemini
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel(MODEL_NAME)

def get_db_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

def get_all_assets_with_signals(conn, as_of_date, asset_type='crypto'):
    """Get all assets that have signals for the date."""
    query = """
    SELECT DISTINCT 
        a.asset_id,
        a.symbol,
        a.name
    FROM daily_signal_facts dsf
    JOIN assets a ON dsf.asset_id = a.asset_id
    WHERE dsf.date = %s
      AND a.asset_type = %s
      AND dsf.config_id = %s
    ORDER BY a.symbol
    """
    with conn.cursor() as cur:
        cur.execute(query, (as_of_date, asset_type, CONFIG_ID))
        return cur.fetchall()

def get_asset_context(conn, asset_id, as_of_date):
    """Get full context for AI analysis."""
    # Get OHLCV data (365 days)
    ohlcv_query = """
    SELECT date, open, high, low, close, volume
    FROM daily_bars
    WHERE asset_id = %s AND date <= %s
    ORDER BY date DESC
    LIMIT 365
    """
    
    # Get daily features
    features_query = """
    SELECT *
    FROM daily_features
    WHERE asset_id = %s AND date = %s
    """
    
    # Get signals
    signals_query = """
    SELECT signal_type, direction, strength, weight, evidence, strength_components
    FROM daily_signal_facts
    WHERE asset_id = %s AND date = %s AND config_id = %s
    """
    
    with conn.cursor() as cur:
        cur.execute(ohlcv_query, (asset_id, as_of_date))
        ohlcv = cur.fetchall()
        
        cur.execute(features_query, (asset_id, as_of_date))
        features = cur.fetchone()
        
        cur.execute(signals_query, (asset_id, as_of_date, CONFIG_ID))
        signals = cur.fetchall()
    
    return {
        'ohlcv': ohlcv,
        'features': features,
        'signals': signals
    }

def build_prompt(asset, context):
    """Build the AI analysis prompt."""
    ohlcv_summary = []
    for row in context['ohlcv'][:30]:  # Last 30 days for summary
        ohlcv_summary.append(f"{row['date']}: O={row['open']:.4f} H={row['high']:.4f} L={row['low']:.4f} C={row['close']:.4f} V={row['volume']:.0f}")
    
    signals_text = []
    for sig in context['signals']:
        signals_text.append(f"- {sig['signal_type']} ({sig['direction']}): strength={sig['strength']}, weight={sig['weight']}")
    
    features = context['features'] or {}
    
    prompt = f"""You are an expert technical analyst. Analyze {asset['symbol']} ({asset['name']}) and provide a trading assessment.

## Recent Price Data (Last 30 days):
{chr(10).join(ohlcv_summary)}

## Active Signals:
{chr(10).join(signals_text) if signals_text else "No active signals"}

## Key Technical Indicators:
- RSI(14): {features.get('rsi_14', 'N/A')}
- MACD Histogram: {features.get('macd_histogram', 'N/A')}
- Trend Regime: {features.get('trend_regime', 'N/A')}
- Above MA200: {features.get('above_ma200', 'N/A')}
- MA Distance (50): {features.get('ma_dist_50', 'N/A')}
- Relative Volume: {features.get('rvol_20', 'N/A')}
- ATR%: {features.get('atr_pct', 'N/A')}

Provide your analysis in the following JSON format:
{{
    "attention": "URGENT|FOCUS|WATCH|IGNORE",
    "direction": "bullish|bearish|neutral",
    "setup_type": "breakout|reversal|continuation|breakdown|range|mean_reversion|unclear",
    "confidence": 50-100,
    "summary": "One sentence summary of the setup",
    "entry_low": price,
    "entry_high": price,
    "target_1": price,
    "target_2": price,
    "target_3": price,
    "invalidation": price,
    "support_1": price,
    "support_2": price,
    "support_3": price,
    "resistance_1": price,
    "resistance_2": price,
    "resistance_3": price
}}

Return ONLY the JSON object, no other text."""

    return prompt

def parse_ai_response(response_text):
    """Parse the AI response JSON."""
    try:
        # Clean up response
        text = response_text.strip()
        if text.startswith('```json'):
            text = text[7:]
        if text.startswith('```'):
            text = text[3:]
        if text.endswith('```'):
            text = text[:-3]
        return json.loads(text.strip())
    except json.JSONDecodeError as e:
        print(f"  Failed to parse JSON: {e}")
        return None

def save_ai_review(conn, asset_id, as_of_date, analysis):
    """Save the AI review to the database using the correct table structure."""
    # Generate input hash
    input_hash = hashlib.md5(f"{asset_id}_{as_of_date}_v3.2".encode()).hexdigest()
    
    # Build entry JSON
    entry = {
        "low": analysis.get('entry_low'),
        "high": analysis.get('entry_high')
    }
    
    # Build targets JSON
    targets = [
        analysis.get('target_1'),
        analysis.get('target_2'),
        analysis.get('target_3')
    ]
    targets = [t for t in targets if t is not None]
    
    # Build support JSON
    support = [
        analysis.get('support_1'),
        analysis.get('support_2'),
        analysis.get('support_3')
    ]
    support = [s for s in support if s is not None]
    
    # Build resistance JSON
    resistance = [
        analysis.get('resistance_1'),
        analysis.get('resistance_2'),
        analysis.get('resistance_3')
    ]
    resistance = [r for r in resistance if r is not None]
    
    # Determine source_scope based on direction
    direction = analysis.get('direction', 'neutral')
    if direction == 'bullish':
        source_scope = 'inflections_bullish'
    elif direction == 'bearish':
        source_scope = 'inflections_bearish'
    else:
        source_scope = 'inflections_bullish'  # Default
    
    # Validate setup_type
    valid_setup_types = ['breakout', 'reversal', 'continuation', 'breakdown', 'range', 'mean_reversion', 'unclear']
    setup_type = analysis.get('setup_type', 'unclear')
    if setup_type not in valid_setup_types:
        setup_type = 'unclear'
    
    query = """
    INSERT INTO asset_ai_reviews (
        asset_id, as_of_date, universe_id, config_id, model,
        attention_level, direction, setup_type, confidence, summary_text,
        entry, targets, invalidation, support, resistance,
        prompt_version, review_json, source_scope, scope, input_hash, created_at
    ) VALUES (
        %s, %s, %s, %s, %s,
        %s, %s, %s, %s, %s,
        %s, %s, %s, %s, %s,
        %s, %s, %s, %s, %s, NOW()
    )
    ON CONFLICT (asset_id, as_of_date, prompt_version) 
    DO UPDATE SET
        model = EXCLUDED.model,
        attention_level = EXCLUDED.attention_level,
        direction = EXCLUDED.direction,
        setup_type = EXCLUDED.setup_type,
        confidence = EXCLUDED.confidence,
        summary_text = EXCLUDED.summary_text,
        entry = EXCLUDED.entry,
        targets = EXCLUDED.targets,
        invalidation = EXCLUDED.invalidation,
        support = EXCLUDED.support,
        resistance = EXCLUDED.resistance,
        review_json = EXCLUDED.review_json,
        input_hash = EXCLUDED.input_hash,
        updated_at = NOW()
    """
    
    with conn.cursor() as cur:
        cur.execute(query, (
            asset_id, as_of_date, UNIVERSE_ID, CONFIG_ID, MODEL_NAME,
            analysis.get('attention', 'WATCH'),
            direction,
            setup_type,
            analysis.get('confidence', 50),
            analysis.get('summary', ''),
            json.dumps(entry),
            json.dumps(targets),
            analysis.get('invalidation'),
            json.dumps(support),
            json.dumps(resistance),
            'v3.2',
            json.dumps(analysis),
            source_scope,
            'inflections',  # scope column
            input_hash
        ))
    conn.commit()

def main():
    print("=" * 60, flush=True)
    print("AI ANALYSIS - CRYPTO ASSETS", flush=True)
    print(f"Date: {AS_OF_DATE}", flush=True)
    print(f"Model: {MODEL_NAME}", flush=True)
    print("=" * 60, flush=True)
    
    conn = get_db_connection()
    
    # Get ALL assets with signals
    assets = get_all_assets_with_signals(conn, AS_OF_DATE, 'crypto')
    print(f"\nFound {len(assets)} assets with signals to analyze", flush=True)
    
    if not assets:
        print("No assets to analyze. Exiting.")
        conn.close()
        return
    
    # Process each asset
    success_count = 0
    error_count = 0
    
    for i, asset in enumerate(assets):
        print(f"\n[{i+1}/{len(assets)}] Analyzing {asset['symbol']} ({asset['name']})...", flush=True)
        
        try:
            # Get context
            context = get_asset_context(conn, asset['asset_id'], AS_OF_DATE)
            
            if not context['ohlcv']:
                print(f"  Skipping - no OHLCV data")
                continue
            
            # Build prompt and get AI response
            prompt = build_prompt(asset, context)
            response = model.generate_content(prompt)
            
            # Parse response
            analysis = parse_ai_response(response.text)
            
            if analysis:
                # Save to database
                save_ai_review(conn, asset['asset_id'], AS_OF_DATE, analysis)
                print(f"  ✓ {analysis.get('attention', 'WATCH')} - {analysis.get('direction', 'neutral')} - {analysis.get('summary', '')[:50]}...")
                success_count += 1
            else:
                print(f"  ✗ Failed to parse response")
                error_count += 1
            
            # Rate limiting - be gentle with the API
            time.sleep(3)
            
        except Exception as e:
            print(f"  ✗ Error: {str(e)[:100]}")
            error_count += 1
            # Rollback the transaction on error
            conn.rollback()
            time.sleep(5)
    
    print("\n" + "=" * 60)
    print(f"COMPLETE: {success_count} successful, {error_count} errors")
    print("=" * 60)
    
    conn.close()

if __name__ == "__main__":
    main()
