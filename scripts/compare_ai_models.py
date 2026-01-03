#!/usr/bin/env python3
"""
Compare GPT-5.2 and Gemini 3 Flash AI reviews on the same signals.
Uses native APIs for each model.
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
    """Build chart data packet for a target asset."""
    
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
    
    # Get OHLCV bars (last 60 days)
    ohlcv_query = """
    SELECT date, open, high, low, close, volume
    FROM daily_bars
    WHERE asset_id = %s AND date <= %s
    ORDER BY date DESC
    LIMIT 30
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
    
    # Get daily features
    features_query = """
    SELECT *
    FROM daily_features
    WHERE asset_id = %s AND date = %s
    """
    features = db.fetch_one(features_query, (asset_id, as_of_date))
    if features:
        key_features = [
            "close", "dollar_volume_sma_20", "rs_vs_benchmark",
            "atr_pct", "bb_width", "rsi_14", "macd_histogram",
            "sma_20", "sma_50", "sma_200", "ema_21",
            "squeeze_on", "squeeze_pctile", "coverage_252"
        ]
        packet["features"] = {
            k: float(v) if v is not None and k in key_features else v
            for k, v in features.items()
            if k in key_features and v is not None
        }
    
    # Get signal facts
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
            max_completion_tokens=1500,
        )
        
        content = response.choices[0].message.content
        result = json.loads(content)
        result["_tokens_in"] = response.usage.prompt_tokens if response.usage else 0
        result["_tokens_out"] = response.usage.completion_tokens if response.usage else 0
        return result
        
    except Exception as e:
        print(f"    GPT error: {e}")
        return None


def call_gemini(packet: dict, api_key: str) -> dict:
    """Call Gemini 3 Flash via native Google API."""
    
    genai.configure(api_key=api_key)
    
    # Use Gemini 2.0 Flash (latest available)
    model = genai.GenerativeModel(
        model_name="gemini-3-flash-preview",
        generation_config={
            "temperature": 0.2,
            "max_output_tokens": 3000,
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
        
        return result
        
    except Exception as e:
        print(f"    Gemini error: {e}")
        return None


def main():
    print("=" * 80)
    print("AI Model Comparison: GPT-5.2 vs Gemini 3 Flash")
    print("=" * 80)
    
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
    
    # Build packets for all targets
    print("\n2. Building chart packets...")
    packets = {}
    for target in targets:
        symbol = target["symbol"]
        packets[symbol] = build_chart_packet(db, target, as_of_date)
        print(f"   - {symbol}: {len(packets[symbol]['ohlcv'])} bars, {len(packets[symbol]['signal_facts'])} signals")
    
    # Run GPT-5.2
    print("\n3. Running GPT-5.2 reviews...")
    gpt_results = {}
    for target in targets:
        symbol = target["symbol"]
        print(f"   Processing {symbol}...")
        gpt_results[symbol] = call_gpt(packets[symbol], openai_key)
        if gpt_results[symbol]:
            print(f"     ✓ {gpt_results[symbol].get('attention_level')} / {gpt_results[symbol].get('direction')}")
        else:
            print(f"     ✗ Failed")
    
    # Run Gemini
    print("\n4. Running Gemini 2.0 Flash reviews...")
    gemini_results = {}
    for target in targets:
        symbol = target["symbol"]
        print(f"   Processing {symbol}...")
        gemini_results[symbol] = call_gemini(packets[symbol], gemini_key)
        if gemini_results[symbol]:
            print(f"     ✓ {gemini_results[symbol].get('attention_level')} / {gemini_results[symbol].get('direction')}")
        else:
            print(f"     ✗ Failed")
    
    db.close()
    
    # Save full results
    output = {
        "comparison_date": datetime.now().isoformat(),
        "as_of_date": as_of_date,
        "targets": [{"symbol": t["symbol"], "scope": t["scope"]} for t in targets],
        "gpt_5_2_results": gpt_results,
        "gemini_results": gemini_results
    }
    
    output_path = Path(__file__).parent.parent / "ai_model_comparison.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2, default=str)
    
    print(f"\n5. Full results saved to {output_path}")
    
    # Print comparison table
    print("\n" + "=" * 100)
    print("SIDE-BY-SIDE COMPARISON")
    print("=" * 100)
    
    for target in targets:
        symbol = target["symbol"]
        scope = target["scope"]
        
        gpt = gpt_results.get(symbol)
        gem = gemini_results.get(symbol)
        
        print(f"\n{'─'*100}")
        print(f"│ {symbol} ({scope})")
        print(f"{'─'*100}")
        print(f"│ {'Field':<20} │ {'GPT-5.2':<35} │ {'Gemini 2.0 Flash':<35} │")
        print(f"{'─'*100}")
        
        fields = ['attention_level', 'direction', 'setup_type', 'confidence', 'time_horizon']
        for field in fields:
            gpt_val = str(gpt.get(field, 'N/A'))[:35] if gpt else 'FAILED'
            gem_val = str(gem.get(field, 'N/A'))[:35] if gem else 'FAILED'
            print(f"│ {field:<20} │ {gpt_val:<35} │ {gem_val:<35} │")
        
        print(f"{'─'*100}")
        
        # Summary
        print(f"│ Summary:")
        if gpt:
            print(f"│   GPT: {gpt.get('summary_text', 'N/A')[:90]}")
        if gem:
            print(f"│   GEM: {gem.get('summary_text', 'N/A')[:90]}")
        
        # Why Now
        print(f"│ Why Now:")
        if gpt and gpt.get('why_now'):
            for i, bullet in enumerate(gpt.get('why_now', [])[:3], 1):
                print(f"│   GPT {i}: {bullet[:85]}...")
        if gem and gem.get('why_now'):
            for i, bullet in enumerate(gem.get('why_now', [])[:3], 1):
                print(f"│   GEM {i}: {bullet[:85]}...")
    
    print("\n" + "=" * 100)
    
    # Summary stats
    gpt_success = sum(1 for r in gpt_results.values() if r)
    gem_success = sum(1 for r in gemini_results.values() if r)
    
    print(f"\nSUMMARY:")
    print(f"  GPT-5.2 success rate: {gpt_success}/{len(targets)} ({100*gpt_success/len(targets):.0f}%)")
    print(f"  Gemini success rate: {gem_success}/{len(targets)} ({100*gem_success/len(targets):.0f}%)")
    
    print("\n" + "=" * 100)


if __name__ == "__main__":
    main()
