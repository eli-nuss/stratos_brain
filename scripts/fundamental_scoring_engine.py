#!/usr/bin/env python3
"""
Context-Aware Stock Scoring Engine

This script implements a fundamental scoring system that:
1. Ingests financial data from Financial Modeling Prep (FMP)
2. Classifies companies as Growth, Value, or Hybrid
3. Scores them using the appropriate algorithm (0-100 scale)

Scoring Engines:
- Growth Engine: Rule of 40, Gross Margins, Revenue Acceleration, PEG
- Value Engine: FCF Yield, P/E vs Historical, Debt/Equity, Dividends, Piotroski

Update Frequency:
- Monthly: Full fundamental refresh + re-classification
- Daily: Price/valuation update + final score recalculation

Usage:
    # Monthly full refresh (fundamentals + classification + scoring)
    python fundamental_scoring_engine.py --mode monthly --limit 100

    # Daily update (valuation metrics + recalculate scores)
    python fundamental_scoring_engine.py --mode daily

    # Process specific symbols
    python fundamental_scoring_engine.py --symbols AAPL MSFT NVDA

Author: Claude
Date: 2026-01-13
"""

import os
import sys
import time
import json
import logging
import argparse
import requests
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field
from decimal import Decimal

# ============================================================================
# Configuration
# ============================================================================
FMP_API_KEY = os.environ.get("FMP_API_KEY")
FMP_BASE_URL = "https://financialmodelingprep.com/stable"
FMP_API_V3_URL = "https://financialmodelingprep.com/api/v3"

DB_HOST = os.environ.get('DB_HOST', 'db.wfogbaipiqootjrsprde.supabase.co')
DB_PORT = os.environ.get('DB_PORT', '5432')
DB_NAME = os.environ.get('DB_NAME', 'postgres')
DB_USER = os.environ.get('DB_USER', 'postgres')
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'stratosbrainpostgresdbpw')

# Rate limiting
REQUESTS_PER_MINUTE = 300  # FMP premium tier
REQUEST_DELAY = 0.2  # 200ms between requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============================================================================
# Classification Thresholds (Router)
# ============================================================================
GROWTH_CAGR_THRESHOLD = 0.15      # 15% 3-year revenue CAGR
VALUE_CAGR_THRESHOLD = 0.10       # 10% 3-year revenue CAGR
VALUE_PE_THRESHOLD = 20           # P/E below 20 suggests value


# ============================================================================
# Scoring Weights
# ============================================================================
GROWTH_WEIGHTS = {
    'rule_of_40': 0.40,           # Revenue Growth % + EBITDA Margin %
    'gross_margin': 0.20,         # Scalability indicator
    'revenue_acceleration': 0.20, # Is growth speeding up?
    'price_vs_sma': 0.10,         # Technical trend
    'peg_ratio': 0.10,            # Growth at reasonable price
}

VALUE_WEIGHTS = {
    'fcf_yield': 0.30,            # Free Cash Flow / Market Cap
    'pe_vs_historical': 0.20,     # P/E vs 5-year average
    'debt_equity': 0.20,          # Safety check
    'dividend_growth': 0.15,      # Consistency
    'piotroski_score': 0.15,      # Fundamental health
}


# ============================================================================
# Data Classes
# ============================================================================
@dataclass
class FundamentalData:
    """Container for all fundamental data for a single equity."""
    symbol: str
    asset_id: int

    # Company profile
    market_cap: Optional[float] = None
    sector: Optional[str] = None
    industry: Optional[str] = None

    # Income statement (TTM and historical)
    revenue_ttm: Optional[float] = None
    revenue_history: List[float] = field(default_factory=list)  # Last 4 years
    gross_profit_ttm: Optional[float] = None
    operating_income_ttm: Optional[float] = None
    net_income_ttm: Optional[float] = None
    ebitda_ttm: Optional[float] = None

    # Balance sheet
    total_assets: Optional[float] = None
    total_liabilities: Optional[float] = None
    total_equity: Optional[float] = None
    long_term_debt: Optional[float] = None
    total_debt: Optional[float] = None
    cash: Optional[float] = None
    current_assets: Optional[float] = None
    current_liabilities: Optional[float] = None

    # Cash flow
    operating_cash_flow: Optional[float] = None
    capex: Optional[float] = None
    free_cash_flow: Optional[float] = None
    dividends_paid: Optional[float] = None

    # Ratios and metrics
    pe_ratio: Optional[float] = None
    forward_pe: Optional[float] = None
    peg_ratio: Optional[float] = None
    price_to_sales: Optional[float] = None
    price_to_book: Optional[float] = None
    ev_to_ebitda: Optional[float] = None
    ev_to_revenue: Optional[float] = None
    dividend_yield: Optional[float] = None

    # Historical P/E for comparison
    pe_history: List[float] = field(default_factory=list)

    # Quarterly data for acceleration
    quarterly_revenue: List[float] = field(default_factory=list)  # Last 8 quarters


@dataclass
class ScoringResult:
    """Result of scoring calculation."""
    classification: str
    classification_reason: str
    growth_engine_score: Optional[float] = None
    value_engine_score: Optional[float] = None
    final_score: float = 0.0
    score_breakdown: Dict[str, Any] = field(default_factory=dict)


