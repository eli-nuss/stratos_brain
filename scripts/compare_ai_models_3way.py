#!/usr/bin/env python3
"""
3-Way AI Model Comparison: GPT-5.2 vs Gemini 3 Flash vs Gemini 3 Pro
With enhanced context (more OHLCV bars and features).
"""

import os
import json
import sys
from pathlib import Path
from datetime import datetime

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from openai import OpenAI
import google.generativeai as genai

from src.stratos_engine.db import Database

# Load environment
from dotenv import load_dotenv
load_dotenv()

# Load prompts
PROMPT_DIR = Path(__file__).parent.parent / "src" / "stratos_engine" / "prompts"
SYSTEM_PROMPT = (PROMPT_DIR / "chart_review_system.txt").read_text()
OUTPUT_SCHEMA = json.loads((PROMPT_DIR / "chart_review_schema.json").read_text())


def get_target_signals(db: Database, as_of_date: str, config_id: str, n_bullish: int = 5, n_bearish: int = 5):
    """Get the top N bullish and bearish signals for comparison."""
    
    # Get top bullish
    bullish_query = """
    SELECT 
        asset_id, symbol, name, asset_type, universe_id, config_id,
        weighted_score, score_delta, new_signal_count, inflection_score, components,
        'inflections_bullish' as scope
    FROM v_dashboard_inflections
    WHERE as_of_date = %s AND config_id = %s::uuid AND inflection_direction = 'bullish'
    ORDER BY abs_inflection DESC
    LIMIT %s
    """
    bullish = db.fetch_all(bullish_query, (as_of_date, config_id, n_bullish))
    
    # Get top bearish
    bearish_query = """
    SELECT 
        asset_id, symbol, name, asset_type, universe_id, config_id,
        weighted_score, score_delta, new_signal_count, inflection_score, components,
        'inflections_bearish' as scope
    FROM v_dashboard_inflections
    WHERE as_of_date = %s AND config_id = %s::uuid AND inflection_direction = 'bearish'
    ORDER BY abs_inflection DESC
    LIMIT %s
    """
    bearish = db.fetch_all(bearish_query, (as_of_date, config_id, n_bearish))
    
    return bullish + bearish


def build_chart_packet(db: Database, target: dict, as_of_date: str) -> dict:
    """Build enhanced chart data packet with more context."""
    
    asset_id = target["asset_id"]
    scope = target["scope"]
    universe_id = str(target["universe_id"])
    
    packet = {
        "asset": {
            "asset_id": asset_id,
            "symbol": target.get("symbol"),
            "name": target.get("name"),
            "asset_type": target.get("asset_type"),
        },
        "context": {
            "scope": scope,
            "as_of_date": as_of_date,
            "universe_id": universe_id,
        },
        "ohlcv": [],
        "features": {},
        "signal_facts": [],
        "scores": {
            "weighted_score": target.get("weighted_score"),
            "score_delta": target.get("score_delta"),
            "new_signal_count": target.get("new_signal_count"),
            "inflection_score": target.get("inflection_score"),
            "components": target.get("components"),
        }
    }
    
    # Get OHLCV bars (last 45 days for more context)
    ohlcv_query = """
    SELECT date, open, high, low, close, volume
    FROM daily_bars
    WHERE asset_id = %s AND date <= %s
    ORDER BY date DESC
    LIMIT 45
    """
    bars = db.fetch_all(ohlcv_query, (asset_id, as_of_date))
    bars = list(reversed(bars))
    packet["ohlcv"] = [
        {
            "date": str(b["date"]),
            "open": float(b["open"]) if b["open"] else None,
            "high": float(b["high"]) if b["high"] else None,
            "low": float(b["low"]) if b["low"] else None,
            "close": float(b["close"]) if b["close"] else None,
            "volume": float(b["volume"]) if b["volume"] else None,
        }
        for b in bars
    ]
    
    # Get ALL daily features (enhanced context)
    features_query = """
    SELECT *
    FROM daily_features
    WHERE asset_id = %s AND date = %s
    """
    features = db.fetch_one(features_query, (asset_id, as_of_date))
    if features:
        # Include more features for better context
        key_features = [
            # Price
            "close", "open", "high", "low",
            # Moving averages
            "sma_20", "sma_50", "sma_200", "ema_21",
            # MA distances
            "ma_dist_20", "ma_dist_50", "ma_dist_200",
            # Momentum
            "rsi_14", "macd_histogram", "macd_signal",
            # Volatility
            "atr_pct", "bb_width", "bb_width_pctile", "bb_width_pctile_expanding",
            # Volume
            "dollar_volume_sma_20", "rvol_20", "volume_z_60", "obv_slope_20",
            # Donchian
            "donchian_high_20", "donchian_low_20", "donchian_high_55", "donchian_low_55",
            # Breakout flags
            "breakout_up_20", "breakout_down_20", "breakout_confirmed_up", "breakout_confirmed_down",
            # Squeeze
            "squeeze_on", "squeeze_pctile", "squeeze_fired",
            # Trend
            "rs_vs_benchmark", "trend_regime",
            # Drawdown
            "drawdown_63d", "drawdown_252d",
            # Coverage
            "coverage_252"
        ]
        packet["features"] = {
            k: (float(v) if isinstance(v, (int, float)) and v is not None else v)
            for k, v in features.items()
            if k in key_features and v is not None
        }
    
    # Get signal facts with full evidence
    facts_query = """
    SELECT signal_type, direction, strength, evidence
    FROM daily_signal_facts
    WHERE asset_id = %s AND date = %s
    """
    facts = db.fetch_all(facts_query, (asset_id, as_of_date))
    packet["signal_facts"] = [
        {
            "signal_type": f["signal_type"],
            "direction": f["direction"],
            "strength": f["strength"],
            "evidence": f["evidence"]
        }
        for f in facts
    ]
    
    return packet


