#!/usr/bin/env python3
"""Test the v3 prompting on a few assets to check direction/quality independence."""

import os
import sys
import json
import asyncio
import aiohttp

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
from stratos_engine.db import Database

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
MODEL_NAME = "gemini-3-pro-preview"

def get_ohlcv_data(db, asset_id: int, as_of_date: str) -> list:
    query = """
    SELECT date, open, high, low, close, volume
    FROM daily_bars
    WHERE asset_id = %s AND date <= %s
    ORDER BY date DESC
    LIMIT 60
    """
    bars = db.fetch_all(query, (asset_id, as_of_date))
    return list(reversed(bars)) if bars else []

def get_features(db, asset_id: int, as_of_date: str) -> dict:
    query = """
    SELECT sma_20, sma_50, sma_200, ma_dist_20, rsi_14, macd_histogram,
           bb_width, atr_pct, return_1d, return_5d, return_21d, rvol_20, trend_regime
    FROM daily_features
    WHERE asset_id = %s AND date = %s
    """
    row = db.fetch_one(query, (asset_id, as_of_date))
    if row:
        return {k: float(v) if v is not None and isinstance(v, (int, float)) else v 
                for k, v in dict(row).items() if v is not None}
    return {}

def build_prompt(symbol: str, name: str, bars: list, features: dict) -> str:
    if not bars:
        return None
    
    current_price = float(bars[-1]['close'])
    
    ohlcv_lines = [f"{b['date']},{b['open']},{b['high']},{b['low']},{b['close']},{b['volume']}" for b in bars]
    ohlcv_text = "\n".join(ohlcv_lines)
    
    features_text = ""
    if features:
        features_lines = [f"  {k}: {v:.4f}" if isinstance(v, float) else f"  {k}: {v}" for k, v in features.items()]
        features_text = "\nTECHNICAL INDICATORS:\n" + "\n".join(features_lines)
    
    prompt = f"""You are a professional technical analyst. Analyze this cryptocurrency chart and return a JSON assessment.

[CRITICAL INDEPENDENCE MANDATE]
You MUST evaluate TWO SEPARATE dimensions:
1. DIRECTION: Where is price likely to go? (bullish/bearish conviction)
2. QUALITY: How clean and tradeable is the chart structure? (INDEPENDENT of direction!)

IMPORTANT RULES:
- A BEARISH asset with a clean breakdown pattern MUST have HIGH quality (80+)
- A BULLISH asset with a messy chart MUST have LOW quality (below 50)
- Quality measures STRUCTURAL CLARITY, not directional conviction
- Quality = How easy is it to define entry, stop-loss, and targets?

ASSET: {symbol} ({name})
CURRENT PRICE: {current_price}

OHLCV DATA (Date,Open,High,Low,Close,Volume):
{ohlcv_text}
{features_text}

TASK 1 - DIRECTIONAL ANALYSIS:
Evaluate the probability and magnitude of price movement. Score from -100 (max bearish) to +100 (max bullish).

TASK 2 - STRUCTURAL QUALITY (Direction-Agnostic):
Evaluate the chart's structural integrity and tradability. This is INDEPENDENT of direction.
- Boundary Definition: How precisely defined are support/resistance levels?
- Structural Compliance: Does the pattern conform to textbook technical analysis?
- Volatility Profile: Is price action clean or choppy/noisy?
- Volume Coherence: Does volume confirm the pattern?
- Risk-Reward Clarity: How easy is it to place a logical stop-loss?

Return ONLY a valid JSON object with this exact structure:
{{
  "direction": "bullish" or "bearish" or "neutral",
  "ai_direction_score": integer from -100 to +100 (directional conviction only),
  "ai_setup_quality_score": integer from 0 to 100 (structural quality only - INDEPENDENT of direction!),
  "setup_type": "breakout" or "reversal" or "continuation" or "range",
  "attention_level": "URGENT" or "FOCUS" or "WATCH" or "IGNORE",
  "confidence": float from 0.0 to 1.0,
  "summary_text": "Brief technical analysis",
  "subscores": {{
    "boundary_definition": integer 0-5,
    "structural_compliance": integer 0-5,
    "volatility_profile": integer 0-5,
    "volume_coherence": integer 0-5,
    "risk_reward_clarity": integer 0-5
  }}
}}

EXAMPLES OF CORRECT SCORING:
- Bearish (-85) + High Quality (90): Clean head-and-shoulders breakdown
- Bullish (+80) + Low Quality (35): Strong momentum but messy chart
- Neutral (0) + High Quality (80): Clean range consolidation

Return ONLY the JSON object."""

    return prompt


