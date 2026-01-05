# Stratos Brain Pipeline Documentation

This document provides a comprehensive overview of the Stratos Brain data pipeline, including the execution order, key scripts, dependencies, and environment variables required.

## Pipeline Overview

The pipeline is designed to ingest OHLCV data, calculate technical features, generate signals, and run AI analysis. The core stages are executed sequentially, with some scripts designed for parallel processing to improve performance.

### Execution Order

The standard pipeline flow is as follows:

1.  **Data Ingestion**: Fetch OHLCV data from external APIs.
2.  **Feature Calculation**: Compute technical indicators from OHLCV data.
3.  **Signal Generation**: Generate discrete signals from technical features.
4.  **AI Analysis**: Run AI models to generate qualitative analysis and trade plans.

### Database Tables

The pipeline populates the following key tables in the Supabase PostgreSQL database:

| Table Name | Description |
| --- | --- |
| `assets` | Static information about each asset (symbol, name, type). |
| `daily_bars` | Raw OHLCV (Open, High, Low, Close, Volume) data for each asset. |
| `daily_features` | ~100+ calculated technical indicators for each asset. |
| `daily_signal_facts` | Discrete signals generated from feature patterns (e.g., "RSI oversold"). |
| `asset_ai_reviews` | Qualitative analysis, trade plans, and scores from the AI models. |

## Key Scripts & Execution

This section details the main scripts used to run the pipeline.

### 1. Data Ingestion

**Purpose**: Fetch historical and daily OHLCV data for crypto and equity assets.

| Script | Description |
| --- | --- |
| `scripts/parallel_ohlcv_update.py` | **Recommended**. Fetches OHLCV data for a specific date using parallel processing. Ideal for daily updates. |
| `scripts/backfill_ohlcv_optimized.py` | Backfills a range of dates for a given asset type. Uses parallel processing with rate limiting. |
| `n8n Workflows` | Automated daily ingestion via n8n. "Daily CoinGecko Price Update" is active for crypto. |

**Execution Example (Daily Update):**
```bash
# Run for crypto on a specific date
python scripts/parallel_ohlcv_update.py --asset-type crypto --date 2026-01-04
```

### 2. Feature Calculation

**Purpose**: Calculate ~100+ technical indicators from the raw OHLCV data in `daily_bars` and store them in `daily_features`.

| Script | Description |
| --- | --- |
| `scripts/feature_calc_direct.py` | **Recommended**. Calculates all features for a given asset type and date. |

**Execution Example:**
```bash
# Run for crypto on a specific date
python scripts/feature_calc_direct.py --asset-type crypto --date 2026-01-04
```

### 3. Signal Generation (Stage 1)

**Purpose**: Evaluate feature patterns against predefined templates to generate discrete signals (e.g., "trend_breakdown", "breakout_participation").

| Script | Description |
| --- | --- |
| `src/stratos_engine/stages/stage1_evaluate.py` | Core logic for signal generation. Can be run as a standalone script. |

**Execution Example:**
```python
# From within a Python script
from stratos_engine.db import Database
from stratos_engine.stages.stage1_evaluate import Stage1Evaluate

db = Database()
stage1 = Stage1Evaluate(db)
result = stage1.run(as_of_date=\'2026-01-04\', universe_id=\'crypto_all\')
print(result)
```

### 4. AI Analysis (Stage 5 v2)

**Purpose**: Generate qualitative analysis, trade plans, and scores using a large language model (LLM). This stage now runs independently of the old Stage 4 scoring.

| Script | Description |
| --- | --- |
| `run_all_crypto.py` | **Recommended for Crypto**. Runs parallel AI analysis for all active crypto assets. Fastest option. |
| `scripts/run_ai_analysis_v2.py` | Runs AI analysis for a given asset type (crypto or equity). For equity, it processes the top 500 by volume. |

**Execution Example:**
```bash
# Run parallel analysis for all crypto assets
python run_all_crypto.py

# Run for top 500 equities
python scripts/run_ai_analysis_v2.py --asset-type equity
```

## Dependencies & Environment

### Python Dependencies

The required Python packages are listed in `requirements.txt`. Key libraries include:
- `psycopg2-binary`: For PostgreSQL database connection.
- `openai`: For interacting with LLMs.
- `pandas`, `numpy`: For data manipulation.
- `requests`: For API calls.
- `structlog`: For structured logging.

Install all dependencies using:
```bash
pip install -r requirements.txt
```

### Environment Variables

The pipeline requires several environment variables, defined in `.env.example`. The most critical are:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | **Required**. The full connection string for your Supabase PostgreSQL database. |
| `OPENAI_API_KEY` | **Required**. Your API key for the LLM provider (e.g., OpenAI, Gemini). |
| `OPENAI_MODEL` | The specific model to use for AI analysis (e.g., `gpt-4.1-mini`, `gemini-3-pro-preview`). |

## Dashboard & API

The frontend dashboard and its API are located in the `dashboard/` and `supabase/` directories respectively.

- **Dashboard**: A React application that displays the data.
- **API**: A Supabase Edge Function (`control-api`) that provides data to the dashboard.

Any changes to the API in `supabase/functions/control-api/index.ts` require redeployment:
```bash
npx supabase functions deploy control-api --project-ref <your-project-ref>
```