def call_gpt(packet: dict, api_key: str) -> dict:
    """Call GPT-5.2 via OpenAI API."""
    
    client = OpenAI(api_key=api_key, base_url="https://api.openai.com/v1")
    
    user_content = json.dumps(packet, default=str)
    schema_hint = f"\n\nOutput JSON schema:\n{json.dumps(OUTPUT_SCHEMA, indent=2)}"
    full_system_prompt = SYSTEM_PROMPT + schema_hint
    
    try:
        response = client.chat.completions.create(
            model="gpt-5.2",
            messages=[
                {"role": "system", "content": full_system_prompt},
                {"role": "user", "content": user_content}
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_completion_tokens=2000,
        )
        
        content = response.choices[0].message.content
        result = json.loads(content)
        result["_tokens_in"] = response.usage.prompt_tokens if response.usage else 0
        result["_tokens_out"] = response.usage.completion_tokens if response.usage else 0
        result["_model"] = "gpt-5.2"
        return result
        
    except Exception as e:
        print(f"    GPT error: {e}")
        return None


def call_gemini(packet: dict, api_key: str, model_name: str) -> dict:
    """Call Gemini via native Google API."""
    
    genai.configure(api_key=api_key)
    
    model = genai.GenerativeModel(
        model_name=model_name,
        generation_config={
            "temperature": 0.2,
            "max_output_tokens": 4000,
            "response_mime_type": "application/json",
        }
    )
    
    user_content = json.dumps(packet, default=str)
    schema_hint = f"\n\nOutput JSON schema:\n{json.dumps(OUTPUT_SCHEMA, indent=2)}"
    full_prompt = SYSTEM_PROMPT + schema_hint + "\n\nChart Data:\n" + user_content
    
    try:
        response = model.generate_content(full_prompt)
        content = response.text
        result = json.loads(content)
        
        # Add token usage if available
        if hasattr(response, 'usage_metadata'):
            result["_tokens_in"] = response.usage_metadata.prompt_token_count
            result["_tokens_out"] = response.usage_metadata.candidates_token_count
        
        result["_model"] = model_name
        return result
        
    except Exception as e:
        print(f"    {model_name} error: {e}")
        return None


def main():
    print("=" * 120)
    print("3-WAY AI MODEL COMPARISON: GPT-5.2 vs Gemini 3 Flash vs Gemini 3 Pro")
    print("=" * 120)
    
    # Configuration
    as_of_date = "2026-01-02"
    config_id = "6a6cd5d6-1f43-475b-a0e7-2fe6fdffe714"
    
    # API keys
    openai_key = os.environ.get("OPENAI_API_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY")
    
    if not openai_key:
        print("ERROR: OPENAI_API_KEY not set")
        return
    if not gemini_key:
        print("ERROR: GEMINI_API_KEY not set")
        return
    
    print(f"\nOpenAI Key: {openai_key[:20]}...")
    print(f"Gemini Key: {gemini_key[:20]}...")
    
    # Connect to database
    db = Database()
    
    # Get target signals
    print("\n1. Fetching target signals...")
    targets = get_target_signals(db, as_of_date, config_id, n_bullish=5, n_bearish=5)
    print(f"   Found {len(targets)} signals to analyze")
    
    for t in targets:
        print(f"   - {t['symbol']} ({t['scope']})")
    
    # Build packets for all targets (with enhanced context)
    print("\n2. Building enhanced chart packets...")
    packets = {}
    for target in targets:
        symbol = target["symbol"]
        packets[symbol] = build_chart_packet(db, target, as_of_date)
        n_features = len(packets[symbol]['features'])
        print(f"   - {symbol}: {len(packets[symbol]['ohlcv'])} bars, {n_features} features, {len(packets[symbol]['signal_facts'])} signals")
    
    # Run GPT-5.2
    print("\n3. Running GPT-5.2 reviews...")
    gpt_results = {}
    for target in targets:
        symbol = target["symbol"]
        print(f"   Processing {symbol}...")
        gpt_results[symbol] = call_gpt(packets[symbol], openai_key)
        if gpt_results[symbol]:
            print(f"     ✓ {gpt_results[symbol].get('attention_level')} / {gpt_results[symbol].get('direction')} / conf={gpt_results[symbol].get('confidence')}")
        else:
            print(f"     ✗ Failed")
    
    # Run Gemini 3 Flash
    print("\n4. Running Gemini 3 Flash Preview reviews...")
    gemini_flash_results = {}
    for target in targets:
        symbol = target["symbol"]
        print(f"   Processing {symbol}...")
        gemini_flash_results[symbol] = call_gemini(packets[symbol], gemini_key, "gemini-3-flash-preview")
        if gemini_flash_results[symbol]:
            print(f"     ✓ {gemini_flash_results[symbol].get('attention_level')} / {gemini_flash_results[symbol].get('direction')} / conf={gemini_flash_results[symbol].get('confidence')}")
        else:
            print(f"     ✗ Failed")
    
    # Run Gemini 3 Pro
    print("\n5. Running Gemini 3 Pro Preview reviews...")
    gemini_pro_results = {}
    for target in targets:
        symbol = target["symbol"]
        print(f"   Processing {symbol}...")
        gemini_pro_results[symbol] = call_gemini(packets[symbol], gemini_key, "gemini-3-pro-preview")
        if gemini_pro_results[symbol]:
            print(f"     ✓ {gemini_pro_results[symbol].get('attention_level')} / {gemini_pro_results[symbol].get('direction')} / conf={gemini_pro_results[symbol].get('confidence')}")
        else:
            print(f"     ✗ Failed")
    
    db.close()
    
    # Save full results
    output = {
        "comparison_date": datetime.now().isoformat(),
        "as_of_date": as_of_date,
        "targets": [{"symbol": t["symbol"], "scope": t["scope"]} for t in targets],
        "gpt_5_2_results": gpt_results,
        "gemini_3_flash_results": gemini_flash_results,
        "gemini_3_pro_results": gemini_pro_results
    }
    
    output_path = Path(__file__).parent.parent / "ai_model_comparison_3way.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2, default=str)
    
    print(f"\n6. Full results saved to {output_path}")
    
    # Print comparison table
    print("\n" + "=" * 120)
    print("SIDE-BY-SIDE COMPARISON")
    print("=" * 120)
    
    for target in targets:
        symbol = target["symbol"]
        scope = target["scope"]
        
        gpt = gpt_results.get(symbol)
        flash = gemini_flash_results.get(symbol)
        pro = gemini_pro_results.get(symbol)
        
        print(f"\n{'─'*120}")
        print(f"│ {symbol} ({scope})")
        print(f"{'─'*120}")
        print(f"│ {'Field':<18} │ {'GPT-5.2':<28} │ {'Gemini 3 Flash':<28} │ {'Gemini 3 Pro':<28} │")
        print(f"{'─'*120}")
        
        fields = ['attention_level', 'direction', 'setup_type', 'confidence', 'time_horizon']
        for field in fields:
            gpt_val = str(gpt.get(field, 'N/A'))[:28] if gpt else 'FAILED'
            flash_val = str(flash.get(field, 'N/A'))[:28] if flash else 'FAILED'
            pro_val = str(pro.get(field, 'N/A'))[:28] if pro else 'FAILED'
            print(f"│ {field:<18} │ {gpt_val:<28} │ {flash_val:<28} │ {pro_val:<28} │")
        
        print(f"{'─'*120}")
        
        # Summary
        print(f"│ Summary:")
        if gpt:
            print(f"│   GPT:   {gpt.get('summary_text', 'N/A')[:100]}")
        if flash:
            print(f"│   Flash: {flash.get('summary_text', 'N/A')[:100]}")
        if pro:
            print(f"│   Pro:   {pro.get('summary_text', 'N/A')[:100]}")
        
        # Why Now (first 2 bullets each)
        print(f"│ Why Now (first 2):")
        if gpt and gpt.get('why_now'):
            for i, bullet in enumerate(gpt.get('why_now', [])[:2], 1):
                print(f"│   GPT {i}: {bullet[:95]}...")
        if flash and flash.get('why_now'):
            for i, bullet in enumerate(flash.get('why_now', [])[:2], 1):
                print(f"│   Flash {i}: {bullet[:95]}...")
        if pro and pro.get('why_now'):
            for i, bullet in enumerate(pro.get('why_now', [])[:2], 1):
                print(f"│   Pro {i}: {bullet[:95]}...")
    
    print("\n" + "=" * 120)
    
    # Summary stats
    print("OVERALL COMPARISON")
    print("=" * 120)
    
    # Success rates
    gpt_success = sum(1 for r in gpt_results.values() if r)
    flash_success = sum(1 for r in gemini_flash_results.values() if r)
    pro_success = sum(1 for r in gemini_pro_results.values() if r)
    
    print(f"\nSuccess Rates:")
    print(f"  GPT-5.2:          {gpt_success}/10 ({100*gpt_success/10:.0f}%)")
    print(f"  Gemini 3 Flash:   {flash_success}/10 ({100*flash_success/10:.0f}%)")
    print(f"  Gemini 3 Pro:     {pro_success}/10 ({100*pro_success/10:.0f}%)")
    
    # Attention distribution
    gpt_attention = {}
    flash_attention = {}
    pro_attention = {}
    
    for symbol in [t['symbol'] for t in targets]:
        if gpt_results.get(symbol):
            att = gpt_results[symbol].get('attention_level', 'N/A')
            gpt_attention[att] = gpt_attention.get(att, 0) + 1
        if gemini_flash_results.get(symbol):
            att = gemini_flash_results[symbol].get('attention_level', 'N/A')
            flash_attention[att] = flash_attention.get(att, 0) + 1
        if gemini_pro_results.get(symbol):
            att = gemini_pro_results[symbol].get('attention_level', 'N/A')
            pro_attention[att] = pro_attention.get(att, 0) + 1
    
    print(f"\nAttention Level Distribution:")
    print(f"  GPT-5.2:          {gpt_attention}")
    print(f"  Gemini 3 Flash:   {flash_attention}")
    print(f"  Gemini 3 Pro:     {pro_attention}")
    
    # Confidence comparison
    gpt_conf = [gpt_results.get(t['symbol'], {}).get('confidence', 0) or 0 for t in targets]
    flash_conf = [gemini_flash_results.get(t['symbol'], {}).get('confidence', 0) or 0 for t in targets]
    pro_conf = [gemini_pro_results.get(t['symbol'], {}).get('confidence', 0) or 0 for t in targets]
    
    print(f"\nAverage Confidence:")
    print(f"  GPT-5.2:          {sum(gpt_conf)/len(gpt_conf):.2f}")
    print(f"  Gemini 3 Flash:   {sum(flash_conf)/len(flash_conf):.2f}")
    print(f"  Gemini 3 Pro:     {sum(pro_conf)/len(pro_conf):.2f}")
    
    # Why Now bullet counts
    gpt_bullets = [len(gpt_results.get(t['symbol'], {}).get('why_now', []) or []) for t in targets]
    flash_bullets = [len(gemini_flash_results.get(t['symbol'], {}).get('why_now', []) or []) for t in targets]
    pro_bullets = [len(gemini_pro_results.get(t['symbol'], {}).get('why_now', []) or []) for t in targets]
    
    print(f"\nAverage Why Now Bullets:")
    print(f"  GPT-5.2:          {sum(gpt_bullets)/len(gpt_bullets):.1f}")
    print(f"  Gemini 3 Flash:   {sum(flash_bullets)/len(flash_bullets):.1f}")
    print(f"  Gemini 3 Pro:     {sum(pro_bullets)/len(pro_bullets):.1f}")
    
    print("\n" + "=" * 120)


if __name__ == "__main__":
    main()
