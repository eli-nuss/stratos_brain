#!/usr/bin/env python3
"""Test script to see raw Gemini API response."""

import os
import sys
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from stratos_engine.db import Database
from google import genai
from google.genai import types

# Initialize
gemini_key = os.environ.get('GEMINI_API_KEY')
client = genai.Client(api_key=gemini_key)
model_name = "gemini-3-pro-preview"

db = Database()

# Get one crypto asset
query = """
SELECT a.asset_id, a.symbol, a.name, a.asset_type
FROM assets a
JOIN daily_bars db ON a.asset_id = db.asset_id
WHERE a.asset_type = 'crypto' AND a.symbol = 'BTC'
AND db.date = '2026-01-04'
LIMIT 1
"""
asset = db.fetch_one(query)
print(f"Asset: {asset}")

# Get OHLCV data
ohlcv_query = """
SELECT date, open, high, low, close, volume
FROM daily_bars
WHERE asset_id = %s AND date <= '2026-01-04'
ORDER BY date DESC
LIMIT 60
"""
bars = db.fetch_all(ohlcv_query, (asset['asset_id'],))
bars = list(reversed(bars))

# Format OHLCV
ohlcv_lines = []
for b in bars[-30:]:  # Last 30 bars only for shorter prompt
    ohlcv_lines.append(f"{b['date']},{b['open']},{b['high']},{b['low']},{b['close']},{b['volume']}")
ohlcv_text = "\n".join(ohlcv_lines)

current_price = float(bars[-1]['close'])

# Simple prompt
prompt = f"""Analyze this cryptocurrency and return a JSON object.

ASSET: BTC (Bitcoin)
CURRENT PRICE: {current_price}

OHLCV DATA (last 30 days):
{ohlcv_text}

Return this exact JSON structure:
{{
  "direction": "bullish" or "bearish" or "neutral",
  "ai_direction_score": -100 to +100,
  "setup_type": "breakout" or "reversal" or "continuation" or "range",
  "attention_level": "URGENT" or "FOCUS" or "WATCH",
  "confidence": 0.0 to 1.0,
  "summary_text": "2-3 sentence analysis",
  "key_levels": {{
    "support": [price1, price2],
    "resistance": [price1, price2],
    "invalidation": price
  }}
}}

Return ONLY the JSON, nothing else."""

print(f"\n=== PROMPT ===\n{prompt[:500]}...\n")

# Make API call
response = client.models.generate_content(
    model=model_name,
    contents=[
        types.Content(
            role="user",
            parts=[types.Part(text=prompt)]
        )
    ],
    config=types.GenerateContentConfig(
        temperature=0.1,
        max_output_tokens=8192,
    )
)

print(f"\n=== RAW RESPONSE OBJECT ===")
print(f"Response type: {type(response)}")
print(f"Candidates: {response.candidates if response else 'None'}")

if response and response.candidates:
    for i, candidate in enumerate(response.candidates):
        print(f"\nCandidate {i}:")
        print(f"  Content: {candidate.content}")
        print(f"  Finish reason: {candidate.finish_reason}")
        if candidate.content and candidate.content.parts:
            for j, part in enumerate(candidate.content.parts):
                print(f"  Part {j}: {part}")
                if hasattr(part, 'text'):
                    print(f"  Text: {part.text}")

db.close()