# ============================================================================
# Database Functions
# ============================================================================
def get_db_connection():
    """Create and return a database connection."""
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )


def get_equities_to_process(conn, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """Get list of active equities ordered by market cap."""
    with conn.cursor() as cur:
        query = """
            SELECT a.asset_id, a.symbol
            FROM assets a
            JOIN equity_metadata em ON a.asset_id = em.asset_id
            WHERE a.asset_type = 'equity'
              AND a.is_active = true
              AND em.market_cap IS NOT NULL
              AND em.market_cap > 100000000  -- $100M minimum
            ORDER BY em.market_cap DESC NULLS LAST
        """
        if limit:
            query += f" LIMIT {limit}"

        cur.execute(query)
        return [{'asset_id': row[0], 'symbol': row[1]} for row in cur.fetchall()]


# ============================================================================
# FMP API Functions
# ============================================================================
def get_fmp(endpoint: str, params: Optional[Dict] = None, use_v3: bool = False) -> Any:
    """Fetch data from FMP API with rate limiting."""
    if not FMP_API_KEY:
        logger.error("FMP_API_KEY environment variable not set")
        return None

    base_url = FMP_API_V3_URL if use_v3 else FMP_BASE_URL
    url = f"{base_url}/{endpoint}"
    params = params or {}
    params['apikey'] = FMP_API_KEY

    try:
        time.sleep(REQUEST_DELAY)  # Rate limiting
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()

        # Check for error messages
        if isinstance(data, dict) and 'Error Message' in data:
            logger.warning(f"FMP API error: {data['Error Message']}")
            return None

        return data
    except requests.exceptions.RequestException as e:
        logger.error(f"FMP request failed for {endpoint}: {e}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode failed for {endpoint}: {e}")
        return None


def fetch_fundamental_data(symbol: str, asset_id: int) -> Optional[FundamentalData]:
    """Fetch all fundamental data for a single equity from FMP."""
    data = FundamentalData(symbol=symbol, asset_id=asset_id)

    # 1. Company Profile (for market cap, sector, industry)
    logger.debug(f"Fetching profile for {symbol}")
    profile = get_fmp(f"profile/{symbol}", use_v3=True)
    if profile and len(profile) > 0:
        p = profile[0]
        data.market_cap = p.get('mktCap')
        data.sector = p.get('sector')
        data.industry = p.get('industry')

    # 2. Income Statement (annual, last 5 years)
    logger.debug(f"Fetching income statement for {symbol}")
    income = get_fmp(f"income-statement/{symbol}", params={'limit': 5}, use_v3=True)
    if income and len(income) > 0:
        # TTM from most recent
        latest = income[0]
        data.revenue_ttm = latest.get('revenue')
        data.gross_profit_ttm = latest.get('grossProfit')
        data.operating_income_ttm = latest.get('operatingIncome')
        data.net_income_ttm = latest.get('netIncome')
        data.ebitda_ttm = latest.get('ebitda')

        # Historical revenue for CAGR
        data.revenue_history = [i.get('revenue') for i in income if i.get('revenue')]

    # 3. Income Statement (quarterly, last 8 quarters for acceleration)
    logger.debug(f"Fetching quarterly income for {symbol}")
    quarterly = get_fmp(f"income-statement/{symbol}", params={'period': 'quarter', 'limit': 8}, use_v3=True)
    if quarterly:
        data.quarterly_revenue = [q.get('revenue') for q in quarterly if q.get('revenue')]

    # 4. Balance Sheet
    logger.debug(f"Fetching balance sheet for {symbol}")
    balance = get_fmp(f"balance-sheet-statement/{symbol}", params={'limit': 1}, use_v3=True)
    if balance and len(balance) > 0:
        b = balance[0]
        data.total_assets = b.get('totalAssets')
        data.total_liabilities = b.get('totalLiabilities')
        data.total_equity = b.get('totalStockholdersEquity')
        data.long_term_debt = b.get('longTermDebt')
        data.total_debt = b.get('totalDebt')
        data.cash = b.get('cashAndCashEquivalents')
        data.current_assets = b.get('totalCurrentAssets')
        data.current_liabilities = b.get('totalCurrentLiabilities')

    # 5. Cash Flow Statement
    logger.debug(f"Fetching cash flow for {symbol}")
    cashflow = get_fmp(f"cash-flow-statement/{symbol}", params={'limit': 1}, use_v3=True)
    if cashflow and len(cashflow) > 0:
        cf = cashflow[0]
        data.operating_cash_flow = cf.get('operatingCashFlow')
        data.capex = cf.get('capitalExpenditure')
        data.free_cash_flow = cf.get('freeCashFlow')
        data.dividends_paid = cf.get('dividendsPaid')

    # 6. Key Metrics / Ratios
    logger.debug(f"Fetching key metrics for {symbol}")
    metrics = get_fmp(f"key-metrics-ttm/{symbol}", use_v3=True)
    if metrics and len(metrics) > 0:
        m = metrics[0]
        data.pe_ratio = m.get('peRatioTTM')
        data.peg_ratio = m.get('pegRatioTTM')
        data.price_to_sales = m.get('priceToSalesRatioTTM')
        data.price_to_book = m.get('priceToBookRatioTTM')
        data.ev_to_ebitda = m.get('enterpriseValueOverEBITDATTM')
        data.dividend_yield = m.get('dividendYieldTTM')

    # 7. Historical Ratios (for P/E comparison)
    logger.debug(f"Fetching historical ratios for {symbol}")
    ratios = get_fmp(f"ratios/{symbol}", params={'limit': 5}, use_v3=True)
    if ratios:
        data.pe_history = [r.get('priceEarningsRatio') for r in ratios if r.get('priceEarningsRatio')]

    # 8. Forward P/E from analyst estimates
    logger.debug(f"Fetching analyst estimates for {symbol}")
    estimates = get_fmp(f"analyst-estimates/{symbol}", params={'limit': 1}, use_v3=True)
    if estimates and len(estimates) > 0:
        est = estimates[0]
        if data.market_cap and est.get('estimatedEpsAvg'):
            # Calculate forward P/E from current price / estimated EPS
            shares = data.market_cap / (data.pe_ratio * est.get('estimatedEpsAvg', 1)) if data.pe_ratio else None
            if shares and est.get('estimatedEpsAvg'):
                price_per_share = data.market_cap / shares if shares > 0 else None
                if price_per_share:
                    data.forward_pe = price_per_share / est.get('estimatedEpsAvg')

    return data


# ============================================================================
# Calculation Functions
# ============================================================================
def safe_divide(numerator: Optional[float], denominator: Optional[float]) -> Optional[float]:
    """Safely divide two numbers, returning None if invalid."""
    if numerator is None or denominator is None or denominator == 0:
        return None
    return numerator / denominator


def calculate_cagr(values: List[float], years: int = 3) -> Optional[float]:
    """Calculate Compound Annual Growth Rate."""
    if not values or len(values) < 2:
        return None

    # values[0] is most recent, values[-1] is oldest
    end_value = values[0]
    start_value = values[min(years, len(values) - 1)]

    if start_value is None or end_value is None or start_value <= 0:
        return None

    actual_years = min(years, len(values) - 1)
    if actual_years <= 0:
        return None

    try:
        return (end_value / start_value) ** (1 / actual_years) - 1
    except (ValueError, ZeroDivisionError):
        return None


def calculate_revenue_acceleration(quarterly_revenue: List[float]) -> Optional[float]:
    """
    Calculate revenue acceleration (change in growth rate).
    Positive = growth is speeding up.
    """
    if not quarterly_revenue or len(quarterly_revenue) < 5:
        return None

    # QoQ growth rate for recent quarter vs previous
    # quarterly_revenue[0] = most recent, [1] = previous, etc.
    try:
        recent_growth = (quarterly_revenue[0] - quarterly_revenue[1]) / quarterly_revenue[1]
        prior_growth = (quarterly_revenue[4] - quarterly_revenue[5]) / quarterly_revenue[5] if len(quarterly_revenue) > 5 else (quarterly_revenue[3] - quarterly_revenue[4]) / quarterly_revenue[4]
        return recent_growth - prior_growth
    except (TypeError, ZeroDivisionError):
        return None


def calculate_piotroski_score(data: FundamentalData) -> Tuple[int, Dict[str, bool]]:
    """
    Calculate Piotroski F-Score (0-9).
    Higher score = stronger fundamental health.
    """
    components = {}
    score = 0

    # Profitability (4 points)
    # 1. Positive Net Income
    components['positive_net_income'] = data.net_income_ttm is not None and data.net_income_ttm > 0
    if components['positive_net_income']:
        score += 1

    # 2. Positive Operating Cash Flow
    components['positive_ocf'] = data.operating_cash_flow is not None and data.operating_cash_flow > 0
    if components['positive_ocf']:
        score += 1

    # 3. ROA increasing (using OCF/Assets as proxy)
    roa = safe_divide(data.operating_cash_flow, data.total_assets)
    components['positive_roa'] = roa is not None and roa > 0
    if components['positive_roa']:
        score += 1

    # 4. OCF > Net Income (quality of earnings)
    components['ocf_gt_net_income'] = (
        data.operating_cash_flow is not None and
        data.net_income_ttm is not None and
        data.operating_cash_flow > data.net_income_ttm
    )
    if components['ocf_gt_net_income']:
        score += 1

    # Leverage & Liquidity (3 points)
    # 5. Decreasing debt ratio (using debt/assets)
    debt_ratio = safe_divide(data.total_debt, data.total_assets)
    components['low_debt_ratio'] = debt_ratio is not None and debt_ratio < 0.5
    if components['low_debt_ratio']:
        score += 1

    # 6. Current ratio > 1
    current_ratio = safe_divide(data.current_assets, data.current_liabilities)
    components['current_ratio_gt_1'] = current_ratio is not None and current_ratio > 1
    if components['current_ratio_gt_1']:
        score += 1

    # 7. No share dilution (simplified - positive if no major dilution)
    components['no_dilution'] = True  # Simplified - would need historical share count
    if components['no_dilution']:
        score += 1

    # Operating Efficiency (2 points)
    # 8. Gross margin improvement (simplified)
    gross_margin = safe_divide(data.gross_profit_ttm, data.revenue_ttm)
    components['good_gross_margin'] = gross_margin is not None and gross_margin > 0.2
    if components['good_gross_margin']:
        score += 1

    # 9. Asset turnover improvement (simplified)
    asset_turnover = safe_divide(data.revenue_ttm, data.total_assets)
    components['good_asset_turnover'] = asset_turnover is not None and asset_turnover > 0.5
    if components['good_asset_turnover']:
        score += 1

    return score, components


# ============================================================================
# Router: Classification Logic
# ============================================================================
def classify_stock(data: FundamentalData) -> Tuple[str, str]:
    """
    Classify stock as Growth, Value, or Hybrid.

    Returns:
        Tuple of (classification, reason)
    """
    # Calculate 3-year revenue CAGR
    cagr = calculate_cagr(data.revenue_history, years=3)

    if cagr is None:
        # Insufficient data - default to hybrid
        return 'hybrid', 'Insufficient revenue history for classification'

    # Growth criteria: CAGR > 15%
    if cagr > GROWTH_CAGR_THRESHOLD:
        return 'growth', f'Revenue CAGR {cagr:.1%} > {GROWTH_CAGR_THRESHOLD:.0%} threshold'

    # Value criteria: CAGR < 10% AND (P/E < 20 OR negative earnings with positive FCF)
    if cagr < VALUE_CAGR_THRESHOLD:
        pe = data.pe_ratio
        fcf = data.free_cash_flow

        if pe is not None and pe > 0 and pe < VALUE_PE_THRESHOLD:
            return 'value', f'Revenue CAGR {cagr:.1%} < {VALUE_CAGR_THRESHOLD:.0%} and P/E {pe:.1f} < {VALUE_PE_THRESHOLD}'

        if (pe is None or pe < 0) and fcf is not None and fcf > 0:
            return 'value', f'Revenue CAGR {cagr:.1%} < {VALUE_CAGR_THRESHOLD:.0%}, negative P/E but positive FCF'

    # Hybrid: Everything else
    return 'hybrid', f'Revenue CAGR {cagr:.1%} between thresholds'


# ============================================================================
# Scoring Engines
# ============================================================================
def normalize_score(value: Optional[float], perfect_threshold: float, zero_threshold: float,
                    higher_is_better: bool = True) -> float:
    """
    Normalize a value to 0-10 scale based on thresholds.

    Args:
        value: The raw value to normalize
        perfect_threshold: Value that yields score of 10
        zero_threshold: Value that yields score of 0
        higher_is_better: If True, higher values are better

    Returns:
        Score between 0 and 10
    """
    if value is None:
        return 5.0  # Neutral score for missing data

    if higher_is_better:
        if value >= perfect_threshold:
            return 10.0
        elif value <= zero_threshold:
            return 0.0
        else:
            # Linear interpolation
            return 10.0 * (value - zero_threshold) / (perfect_threshold - zero_threshold)
    else:
        # Lower is better (e.g., PEG ratio, debt/equity)
        if value <= perfect_threshold:
            return 10.0
        elif value >= zero_threshold:
            return 0.0
        else:
            return 10.0 * (zero_threshold - value) / (zero_threshold - perfect_threshold)


def score_growth_engine(data: FundamentalData) -> Tuple[float, Dict[str, Any]]:
    """
    Score using Growth Engine algorithm.

    Metrics:
    - Rule of 40 (40%): Revenue Growth % + EBITDA Margin %
    - Gross Margin (20%): Higher = more scalable
    - Revenue Acceleration (20%): Is growth speeding up?
    - Price vs 200 SMA (10%): Technical trend
    - PEG Ratio (10%): Growth at reasonable price
    """
    breakdown = {}

    # 1. Rule of 40
    rev_growth_yoy = None
    if len(data.revenue_history) >= 2 and data.revenue_history[1]:
        rev_growth_yoy = (data.revenue_history[0] - data.revenue_history[1]) / data.revenue_history[1]

    ebitda_margin = safe_divide(data.ebitda_ttm, data.revenue_ttm)

    rule_of_40 = None
    if rev_growth_yoy is not None and ebitda_margin is not None:
        rule_of_40 = (rev_growth_yoy * 100) + (ebitda_margin * 100)

    rule_of_40_score = normalize_score(rule_of_40, 50, 0, higher_is_better=True)
    breakdown['rule_of_40'] = {
        'value': rule_of_40,
        'score': rule_of_40_score,
        'weight': GROWTH_WEIGHTS['rule_of_40']
    }

    # 2. Gross Margin
    gross_margin = safe_divide(data.gross_profit_ttm, data.revenue_ttm)
    gross_margin_pct = gross_margin * 100 if gross_margin else None
    gross_margin_score = normalize_score(gross_margin_pct, 80, 40, higher_is_better=True)
    breakdown['gross_margin'] = {
        'value': gross_margin_pct,
        'score': gross_margin_score,
        'weight': GROWTH_WEIGHTS['gross_margin']
    }

    # 3. Revenue Acceleration
    rev_accel = calculate_revenue_acceleration(data.quarterly_revenue)
    rev_accel_pct = rev_accel * 100 if rev_accel else None
    rev_accel_score = normalize_score(rev_accel_pct, 5, -5, higher_is_better=True)
    breakdown['revenue_acceleration'] = {
        'value': rev_accel_pct,
        'score': rev_accel_score,
        'weight': GROWTH_WEIGHTS['revenue_acceleration']
    }

    # 4. Price vs SMA (placeholder - will be updated daily)
    price_vs_sma_score = 5.0  # Neutral for now
    breakdown['price_vs_sma'] = {
        'value': None,
        'score': price_vs_sma_score,
        'weight': GROWTH_WEIGHTS['price_vs_sma']
    }

    # 5. PEG Ratio
    peg_score = normalize_score(data.peg_ratio, 1.0, 2.5, higher_is_better=False)
    breakdown['peg_ratio'] = {
        'value': data.peg_ratio,
        'score': peg_score,
        'weight': GROWTH_WEIGHTS['peg_ratio']
    }

    # Calculate weighted score
    total_score = (
        rule_of_40_score * GROWTH_WEIGHTS['rule_of_40'] +
        gross_margin_score * GROWTH_WEIGHTS['gross_margin'] +
        rev_accel_score * GROWTH_WEIGHTS['revenue_acceleration'] +
        price_vs_sma_score * GROWTH_WEIGHTS['price_vs_sma'] +
        peg_score * GROWTH_WEIGHTS['peg_ratio']
    ) * 10  # Convert to 0-100 scale

    return total_score, breakdown


def score_value_engine(data: FundamentalData) -> Tuple[float, Dict[str, Any]]:
    """
    Score using Value Engine algorithm.

    Metrics:
    - FCF Yield (30%): Free Cash Flow / Market Cap
    - P/E vs 5Y Avg (20%): Historical discount
    - Debt/Equity (20%): Safety check
    - Dividend Growth (15%): Consistency (simplified)
    - Piotroski F-Score (15%): Fundamental health
    """
    breakdown = {}

    # 1. FCF Yield
    fcf_yield = safe_divide(data.free_cash_flow, data.market_cap)
    fcf_yield_pct = fcf_yield * 100 if fcf_yield else None
    fcf_yield_score = normalize_score(fcf_yield_pct, 8, 0, higher_is_better=True)
    breakdown['fcf_yield'] = {
        'value': fcf_yield_pct,
        'score': fcf_yield_score,
        'weight': VALUE_WEIGHTS['fcf_yield']
    }

    # 2. P/E vs 5-Year Average
    pe_vs_historical = None
    if data.pe_ratio and data.pe_history and len(data.pe_history) > 0:
        avg_pe = sum([p for p in data.pe_history if p]) / len([p for p in data.pe_history if p])
        if avg_pe > 0:
            pe_vs_historical = data.pe_ratio / avg_pe

    # Score: 20% discount (0.8) = perfect, 20% premium (1.2) = zero
    pe_vs_score = normalize_score(pe_vs_historical, 0.8, 1.2, higher_is_better=False)
    breakdown['pe_vs_historical'] = {
        'value': pe_vs_historical,
        'score': pe_vs_score,
        'weight': VALUE_WEIGHTS['pe_vs_historical']
    }

    # 3. Debt/Equity
    debt_equity = safe_divide(data.total_debt, data.total_equity)
    debt_equity_score = normalize_score(debt_equity, 0.5, 2.0, higher_is_better=False)
    breakdown['debt_equity'] = {
        'value': debt_equity,
        'score': debt_equity_score,
        'weight': VALUE_WEIGHTS['debt_equity']
    }

    # 4. Dividend Growth (simplified - using dividend yield as proxy)
    div_yield_pct = data.dividend_yield * 100 if data.dividend_yield else 0
    # Score positively if dividend exists, better if yield is meaningful
    div_score = normalize_score(div_yield_pct, 3, 0, higher_is_better=True)
    breakdown['dividend_growth'] = {
        'value': div_yield_pct,
        'score': div_score,
        'weight': VALUE_WEIGHTS['dividend_growth']
    }

    # 5. Piotroski F-Score
    piotroski, piotroski_components = calculate_piotroski_score(data)
    piotroski_score = normalize_score(piotroski, 8, 4, higher_is_better=True)
    breakdown['piotroski'] = {
        'value': piotroski,
        'score': piotroski_score,
        'weight': VALUE_WEIGHTS['piotroski_score'],
        'components': piotroski_components
    }

    # Calculate weighted score
    total_score = (
        fcf_yield_score * VALUE_WEIGHTS['fcf_yield'] +
        pe_vs_score * VALUE_WEIGHTS['pe_vs_historical'] +
        debt_equity_score * VALUE_WEIGHTS['debt_equity'] +
        div_score * VALUE_WEIGHTS['dividend_growth'] +
        piotroski_score * VALUE_WEIGHTS['piotroski_score']
    ) * 10  # Convert to 0-100 scale

    return total_score, breakdown


def calculate_final_score(data: FundamentalData) -> ScoringResult:
    """
    Calculate final score using appropriate engine(s).

    Returns:
        ScoringResult with classification and scores
    """
    # Step 1: Classify the stock
    classification, reason = classify_stock(data)

    result = ScoringResult(
        classification=classification,
        classification_reason=reason
    )

    # Step 2: Run appropriate engine(s)
    if classification == 'growth':
        score, breakdown = score_growth_engine(data)
        result.growth_engine_score = score
        result.final_score = score
        result.score_breakdown = {'growth_engine': breakdown}

    elif classification == 'value':
        score, breakdown = score_value_engine(data)
        result.value_engine_score = score
        result.final_score = score
        result.score_breakdown = {'value_engine': breakdown}

    else:  # hybrid
        growth_score, growth_breakdown = score_growth_engine(data)
        value_score, value_breakdown = score_value_engine(data)

        result.growth_engine_score = growth_score
        result.value_engine_score = value_score
        result.final_score = (growth_score + value_score) / 2  # 50/50 average
        result.score_breakdown = {
            'growth_engine': growth_breakdown,
            'value_engine': value_breakdown
        }

    return result


# ============================================================================
# Database Storage Functions
# ============================================================================
def store_fundamental_snapshot(conn, asset_id: int, data: FundamentalData, result: ScoringResult):
    """Store calculated metrics in fundamental_snapshot table."""

    # Calculate all the derived metrics
    revenue_cagr = calculate_cagr(data.revenue_history, years=3)

    rev_growth_yoy = None
    if len(data.revenue_history) >= 2 and data.revenue_history[1]:
        rev_growth_yoy = (data.revenue_history[0] - data.revenue_history[1]) / data.revenue_history[1]

    rev_growth_qoq = None
    if len(data.quarterly_revenue) >= 2 and data.quarterly_revenue[1]:
        rev_growth_qoq = (data.quarterly_revenue[0] - data.quarterly_revenue[1]) / data.quarterly_revenue[1]

    rev_accel = calculate_revenue_acceleration(data.quarterly_revenue)

    rule_of_40 = None
    ebitda_margin = safe_divide(data.ebitda_ttm, data.revenue_ttm)
    if rev_growth_yoy is not None and ebitda_margin is not None:
        rule_of_40 = (rev_growth_yoy * 100) + (ebitda_margin * 100)

    gross_margin = safe_divide(data.gross_profit_ttm, data.revenue_ttm)
    operating_margin = safe_divide(data.operating_income_ttm, data.revenue_ttm)

    fcf_yield = safe_divide(data.free_cash_flow, data.market_cap)
    fcf_margin = safe_divide(data.free_cash_flow, data.revenue_ttm)

    debt_equity = safe_divide(data.total_debt, data.total_equity)
    current_ratio = safe_divide(data.current_assets, data.current_liabilities)
    interest_coverage = None  # Would need interest expense data

    div_payout = safe_divide(data.dividends_paid, data.net_income_ttm) if data.dividends_paid and data.dividends_paid < 0 else None

    piotroski, piotroski_components = calculate_piotroski_score(data)

    # Historical averages
    pe_5y_avg = None
    if data.pe_history and len(data.pe_history) > 0:
        valid_pes = [p for p in data.pe_history if p and p > 0]
        if valid_pes:
            pe_5y_avg = sum(valid_pes) / len(valid_pes)

    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO fundamental_snapshot (
                asset_id, classification, classification_reason,
                revenue_cagr_3y, revenue_growth_yoy, revenue_growth_qoq, revenue_acceleration,
                rule_of_40, gross_margin, ebitda_margin, operating_margin,
                fcf_yield, fcf_margin, debt_to_equity, current_ratio, interest_coverage,
                dividend_yield, dividend_payout_ratio, dividend_growth_years,
                piotroski_score, piotroski_components,
                pe_5y_avg, ps_5y_avg, pb_5y_avg,
                growth_engine_score, value_engine_score, base_fundamental_score,
                data_source, data_freshness
            ) VALUES (
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s
            )
            ON CONFLICT (asset_id) DO UPDATE SET
                classification = EXCLUDED.classification,
                classification_reason = EXCLUDED.classification_reason,
                revenue_cagr_3y = EXCLUDED.revenue_cagr_3y,
                revenue_growth_yoy = EXCLUDED.revenue_growth_yoy,
                revenue_growth_qoq = EXCLUDED.revenue_growth_qoq,
                revenue_acceleration = EXCLUDED.revenue_acceleration,
                rule_of_40 = EXCLUDED.rule_of_40,
                gross_margin = EXCLUDED.gross_margin,
                ebitda_margin = EXCLUDED.ebitda_margin,
                operating_margin = EXCLUDED.operating_margin,
                fcf_yield = EXCLUDED.fcf_yield,
                fcf_margin = EXCLUDED.fcf_margin,
                debt_to_equity = EXCLUDED.debt_to_equity,
                current_ratio = EXCLUDED.current_ratio,
                interest_coverage = EXCLUDED.interest_coverage,
                dividend_yield = EXCLUDED.dividend_yield,
                dividend_payout_ratio = EXCLUDED.dividend_payout_ratio,
                dividend_growth_years = EXCLUDED.dividend_growth_years,
                piotroski_score = EXCLUDED.piotroski_score,
                piotroski_components = EXCLUDED.piotroski_components,
                pe_5y_avg = EXCLUDED.pe_5y_avg,
                ps_5y_avg = EXCLUDED.ps_5y_avg,
                pb_5y_avg = EXCLUDED.pb_5y_avg,
                growth_engine_score = EXCLUDED.growth_engine_score,
                value_engine_score = EXCLUDED.value_engine_score,
                base_fundamental_score = EXCLUDED.base_fundamental_score,
                data_source = EXCLUDED.data_source,
                data_freshness = EXCLUDED.data_freshness,
                updated_at = NOW()
        """, (
            asset_id, result.classification, result.classification_reason,
            revenue_cagr, rev_growth_yoy, rev_growth_qoq, rev_accel,
            rule_of_40, gross_margin, ebitda_margin, operating_margin,
            fcf_yield, fcf_margin, debt_equity, current_ratio, interest_coverage,
            data.dividend_yield, div_payout, None,  # dividend_growth_years would need historical data
            piotroski, json.dumps(piotroski_components),
            pe_5y_avg, None, None,  # ps_5y_avg, pb_5y_avg would need historical data
            result.growth_engine_score, result.value_engine_score, result.final_score,
            'fmp', 'current'
        ))

    conn.commit()


def store_daily_score(conn, asset_id: int, data: FundamentalData, result: ScoringResult):
    """Store daily score in fundamental_scores table."""
    today = datetime.now().date()

    # Get PE vs 5Y average
    pe_vs_5y = None
    if data.pe_ratio and data.pe_history:
        valid_pes = [p for p in data.pe_history if p and p > 0]
        if valid_pes:
            avg_pe = sum(valid_pes) / len(valid_pes)
            pe_vs_5y = data.pe_ratio / avg_pe

    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO fundamental_scores (
                asset_id, as_of_date, classification,
                pe_ratio, forward_pe, peg_ratio, price_to_sales, price_to_book,
                ev_to_ebitda, ev_to_revenue,
                pe_vs_5y_avg, ps_vs_5y_avg, pb_vs_5y_avg,
                price_vs_sma_200, price_vs_sma_50, dist_from_52w_high,
                valuation_score, technical_score, fundamental_base_score,
                final_score, score_breakdown
            ) VALUES (
                %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s
            )
            ON CONFLICT (asset_id, as_of_date) DO UPDATE SET
                classification = EXCLUDED.classification,
                pe_ratio = EXCLUDED.pe_ratio,
                forward_pe = EXCLUDED.forward_pe,
                peg_ratio = EXCLUDED.peg_ratio,
                price_to_sales = EXCLUDED.price_to_sales,
                price_to_book = EXCLUDED.price_to_book,
                ev_to_ebitda = EXCLUDED.ev_to_ebitda,
                ev_to_revenue = EXCLUDED.ev_to_revenue,
                pe_vs_5y_avg = EXCLUDED.pe_vs_5y_avg,
                ps_vs_5y_avg = EXCLUDED.ps_vs_5y_avg,
                pb_vs_5y_avg = EXCLUDED.pb_vs_5y_avg,
                price_vs_sma_200 = EXCLUDED.price_vs_sma_200,
                price_vs_sma_50 = EXCLUDED.price_vs_sma_50,
                dist_from_52w_high = EXCLUDED.dist_from_52w_high,
                valuation_score = EXCLUDED.valuation_score,
                technical_score = EXCLUDED.technical_score,
                fundamental_base_score = EXCLUDED.fundamental_base_score,
                final_score = EXCLUDED.final_score,
                score_breakdown = EXCLUDED.score_breakdown,
                updated_at = NOW()
        """, (
            asset_id, today, result.classification,
            data.pe_ratio, data.forward_pe, data.peg_ratio, data.price_to_sales, data.price_to_book,
            data.ev_to_ebitda, data.ev_to_revenue,
            pe_vs_5y, None, None,  # ps_vs_5y, pb_vs_5y would need historical data
            None, None, None,  # Technical metrics - will be added from daily_features
            None, None, result.final_score,  # valuation_score, technical_score calculated separately
            result.final_score, json.dumps(result.score_breakdown)
        ))

    conn.commit()


