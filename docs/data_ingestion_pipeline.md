# Stratos Brain: Data Ingestion Pipeline

This document outlines the data ingestion pipeline for OHLCV (Open, High, Low, Close, Volume) data for both crypto and equity assets in the Stratos Brain project.

## 1. Overview

The data ingestion pipeline is responsible for fetching, processing, and storing market data from external sources. The pipeline uses a combination of n8n workflows for automated daily updates and Python scripts for historical backfills and manual ingestion. The primary data sources are **CoinGecko** for cryptocurrency data and **Alpha Vantage** for equity data.

## 2. Data Ingestion Methods

There are two primary methods for ingesting data: automated daily updates via n8n workflows and manual backfills using Python scripts.

### 2.1. Automated Daily Updates (n8n Workflows)

n8n is used for scheduled, automated data ingestion. The following workflows are in place:

| Workflow Name                     | ID                  | Status   | Asset Type | Schedule                | Description                                                                 |
| --------------------------------- | ------------------- | -------- | ---------- | ----------------------- | --------------------------------------------------------------------------- |
| Daily CoinGecko Price Update      | `gP4WW9ve9tn6VP1c`  | **Active** | Crypto     | Daily at 4 PM ET (21:00 UTC) | Fetches the latest price, market cap, and volume data for all crypto assets. |
| Daily Alpha Vantage Equity Update | `G90t2I2SeuuKHyIU`  | Inactive | Equity     | -                       | Designed to fetch daily equity prices but is currently disabled.            |

#### Crypto Data Ingestion (n8n)

The active "Daily CoinGecko Price Update" workflow is the primary method for daily crypto data updates. The process is as follows:

1.  **Trigger**: The workflow is triggered daily at 4 PM ET.
2.  **Fetch Assets**: It queries the `assets` table to get the list of all active crypto assets.
3.  **Batch Processing**: The assets are batched into groups of 250.
4.  **API Call**: For each batch, it calls the CoinGecko `/api/v3/coins/markets` endpoint.
5.  **Data Transformation**: The response data is transformed into a key-value format suitable for the `observations` table.
6.  **Upsert**: The transformed data is then upserted into the `observations` table.

#### Equity Data Ingestion (n8n)

The "Daily Alpha Vantage Equity Update" workflow is currently inactive. If it were active, it would follow a similar process to the crypto workflow, fetching equity symbols and using the Alpha Vantage API to get daily prices.

### 2.2. Manual Backfills and Ingestion (Python Scripts)

Python scripts located in the `/home/ubuntu/stratos_brain/scripts/` directory are used for historical data backfills and can also be used for manual data ingestion. The most important scripts for OHLCV ingestion are:

*   `backfill_ohlcv.py`: The original script for backfilling historical OHLCV data.
*   `backfill_ohlcv_optimized.py`: An optimized version of the backfill script that includes parallel processing and other performance improvements.
*   `feature_calc_direct.py`: A script to calculate technical features from the raw OHLCV data in the `daily_bars` table.

The `src/stratos_engine/stages/stage1_fetch.py` script is also a key part of the ingestion pipeline, providing functions to fetch data from both CoinGecko and Alpha Vantage and is likely used by the main application logic.

## 3. Data Sources

| Asset Type | Data Source    | API Endpoint(s)                                   | Authentication |
| ---------- | -------------- | ------------------------------------------------- | -------------- |
| Crypto     | CoinGecko Pro  | `/api/v3/coins/markets`, `/api/v3/coins/{id}/ohlc` | API Key        |
| Equity     | Alpha Vantage  | `/query?function=TIME_SERIES_DAILY_ADJUSTED`      | API Key        |

## 4. Data Storage

The ingested data is stored in a PostgreSQL database hosted on Supabase. The key tables involved in the OHLCV data pipeline are:

| Table Name       | Description                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `assets`         | Stores metadata for all assets, including `asset_type`, `symbol`, `coingecko_id`, and `alpha_vantage_symbol`.                                     |
| `daily_bars`     | The primary table for storing raw OHLCV data for both crypto and equity assets. This table is populated by the Python backfill scripts.        |
| `daily_features` | Stores a wide range of calculated technical indicators and features derived from the data in `daily_bars`.                                       |
| `observations`   | A newer, more granular table for storing time-series data in a key-value format. Currently used by the active CoinGecko n8n workflow. |

## 5. Data Pipeline Summary

### Cryptocurrency Data Pipeline

1.  **Daily Updates**: The active n8n workflow, "Daily CoinGecko Price Update", runs daily to fetch the latest market data from the CoinGecko Pro API and stores it in the `observations` table.
2.  **Historical Data**: The `backfill_ohlcv_optimized.py` script is used to backfill historical OHLCV data from CoinGecko into the `daily_bars` table.
3.  **Feature Calculation**: The `feature_calc_direct.py` script is run to calculate technical features from the raw data in `daily_bars` and stores the results in the `daily_features` table.

### Equity Data Pipeline

1.  **Daily Updates**: The n8n workflow for daily equity updates is **inactive**. This means there is currently no automated daily ingestion of equity data.
2.  **Historical Data**: The `backfill_ohlcv_optimized.py` script is the primary method for ingesting historical OHLCV data for equities from Alpha Vantage into the `daily_bars` table.
3.  **Feature Calculation**: Similar to the crypto pipeline, the `feature_calc_direct.py` script is used to calculate and store technical features for equities.

## 6. Potential Issues and Optimizations

*   **Inactive Equity Workflow**: The most significant finding is that the daily equity data ingestion workflow is inactive. This means that equity data is not being updated automatically. This should be addressed to ensure the equity data is current.
*   **Redundant Data Ingestion Paths**: There are multiple paths for data ingestion (n8n, `stage1_fetch.py`, and the `scripts` directory). This could lead to inconsistencies and make the system harder to maintain. Consolidating the data ingestion logic into a single, well-defined pipeline would be beneficial.
*   **`observations` vs. `daily_bars`**: The use of both the `observations` and `daily_bars` tables for storing market data suggests a potential migration or a transitionary phase. It would be beneficial to clarify the long-term strategy for data storage and whether one table will be deprecated in favor of the other.
*   **Error Handling and Monitoring**: While the scripts and workflows have some basic error handling (e.g., rate limit retries), a more robust monitoring and alerting system would help to quickly identify and resolve issues in the data pipeline.
