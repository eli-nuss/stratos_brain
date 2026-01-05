# Stratos Brain AI Analysis System Documentation

## Overview

The AI Analysis system uses Google's Gemini models to analyze cryptocurrency and equity charts, providing trading assessments with direction scores, quality scores, entry/exit levels, and risk parameters.

---

## System Prompt (Version 3.0)

The current production prompt is designed to **decouple direction from quality** - meaning a bearish asset can still have a high-quality setup if the chart structure is clean.

```
You are a professional technical analyst. Analyze this equity chart and return a JSON assessment.

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
{60 days of OHLCV data}

TECHNICAL INDICATORS:
  sma_20: {value}
  sma_50: {value}
  sma_200: {value}
  rsi_14: {value}
  macd_line: {value}
  macd_signal: {value}
  bb_upper: {value}
  bb_lower: {value}
  atr_14: {value}
  return_1d: {value}
  return_5d: {value}
  return_21d: {value}
  ma_dist_20: {value}
  ma_dist_50: {value}
  ma_dist_200: {value}
  rvol_20: {value}

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
{
  "direction": "bullish" or "bearish" or "neutral",
  "ai_direction_score": integer from -100 to +100 (directional conviction only),
  "ai_setup_quality_score": integer from 0 to 100 (structural quality only - INDEPENDENT of direction!),
  "setup_type": "breakout" or "reversal" or "continuation" or "range",
  "attention_level": "URGENT" or "FOCUS" or "WATCH" or "IGNORE",
  "confidence": float from 0.0 to 1.0,
  "summary_text": "5-7 sentence technical analysis. Include: 1) Current trend context, 2) Recent price action with levels, 3) Pattern identification, 4) Trade thesis, 5) Risk definition. Use specific prices.",
  "key_levels": {
    "support": [price1, price2],
    "resistance": [price1, price2],
    "invalidation": price
  },
  "entry_zone": {
    "low": price,
    "high": price
  },
  "targets": [price1, price2, price3],
  "why_now": "1-2 sentences on why this setup is relevant today",
  "risks": ["risk1", "risk2"],
  "what_to_watch": "Key thing to monitor",
  "quality_subscores": {
    "boundary_definition": 1-5,
    "structural_compliance": 1-5,
    "volatility_profile": 1-5,
    "volume_coherence": 1-5,
    "risk_reward_clarity": 1-5
  }
}
```

---

## Context Data Provided to AI

### 1. OHLCV Data (365 days, last 60 shown in prompt)
- **Date**: Trading date
- **Open**: Opening price
- **High**: Highest price of the day
- **Low**: Lowest price of the day
- **Close**: Closing price
- **Volume**: Trading volume

### 2. Technical Indicators (from `daily_features` table)
| Indicator | Description |
|-----------|-------------|
| `sma_20` | 20-day Simple Moving Average |
| `sma_50` | 50-day Simple Moving Average |
| `sma_200` | 200-day Simple Moving Average |
| `rsi_14` | 14-day Relative Strength Index |
| `macd_line` | MACD Line |
| `macd_signal` | MACD Signal Line |
| `bb_upper` | Bollinger Band Upper |
| `bb_lower` | Bollinger Band Lower |
| `atr_14` | 14-day Average True Range |
| `return_1d` | 1-day return |
| `return_5d` | 5-day return |
| `return_21d` | 21-day return |
| `ma_dist_20` | Distance from 20-day MA (%) |
| `ma_dist_50` | Distance from 50-day MA (%) |
| `ma_dist_200` | Distance from 200-day MA (%) |
| `rvol_20` | Relative Volume (vs 20-day avg) |

---

## Output Schema

The AI returns a structured JSON with the following fields:

### Core Assessment
| Field | Type | Description |
|-------|------|-------------|
| `direction` | string | "bullish", "bearish", or "neutral" |
| `ai_direction_score` | int | -100 to +100 (directional conviction) |
| `ai_setup_quality_score` | int | 0 to 100 (structural quality, direction-agnostic) |
| `setup_type` | string | "breakout", "reversal", "continuation", or "range" |
| `attention_level` | string | "URGENT", "FOCUS", "WATCH", or "IGNORE" |
| `confidence` | float | 0.0 to 1.0 |

### Trade Plan
| Field | Type | Description |
|-------|------|-------------|
| `entry_zone.low` | float | Lower bound of entry zone |
| `entry_zone.high` | float | Upper bound of entry zone |
| `targets` | array | [TP1, TP2, TP3] price targets |
| `key_levels.support` | array | Support levels |
| `key_levels.resistance` | array | Resistance levels |
| `key_levels.invalidation` | float | Stop-loss / invalidation level |

### Analysis Text
| Field | Type | Description |
|-------|------|-------------|
| `summary_text` | string | 5-7 sentence technical analysis |
| `why_now` | string | Why this setup is relevant today |
| `risks` | array | List of risk factors |
| `what_to_watch` | string | Key thing to monitor |