# ============================================================================
# Main Processing Functions
# ============================================================================
def process_equity(conn, symbol: str, asset_id: int) -> bool:
    """
    Process a single equity: fetch data, classify, score, and store.

    Returns:
        True if successful, False otherwise
    """
    try:
        # Fetch all fundamental data
        logger.info(f"  Fetching data for {symbol}...")
        data = fetch_fundamental_data(symbol, asset_id)

        if not data or not data.market_cap:
            logger.warning(f"  Insufficient data for {symbol}")
            return False

        # Calculate scores
        logger.info(f"  Calculating scores for {symbol}...")
        result = calculate_final_score(data)

        logger.info(f"  {symbol}: {result.classification.upper()} | Score: {result.final_score:.1f}")
        logger.debug(f"    Reason: {result.classification_reason}")

        # Store results
        store_fundamental_snapshot(conn, asset_id, data, result)
        store_daily_score(conn, asset_id, data, result)

        return True

    except Exception as e:
        logger.error(f"  Error processing {symbol}: {e}")
        import traceback
        traceback.print_exc()
        return False


def run_monthly_refresh(conn, limit: Optional[int] = None, symbols: Optional[List[str]] = None):
    """
    Run monthly fundamental refresh for all equities.
    """
    logger.info("=" * 60)
    logger.info("MONTHLY FUNDAMENTAL REFRESH")
    logger.info("=" * 60)

    if symbols:
        # Process specific symbols
        with conn.cursor() as cur:
            placeholders = ','.join(['%s'] * len(symbols))
            cur.execute(f"""
                SELECT a.asset_id, a.symbol
                FROM assets a
                WHERE a.symbol IN ({placeholders}) AND a.asset_type = 'equity'
            """, symbols)
            equities = [{'asset_id': row[0], 'symbol': row[1]} for row in cur.fetchall()]
    else:
        equities = get_equities_to_process(conn, limit)

    logger.info(f"Processing {len(equities)} equities")

    success_count = 0
    error_count = 0

    for i, equity in enumerate(equities):
        symbol = equity['symbol']
        asset_id = equity['asset_id']

        logger.info(f"[{i+1}/{len(equities)}] Processing {symbol}")

        if process_equity(conn, symbol, asset_id):
            success_count += 1
        else:
            error_count += 1

    # Calculate rankings after all scores are in
    logger.info("Calculating rankings...")
    calculate_rankings(conn)

    logger.info("=" * 60)
    logger.info("SUMMARY")
    logger.info(f"  Successful: {success_count}")
    logger.info(f"  Errors: {error_count}")
    logger.info("=" * 60)