async def call_api(session, prompt):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent"
    headers = {"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 4096, "responseMimeType": "application/json"}
    }
    
    try:
        async with session.post(url, headers=headers, json=payload, timeout=60) as response:
            if response.status == 200:
                data = await response.json()
                if data.get("candidates") and data["candidates"][0].get("content"):
                    parts = data["candidates"][0]["content"].get("parts", [])
                    if parts and parts[0].get("text"):
                        return json.loads(parts[0]["text"])
    except Exception as e:
        print(f"API error: {e}")
    return None


async def main():
    as_of_date = "2026-01-04"
    db = Database()
    
    # Test on diverse assets
    test_symbols = ['BTC', 'ETH', 'PEPE', 'TRUMP', 'XRP', 'DOGE', 'SOL', 'ADA', 'SHIB', 'AVAX']
    
    test_assets = db.fetch_all(f'''
        SELECT a.asset_id, a.symbol, a.name
        FROM assets a
        WHERE a.asset_type = 'crypto' AND a.is_active = true
        AND a.symbol IN ({','.join([f"'{s}'" for s in test_symbols])})
    ''')
    
    print(f"Testing v3 prompting on {len(test_assets)} assets...\n")
    
    results = []
    async with aiohttp.ClientSession() as session:
        for asset in test_assets:
            asset_id = asset['asset_id']
            symbol = asset['symbol']
            name = asset['name']
            
            bars = get_ohlcv_data(db, asset_id, as_of_date)
            features = get_features(db, asset_id, as_of_date)
            
            if not bars:
                print(f"{symbol}: No data")
                continue
            
            prompt = build_prompt(symbol, name, bars, features)
            result = await call_api(session, prompt)
            
            if result:
                dir_score = result.get('ai_direction_score', 0)
                qual_score = result.get('ai_setup_quality_score', 0)
                direction = result.get('direction', 'unknown')
                subscores = result.get('subscores', {})
                
                print(f"{symbol}: dir={dir_score:+d}, qual={qual_score}, {direction}")
                print(f"  subscores: {subscores}")
                
                results.append({
                    'symbol': symbol,
                    'dir_score': dir_score,
                    'qual_score': qual_score,
                    'direction': direction
                })
            else:
                print(f"{symbol}: API failed")
    
    # Calculate correlation
    if len(results) >= 5:
        import numpy as np
        dir_scores = [r['dir_score'] for r in results]
        qual_scores = [r['qual_score'] for r in results]
        
        corr = np.corrcoef(dir_scores, qual_scores)[0,1]
        abs_corr = np.corrcoef([abs(d) for d in dir_scores], qual_scores)[0,1]
        
        print(f"\n{'='*50}")
        print(f"CORRELATION ANALYSIS (n={len(results)}):")
        print(f"  Direction vs Quality: {corr:.3f}")
        print(f"  |Direction| vs Quality: {abs_corr:.3f}")
        print(f"  (Target: closer to 0 is better)")
        
        # Check for bearish with high quality
        bearish_high_qual = [r for r in results if r['dir_score'] < 0 and r['qual_score'] > 70]
        bullish_low_qual = [r for r in results if r['dir_score'] > 0 and r['qual_score'] < 50]
        
        print(f"\n  Bearish with high quality (>70): {len(bearish_high_qual)}")
        print(f"  Bullish with low quality (<50): {len(bullish_low_qual)}")


if __name__ == "__main__":
    if not GEMINI_API_KEY:
        print("Error: GEMINI_API_KEY not set")
        sys.exit(1)
    asyncio.run(main())