### Quality Subscores (1-5 each)
| Subscore | Description |
|----------|-------------|
| `boundary_definition` | How precisely defined are support/resistance? |
| `structural_compliance` | Does pattern conform to textbook TA? |
| `volatility_profile` | Is price action clean or choppy? |
| `volume_coherence` | Does volume confirm the pattern? |
| `risk_reward_clarity` | How easy to place a logical stop-loss? |

---

## Process Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     DATA PIPELINE                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. DATA INGESTION (Daily)                                       │
│     ├── Crypto: CoinGecko API → daily_bars                      │
│     └── Equities: Polygon.io API → daily_bars                   │
│                                                                  │
│  2. FEATURE CALCULATION                                          │
│     └── daily_bars → daily_features                              │
│         (SMAs, RSI, MACD, ATR, Bollinger Bands, etc.)           │
│                                                                  │
│  3. SIGNAL DETECTION                                             │
│     └── daily_features → daily_signal_facts                      │
│         (Breakout, Reversal, Continuation patterns)              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     AI ANALYSIS PIPELINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  4. ASSET SELECTION                                              │
│     ├── Crypto: Top 200 by market cap                           │
│     └── Equities: Top 500 by dollar volume                      │
│                                                                  │
│  5. CONTEXT ASSEMBLY (per asset)                                 │
│     ├── Fetch 365 days OHLCV from daily_bars                    │
│     ├── Fetch latest features from daily_features               │
│     └── Build prompt with symbol, price, data, indicators       │
│                                                                  │
│  6. AI INFERENCE                                                 │
│     ├── Model: gemini-3-pro-preview                             │
│     ├── Temperature: 0.1 (deterministic)                        │
│     ├── Response format: JSON                                   │
│     └── Parallel processing: 10 concurrent requests             │
│                                                                  │
│  7. RESPONSE PARSING                                             │
│     ├── Parse JSON response                                      │
│     ├── Validate required fields                                 │
│     └── Extract scores, levels, summary                          │
│                                                                  │
│  8. DATABASE STORAGE                                             │
│     └── Save to asset_ai_reviews table                           │
│         (with ON CONFLICT upsert for updates)                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     DASHBOARD DISPLAY                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  9. API ENDPOINT                                                 │
│     └── Edge function joins:                                     │
│         assets + daily_features + asset_ai_reviews              │
│                                                                  │
│  10. FRONTEND DISPLAY                                            │
│      ├── Table: Direction score, Quality score, Attention       │
│      └── Detail Modal: Full analysis, trade plan, chart         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### `asset_ai_reviews` Table
```sql
CREATE TABLE asset_ai_reviews (
    id SERIAL PRIMARY KEY,
    asset_id INTEGER REFERENCES assets(asset_id),
    as_of_date DATE NOT NULL,
    
    -- Core assessment
    direction VARCHAR(20),
    ai_direction_score INTEGER,      -- -100 to +100
    ai_setup_quality_score INTEGER,  -- 0 to 100
    setup_type VARCHAR(50),
    attention_level VARCHAR(20),
    confidence DECIMAL(3,2),
    
    -- Trade plan
    ai_entry JSONB,                  -- {"low": x, "high": y}
    ai_targets JSONB,                -- [tp1, tp2, tp3]
    ai_key_levels JSONB,             -- {"support": [], "resistance": [], "invalidation": x}
    
    -- Analysis text
    summary_text TEXT,
    
    -- Full response
    review_json JSONB,
    
    -- Metadata
    model VARCHAR(100),
    prompt_version VARCHAR(20),
    input_hash VARCHAR(64),
    scope VARCHAR(50),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    
    UNIQUE(asset_id, as_of_date)
);
```

---

## Model Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| Model | `gemini-3-pro-preview` | Latest Gemini Pro model |
| Temperature | 0.1 | Low temperature for consistent outputs |
| Max Tokens | 8192 | Sufficient for detailed analysis |
| Response Format | JSON | Structured output |
| Concurrency | 10 | Parallel API calls |
| Rate Limit | ~3s between calls | Avoid API throttling |

---

## Attention Level Criteria

| Level | Criteria |
|-------|----------|
| **URGENT** | High conviction setup with immediate catalyst. Quality > 80, strong direction score. |
| **FOCUS** | Good setup worth monitoring closely. Quality > 60, clear direction. |
| **WATCH** | Developing setup, not yet actionable. Quality 40-60 or unclear direction. |
| **IGNORE** | Poor setup or no clear edge. Quality < 40 or conflicting signals. |

---

## Files

| File | Purpose |
|------|---------|
| `run_all_equities.py` | Main equity analysis script (parallel, v3.0) |
| `scripts/run_ai_analysis_all.py` | Crypto analysis script |
| `scripts/run_ai_analysis_v2.py` | Legacy analysis script |
| `scripts/consult_gemini_prompting.py` | Prompt improvement consultation |

---

## Version History

| Version | Changes |
|---------|---------|
| v1.0 | Initial implementation with basic scoring |
| v2.0 | Added quality subscores |
| v3.0 | **Current** - Decoupled direction from quality scoring |