def calculate_rankings(conn):
    """Calculate and update rankings for all scored equities."""
    today = datetime.now().date()

    with conn.cursor() as cur:
        # Rank in universe (all equities)
        cur.execute("""
            WITH ranked AS (
                SELECT
                    asset_id,
                    ROW_NUMBER() OVER (ORDER BY final_score DESC) as rank_universe,
                    PERCENT_RANK() OVER (ORDER BY final_score DESC) * 100 as percentile
                FROM fundamental_scores
                WHERE as_of_date = %s
            )
            UPDATE fundamental_scores fs
            SET
                rank_in_universe = r.rank_universe,
                percentile = r.percentile
            FROM ranked r
            WHERE fs.asset_id = r.asset_id AND fs.as_of_date = %s
        """, (today, today))

        # Rank within classification
        cur.execute("""
            WITH ranked AS (
                SELECT
                    asset_id,
                    ROW_NUMBER() OVER (PARTITION BY classification ORDER BY final_score DESC) as rank_class
                FROM fundamental_scores
                WHERE as_of_date = %s
            )
            UPDATE fundamental_scores fs
            SET rank_in_classification = r.rank_class
            FROM ranked r
            WHERE fs.asset_id = r.asset_id AND fs.as_of_date = %s
        """, (today, today))

        # Calculate score deltas
        cur.execute("""
            UPDATE fundamental_scores fs
            SET
                score_delta_1d = fs.final_score - COALESCE(
                    (SELECT final_score FROM fundamental_scores
                     WHERE asset_id = fs.asset_id AND as_of_date = fs.as_of_date - 1),
                    fs.final_score
                ),
                score_delta_5d = fs.final_score - COALESCE(
                    (SELECT final_score FROM fundamental_scores
                     WHERE asset_id = fs.asset_id AND as_of_date = fs.as_of_date - 5),
                    fs.final_score
                )
            WHERE as_of_date = %s
        """, (today,))

    conn.commit()


# ============================================================================
# Main Entry Point
# ============================================================================
def main():
    parser = argparse.ArgumentParser(description='Context-Aware Stock Scoring Engine')
    parser.add_argument('--mode', choices=['monthly', 'daily'], default='monthly',
                       help='Run mode: monthly (full refresh) or daily (valuation update)')
    parser.add_argument('--symbols', nargs='+', help='Specific symbols to process')
    parser.add_argument('--limit', type=int, help='Maximum number of equities to process')
    parser.add_argument('--debug', action='store_true', help='Enable debug logging')

    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    if not FMP_API_KEY:
        logger.error("FMP_API_KEY environment variable not set")
        logger.error("Please set it with: export FMP_API_KEY=your_key_here")
        sys.exit(1)

    conn = get_db_connection()

    try:
        if args.mode == 'monthly':
            run_monthly_refresh(conn, limit=args.limit, symbols=args.symbols)
        else:
            # Daily mode - would update just valuation metrics
            logger.info("Daily mode not yet implemented - use monthly for now")
            run_monthly_refresh(conn, limit=args.limit, symbols=args.symbols)
    finally:
        conn.close()


if __name__ == '__main__':
    main()
