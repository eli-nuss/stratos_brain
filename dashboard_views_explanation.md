# Stratos Brain Dashboard Views: A Deep Dive

## 1. Introduction

The Stratos Brain dashboard provides a comprehensive and interactive interface for analyzing financial assets. The views within the dashboard are powered by a sophisticated data pipeline that starts with raw data in a Supabase PostgreSQL database and ends with a dynamic user interface built with React. This document provides a detailed explanation of how these dashboard views are constructed, from the underlying database views to the frontend components that render the data.

## 2. Data Flow Overview

The data flow for the dashboard views can be summarized in the following steps:

1.  **Database Views**: Raw data from various tables is aggregated and transformed into a set of specialized views in the PostgreSQL database. These views are optimized for the specific data requirements of the dashboard.
2.  **Edge Function API**: A Supabase Edge Function, `control-api`, exposes a set of RESTful endpoints that query the database views and serve the data to the frontend.
3.  **Frontend Hooks**: Custom React hooks (`useAllAssets` and `useWatchlist`) are used to fetch data from the Edge Function API and manage the state of the data in the frontend.
4.  **Frontend Components**: React components (`AllAssetsTable`, `WatchlistTable`, etc.) consume the data from the hooks and render it in a user-friendly format.

## 3. Database Views

The foundation of the dashboard views is a set of well-designed database views that pre-process and aggregate the data. These views simplify the queries that need to be made from the backend and improve the overall performance of the dashboard. The key database views are:

| View Name | Description |
| :--- | :--- |
| `v_dashboard_base` | A foundational view that joins `daily_asset_scores`, `assets`, and `daily_features` to provide a base set of data for all dashboard views. It also includes a liquidity gate to filter out illiquid assets. |
| `v_dashboard_inflections` | Built on top of `v_dashboard_base`, this view identifies assets that are experiencing significant changes in their scores, such as breakouts or reversals. It joins with `asset_ai_reviews` to include AI-powered analysis for these high-novelty events. |
| `v_dashboard_trends` | This view focuses on assets that are in established bullish trends. It filters for assets with a positive `weighted_score` and active bullish signals. |
| `v_dashboard_risk` | This view highlights assets that are showing bearish signals or are at risk of a breakdown. It filters for assets with a negative `weighted_score` and active bearish signals. |
| `v_dashboard_all_assets` | A comprehensive view that provides a complete list of all assets, along with their latest scores, AI reviews, and other relevant data. This view is used to populate the main asset tables in the dashboard. |

## 4. Edge Function API

The `control-api` Supabase Edge Function acts as a bridge between the database and the frontend. It provides a set of secure and scalable endpoints for accessing the data from the database views. The key dashboard-related endpoints are:

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/dashboard/health` | `GET` | Provides a health check of the dashboard, including the latest data dates and asset counts. |
| `/dashboard/inflections` | `GET` | Fetches data from the `v_dashboard_inflections` view, with support for pagination and filtering. |
| `/dashboard/trends` | `GET` | Fetches data from the `v_dashboard_trends` view, with support for pagination and filtering. |
| `/dashboard/risk` | `GET` | Fetches data from the `v_dashboard_risk` view, with support for pagination and filtering. |
| `/dashboard/all-assets` | `GET` | Fetches data from the `v_dashboard_all_assets` view, with support for pagination, sorting, and filtering. |
| `/dashboard/asset` | `GET` | Fetches detailed information for a single asset, including OHLCV data, features, scores, and AI reviews. |
| `/dashboard/watchlist` | `GET`, `POST`, `DELETE` | Manages the user's watchlist. |

## 5. Frontend Implementation

The frontend of the dashboard is built with React and utilizes a component-based architecture. The key components and hooks involved in rendering the dashboard views are:

### Hooks

- **`useAllAssets.ts`**: This custom hook is responsible for fetching and managing the data for the main asset tables. It uses the `useSWR` hook to fetch data from the `/dashboard/all-assets` endpoint and provides features such as pagination, sorting, and filtering.
- **`useWatchlist.ts`**: This hook manages the user's watchlist. It provides functions for adding, removing, and checking if an asset is in the watchlist. It also includes a `useWatchlistAssets` hook that fetches the detailed data for the assets in the watchlist.

### Components

- **`Home.tsx`**: This is the main page component that orchestrates the display of the different dashboard views. It uses a tabbed interface to switch between the watchlist, crypto, and equity views.
- **`AllAssetsTable.tsx`**: This component renders the main table of assets for the crypto and equity views. It uses the `useAllAssets` hook to fetch the data and provides a rich set of features, including sorting, filtering, and pagination.
- **`WatchlistTable.tsx`**: This component renders the table of assets in the user's watchlist. It uses the `useWatchlistAssets` hook to fetch the data and provides similar features to the `AllAssetsTable`.
- **`AssetDetail.tsx`**: This component displays a detailed view of a single asset when the user clicks on a row in one of the tables. It fetches the detailed asset data from the `/dashboard/asset` endpoint.

## 6. Conclusion

The dashboard views in the Stratos Brain project are a well-engineered and integral part of the platform. The combination of optimized database views, a scalable Edge Function API, and a responsive React frontend provides a powerful and user-friendly experience for analyzing financial assets. The modular and component-based architecture of the frontend allows for easy extension and customization, while the robust backend ensures that the data is always up-to-date and accurate.
