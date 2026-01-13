"""
Fundamental Vigor Score (FVS) Engine

This module implements the Qualitative Fundamental Analysis scoring system using:
1. FMP (Financial Modeling Prep) for financial data
2. Python for deterministic metric calculations
3. Gemini LLM for qualitative analysis and scoring

The FVS is completely separate from the technical analysis signal workflow.
It provides a 0-100 score based on four pillars:
- Profitability & Efficiency (35%)
- Solvency & Liquidity (25%)
- Growth & Momentum (20%)
- Quality & Moat (20%)

Author: Stratos Team
Date: 2026-01-13
"""

import os
import json
import time
import hashlib
import logging
import requests
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, date
from dataclasses import dataclass, field, asdict
from decimal import Decimal

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

# ============================================================================
# Configuration
# ============================================================================
FMP_API_KEY = os.environ.get("FMP_API_KEY")
FMP_BASE_URL = "https://financialmodelingprep.com/stable"

# Rate limiting
REQUEST_DELAY = 0.2  # 200ms between requests

# Prompt files
PROMPT_DIR = Path(__file__).parent.parent.parent.parent / "prompts"

# Pillar weights
PILLAR_WEIGHTS = {
    'profitability': 0.35,
    'solvency': 0.25,
    'growth': 0.20,
    'moat': 0.20
}


# ============================================================================
# Data Classes
# ============================================================================
@dataclass
class QuantitativeMetrics:
    """Pre-calculated quantitative metrics for FVS analysis."""
    # Profitability Metrics
    roic: Optional[float] = None
    gross_margin: Optional[float] = None
    gross_margin_trend: Optional[float] = None
    operating_margin: Optional[float] = None
    net_margin: Optional[float] = None
    asset_turnover: Optional[float] = None
    roe: Optional[float] = None
    roa: Optional[float] = None
    
    # DuPont Components
    dupont_profit_margin: Optional[float] = None
    dupont_asset_turnover: Optional[float] = None
    dupont_equity_multiplier: Optional[float] = None
    
    # Solvency & Liquidity
    current_ratio: Optional[float] = None
    quick_ratio: Optional[float] = None
    cash_ratio: Optional[float] = None
    net_debt_to_ebitda: Optional[float] = None
    interest_coverage: Optional[float] = None
    debt_to_equity: Optional[float] = None
    debt_to_assets: Optional[float] = None
    altman_z_score: Optional[float] = None
    
    # Growth Metrics
    revenue_cagr_4y: Optional[float] = None
    ebitda_cagr_4y: Optional[float] = None
    fcf_cagr_4y: Optional[float] = None
    eps_cagr_4y: Optional[float] = None
    revenue_growth_yoy: Optional[float] = None
    revenue_acceleration: Optional[float] = None
    
    # Quality & Moat
    accruals_ratio: Optional[float] = None
    fcf_to_net_income: Optional[float] = None
    share_buyback_yield: Optional[float] = None
    dividend_yield: Optional[float] = None
    peg_ratio: Optional[float] = None
    
    # Piotroski F-Score Components
    piotroski_f_score: Optional[int] = None
    piotroski_components: Dict[str, bool] = field(default_factory=dict)
    
    # Raw values for context
    revenue_ttm: Optional[float] = None
    ebitda_ttm: Optional[float] = None
    net_income_ttm: Optional[float] = None
    free_cash_flow_ttm: Optional[float] = None
    total_debt: Optional[float] = None
    total_equity: Optional[float] = None
    total_assets: Optional[float] = None
    cash_and_equivalents: Optional[float] = None
    market_cap: Optional[float] = None
    
    # Historical arrays
    revenue_history: List[float] = field(default_factory=list)
    ebitda_history: List[float] = field(default_factory=list)
    net_income_history: List[float] = field(default_factory=list)
    fcf_history: List[float] = field(default_factory=list)
    quarterly_revenue: List[float] = field(default_factory=list)


@dataclass
class FVSResult:
    """Result of FVS calculation."""
    asset_id: int
    symbol: str
    as_of_date: str
    
    # Pillar scores
    profitability_score: int
    solvency_score: int
    growth_score: int
    moat_score: int
    
    # Final score (calculated)
    final_score: float
    
    # Metadata
    confidence_level: str
    data_quality_score: float
    piotroski_f_score: Optional[int]
    altman_z_score: Optional[float]
    
    # Reasoning
    reasoning_scratchpad: str
    final_reasoning_paragraph: str
    
    # Full breakdown
    score_breakdown: Dict[str, Any]
    quantitative_metrics: Dict[str, Any]
    
    # Model info
    model_name: str
    prompt_version: str
    input_hash: str


# ============================================================================
# FMP API Functions
# ============================================================================
def get_fmp(endpoint: str, params: Optional[Dict] = None) -> Any:
    """
    Fetch data from FMP stable API with rate limiting.
    
    The stable API uses query params for all parameters including symbol.
    e.g., /stable/profile?symbol=AAPL&apikey=xxx
    """
    if not FMP_API_KEY:
        logger.error("FMP_API_KEY environment variable not set")
        return None
    
    url = f"{FMP_BASE_URL}/{endpoint}"
    params = params or {}
    params['apikey'] = FMP_API_KEY
    
    try:
        time.sleep(REQUEST_DELAY)
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
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


# ============================================================================
# Metric Calculation Functions
# ============================================================================
def safe_divide(numerator: Optional[float], denominator: Optional[float]) -> Optional[float]:
    """Safely divide two numbers, returning None if invalid."""
    if numerator is None or denominator is None or denominator == 0:
        return None
    return numerator / denominator


def calculate_cagr(values: List[float], years: int = 4) -> Optional[float]:
    """Calculate Compound Annual Growth Rate."""
    if not values or len(values) < 2:
        return None
    
    # Values should be in reverse chronological order (most recent first)
    end_value = values[0]
    start_idx = min(years, len(values) - 1)
    start_value = values[start_idx]
    
    if start_value is None or end_value is None or start_value <= 0 or end_value <= 0:
        return None
    
    actual_years = start_idx
    if actual_years == 0:
        return None
    
    return (end_value / start_value) ** (1 / actual_years) - 1


def calculate_altman_z_score(
    working_capital: Optional[float],
    retained_earnings: Optional[float],
    ebit: Optional[float],
    market_cap: Optional[float],
    total_liabilities: Optional[float],
    revenue: Optional[float],
    total_assets: Optional[float]
) -> Optional[float]:
    """
    Calculate Altman Z-Score for manufacturing companies.
    Z = 1.2*A + 1.4*B + 3.3*C + 0.6*D + 1.0*E
    Where:
    A = Working Capital / Total Assets
    B = Retained Earnings / Total Assets
    C = EBIT / Total Assets
    D = Market Value of Equity / Total Liabilities
    E = Sales / Total Assets
    """
    if total_assets is None or total_assets <= 0:
        return None
    
    a = safe_divide(working_capital, total_assets) or 0
    b = safe_divide(retained_earnings, total_assets) or 0
    c = safe_divide(ebit, total_assets) or 0
    d = safe_divide(market_cap, total_liabilities) if total_liabilities else 0
    e = safe_divide(revenue, total_assets) or 0
    
    return 1.2 * a + 1.4 * b + 3.3 * c + 0.6 * d + 1.0 * e


def calculate_piotroski_f_score(
    net_income: Optional[float],
    operating_cash_flow: Optional[float],
    roa_current: Optional[float],
    roa_prior: Optional[float],
    debt_ratio_current: Optional[float],
    debt_ratio_prior: Optional[float],
    current_ratio_current: Optional[float],
    current_ratio_prior: Optional[float],
    shares_current: Optional[float],
    shares_prior: Optional[float],
    gross_margin_current: Optional[float],
    gross_margin_prior: Optional[float],
    asset_turnover_current: Optional[float],
    asset_turnover_prior: Optional[float]
) -> Tuple[int, Dict[str, bool]]:
    """
    Calculate Piotroski F-Score (0-9).
    Returns tuple of (score, component_dict).
    """
    components = {}
    score = 0
    
    # Profitability (4 points)
    # 1. Positive Net Income
    components['positive_net_income'] = net_income is not None and net_income > 0
    if components['positive_net_income']:
        score += 1
    
    # 2. Positive Operating Cash Flow
    components['positive_ocf'] = operating_cash_flow is not None and operating_cash_flow > 0
    if components['positive_ocf']:
        score += 1
    
    # 3. ROA Increasing
    components['roa_increasing'] = (
        roa_current is not None and roa_prior is not None and roa_current > roa_prior
    )
    if components['roa_increasing']:
        score += 1
    
    # 4. OCF > Net Income (quality of earnings)
    components['ocf_gt_net_income'] = (
        operating_cash_flow is not None and net_income is not None and 
        operating_cash_flow > net_income
    )
    if components['ocf_gt_net_income']:
        score += 1
    
    # Leverage & Liquidity (3 points)
    # 5. Debt ratio decreasing
    components['debt_ratio_decreasing'] = (
        debt_ratio_current is not None and debt_ratio_prior is not None and
        debt_ratio_current < debt_ratio_prior
    )
    if components['debt_ratio_decreasing']:
        score += 1
    
    # 6. Current ratio increasing
    components['current_ratio_increasing'] = (
        current_ratio_current is not None and current_ratio_prior is not None and
        current_ratio_current > current_ratio_prior
    )
    if components['current_ratio_increasing']:
        score += 1
    
    # 7. No share dilution
    components['no_dilution'] = (
        shares_current is not None and shares_prior is not None and
        shares_current <= shares_prior
    )
    if components['no_dilution']:
        score += 1
    
    # Operating Efficiency (2 points)
    # 8. Gross margin increasing
    components['gross_margin_increasing'] = (
        gross_margin_current is not None and gross_margin_prior is not None and
        gross_margin_current > gross_margin_prior
    )
    if components['gross_margin_increasing']:
        score += 1
    
    # 9. Asset turnover increasing
    components['asset_turnover_increasing'] = (
        asset_turnover_current is not None and asset_turnover_prior is not None and
        asset_turnover_current > asset_turnover_prior
    )
    if components['asset_turnover_increasing']:
        score += 1
    
    return score, components


def calculate_revenue_acceleration(quarterly_revenue: List[float]) -> Optional[float]:
    """
    Calculate revenue acceleration (change in growth rate).
    Positive = growth is speeding up, Negative = growth is slowing down.
    """
    if not quarterly_revenue or len(quarterly_revenue) < 5:
        return None
    
    # Calculate YoY growth for recent quarter vs prior quarter
    # quarterly_revenue[0] = most recent, quarterly_revenue[4] = 4 quarters ago
    recent_yoy = safe_divide(
        quarterly_revenue[0] - quarterly_revenue[4],
        quarterly_revenue[4]
    )
    prior_yoy = safe_divide(
        quarterly_revenue[1] - quarterly_revenue[5] if len(quarterly_revenue) > 5 else None,
        quarterly_revenue[5] if len(quarterly_revenue) > 5 else None
    )
    
    if recent_yoy is None or prior_yoy is None:
        return None
    
    return recent_yoy - prior_yoy


# ============================================================================
# Data Fetching and Processing
# ============================================================================
def fetch_fundamental_data(symbol: str) -> Optional[QuantitativeMetrics]:
    """Fetch all fundamental data from FMP and calculate metrics."""
    metrics = QuantitativeMetrics()
    
    # 1. Company Profile (stable API uses query params)
    logger.debug(f"Fetching profile for {symbol}")
    profile = get_fmp("profile", params={'symbol': symbol})
    if profile and len(profile) > 0:
        p = profile[0]
        metrics.market_cap = p.get('mktCap')
    
    # 2. Income Statement (annual, last 5 years)
    logger.debug(f"Fetching income statement for {symbol}")
    income = get_fmp("income-statement", params={'symbol': symbol, 'limit': 5})
    if income and len(income) > 0:
        latest = income[0]
        metrics.revenue_ttm = latest.get('revenue')
        metrics.ebitda_ttm = latest.get('ebitda')
        metrics.net_income_ttm = latest.get('netIncome')
        
        # Calculate margins
        metrics.gross_margin = safe_divide(latest.get('grossProfit'), latest.get('revenue'))
        metrics.operating_margin = safe_divide(latest.get('operatingIncome'), latest.get('revenue'))
        metrics.net_margin = safe_divide(latest.get('netIncome'), latest.get('revenue'))
        
        # Historical data
        metrics.revenue_history = [i.get('revenue') for i in income if i.get('revenue')]
        metrics.ebitda_history = [i.get('ebitda') for i in income if i.get('ebitda')]
        metrics.net_income_history = [i.get('netIncome') for i in income if i.get('netIncome')]
        
        # Gross margin trend (YoY change)
        if len(income) >= 2:
            gm_current = safe_divide(income[0].get('grossProfit'), income[0].get('revenue'))
            gm_prior = safe_divide(income[1].get('grossProfit'), income[1].get('revenue'))
            if gm_current is not None and gm_prior is not None:
                metrics.gross_margin_trend = gm_current - gm_prior
    
    # 3. Income Statement (quarterly, last 8 quarters)
    logger.debug(f"Fetching quarterly income for {symbol}")
    quarterly = get_fmp("income-statement", params={'symbol': symbol, 'period': 'quarter', 'limit': 8})
    if quarterly:
        metrics.quarterly_revenue = [q.get('revenue') for q in quarterly if q.get('revenue')]
        metrics.revenue_acceleration = calculate_revenue_acceleration(metrics.quarterly_revenue)
    
    # 4. Balance Sheet
    logger.debug(f"Fetching balance sheet for {symbol}")
    balance = get_fmp("balance-sheet-statement", params={'symbol': symbol, 'limit': 2})
    if balance and len(balance) > 0:
        b = balance[0]
        metrics.total_assets = b.get('totalAssets')
        metrics.total_equity = b.get('totalStockholdersEquity')
        metrics.total_debt = b.get('totalDebt')
        metrics.cash_and_equivalents = b.get('cashAndCashEquivalents')
        
        current_assets = b.get('totalCurrentAssets')
        current_liabilities = b.get('totalCurrentLiabilities')
        inventory = b.get('inventory', 0)
        total_liabilities = b.get('totalLiabilities')
        retained_earnings = b.get('retainedEarnings')
        
        # Liquidity ratios
        metrics.current_ratio = safe_divide(current_assets, current_liabilities)
        metrics.quick_ratio = safe_divide(
            (current_assets or 0) - (inventory or 0),
            current_liabilities
        )
        metrics.cash_ratio = safe_divide(metrics.cash_and_equivalents, current_liabilities)
        
        # Leverage ratios
        metrics.debt_to_equity = safe_divide(metrics.total_debt, metrics.total_equity)
        metrics.debt_to_assets = safe_divide(metrics.total_debt, metrics.total_assets)
        
        # Asset turnover
        metrics.asset_turnover = safe_divide(metrics.revenue_ttm, metrics.total_assets)
        
        # ROE and ROA
        metrics.roe = safe_divide(metrics.net_income_ttm, metrics.total_equity)
        metrics.roa = safe_divide(metrics.net_income_ttm, metrics.total_assets)
        
        # DuPont Analysis
        metrics.dupont_profit_margin = metrics.net_margin
        metrics.dupont_asset_turnover = metrics.asset_turnover
        metrics.dupont_equity_multiplier = safe_divide(metrics.total_assets, metrics.total_equity)
        
        # Altman Z-Score
        working_capital = (current_assets or 0) - (current_liabilities or 0)
        ebit = income[0].get('operatingIncome') if income else None
        metrics.altman_z_score = calculate_altman_z_score(
            working_capital, retained_earnings, ebit,
            metrics.market_cap, total_liabilities,
            metrics.revenue_ttm, metrics.total_assets
        )
    
    # 5. Cash Flow Statement
    logger.debug(f"Fetching cash flow for {symbol}")
    cashflow = get_fmp("cash-flow-statement", params={'symbol': symbol, 'limit': 5})
    if cashflow and len(cashflow) > 0:
        cf = cashflow[0]
        ocf = cf.get('operatingCashFlow')
        capex = abs(cf.get('capitalExpenditure', 0))
        
        metrics.free_cash_flow_ttm = (ocf or 0) - capex
        metrics.fcf_history = [
            (c.get('operatingCashFlow', 0) or 0) - abs(c.get('capitalExpenditure', 0) or 0)
            for c in cashflow
        ]
        
        # FCF to Net Income conversion
        metrics.fcf_to_net_income = safe_divide(metrics.free_cash_flow_ttm, metrics.net_income_ttm)
        
        # Accruals ratio
        if metrics.total_assets and len(balance) >= 2:
            avg_assets = (metrics.total_assets + (balance[1].get('totalAssets') or metrics.total_assets)) / 2
            accruals = (metrics.net_income_ttm or 0) - (ocf or 0)
            metrics.accruals_ratio = safe_divide(accruals, avg_assets)
        
        # Interest coverage
        interest_expense = cf.get('interestExpense') or income[0].get('interestExpense') if income else None
        ebit = income[0].get('operatingIncome') if income else None
        metrics.interest_coverage = safe_divide(ebit, interest_expense)
        
        # Net Debt / EBITDA
        net_debt = (metrics.total_debt or 0) - (metrics.cash_and_equivalents or 0)
        metrics.net_debt_to_ebitda = safe_divide(net_debt, metrics.ebitda_ttm)
    
    # 6. Key Ratios from FMP
    logger.debug(f"Fetching key metrics for {symbol}")
    ratios = get_fmp("ratios-ttm", params={'symbol': symbol})
    if ratios and len(ratios) > 0:
        r = ratios[0]
        metrics.peg_ratio = r.get('pegRatioTTM')
        metrics.dividend_yield = r.get('dividendYieldTTM')
        
        # ROIC
        metrics.roic = r.get('returnOnCapitalEmployedTTM')
    
    # 7. Calculate CAGRs
    metrics.revenue_cagr_4y = calculate_cagr(metrics.revenue_history, 4)
    metrics.ebitda_cagr_4y = calculate_cagr(metrics.ebitda_history, 4)
    metrics.fcf_cagr_4y = calculate_cagr(metrics.fcf_history, 4)
    
    # YoY revenue growth
    if len(metrics.revenue_history) >= 2:
        metrics.revenue_growth_yoy = safe_divide(
            metrics.revenue_history[0] - metrics.revenue_history[1],
            metrics.revenue_history[1]
        )
    
    # 8. Piotroski F-Score
    if balance and len(balance) >= 2 and income and len(income) >= 2:
        b_current, b_prior = balance[0], balance[1]
        i_current, i_prior = income[0], income[1]
        
        roa_current = safe_divide(i_current.get('netIncome'), b_current.get('totalAssets'))
        roa_prior = safe_divide(i_prior.get('netIncome'), b_prior.get('totalAssets'))
        
        debt_ratio_current = safe_divide(b_current.get('totalDebt'), b_current.get('totalAssets'))
        debt_ratio_prior = safe_divide(b_prior.get('totalDebt'), b_prior.get('totalAssets'))
        
        cr_current = safe_divide(b_current.get('totalCurrentAssets'), b_current.get('totalCurrentLiabilities'))
        cr_prior = safe_divide(b_prior.get('totalCurrentAssets'), b_prior.get('totalCurrentLiabilities'))
        
        gm_current = safe_divide(i_current.get('grossProfit'), i_current.get('revenue'))
        gm_prior = safe_divide(i_prior.get('grossProfit'), i_prior.get('revenue'))
        
        at_current = safe_divide(i_current.get('revenue'), b_current.get('totalAssets'))
        at_prior = safe_divide(i_prior.get('revenue'), b_prior.get('totalAssets'))
        
        ocf = cashflow[0].get('operatingCashFlow') if cashflow else None
        
        metrics.piotroski_f_score, metrics.piotroski_components = calculate_piotroski_f_score(
            metrics.net_income_ttm, ocf,
            roa_current, roa_prior,
            debt_ratio_current, debt_ratio_prior,
            cr_current, cr_prior,
            b_current.get('commonStockSharesOutstanding'),
            b_prior.get('commonStockSharesOutstanding'),
            gm_current, gm_prior,
            at_current, at_prior
        )
    
    return metrics


# ============================================================================
# FVS Engine Class
# ============================================================================
class FundamentalVigorScoreEngine:
    """
    Fundamental Vigor Score Engine using Gemini LLM.
    
    This is completely separate from the technical analysis signal workflow.
    """
    
    PROMPT_VERSION = "1.0"
    DEFAULT_MODEL = "gemini-3-pro-preview"
    
    def __init__(self, db, api_key: Optional[str] = None, model: Optional[str] = None):
        self.db = db
        
        # Configure Gemini API
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not set in environment or provided")
        
        self.client = genai.Client(api_key=self.api_key)
        self.model_name = model or os.environ.get("GEMINI_MODEL") or self.DEFAULT_MODEL
        
        self._load_prompts()
        logger.info(f"FVS Engine initialized with model: {self.model_name}, version: {self.PROMPT_VERSION}")
    
    def _load_prompts(self) -> None:
        """Load system prompt and schema."""
        self.system_prompt = (PROMPT_DIR / "fvs_system.txt").read_text()
        self.output_schema = json.loads((PROMPT_DIR / "fvs_schema.json").read_text())
    
    def _build_context_packet(
        self,
        symbol: str,
        name: str,
        sector: Optional[str],
        industry: Optional[str],
        as_of_date: str,
        metrics: QuantitativeMetrics
    ) -> Dict[str, Any]:
        """Build the context packet for the LLM."""
        
        # Convert metrics to dict, handling None values
        metrics_dict = {}
        for key, value in asdict(metrics).items():
            if value is not None:
                if isinstance(value, float):
                    # Round floats for cleaner presentation
                    metrics_dict[key] = round(value, 4)
                else:
                    metrics_dict[key] = value
        
        packet = {
            "company": {
                "symbol": symbol,
                "name": name,
                "sector": sector or "Unknown",
                "industry": industry or "Unknown"
            },
            "as_of_date": as_of_date,
            "quantitative_metrics": metrics_dict,
            "financial_history": {
                "revenue_4y": metrics.revenue_history[:4] if metrics.revenue_history else [],
                "ebitda_4y": metrics.ebitda_history[:4] if metrics.ebitda_history else [],
                "net_income_4y": metrics.net_income_history[:4] if metrics.net_income_history else [],
                "fcf_4y": metrics.fcf_history[:4] if metrics.fcf_history else []
            },
            "quarterly_revenue_8q": metrics.quarterly_revenue[:8] if metrics.quarterly_revenue else [],
            "piotroski_details": {
                "score": metrics.piotroski_f_score,
                "components": metrics.piotroski_components
            },
            "shadow_scores": {
                "piotroski_f_score": metrics.piotroski_f_score,
                "altman_z_score": round(metrics.altman_z_score, 3) if metrics.altman_z_score else None
            }
        }
        
        return packet
    
    def _compute_input_hash(self, packet: Dict[str, Any]) -> str:
        """Compute hash of inputs for idempotency."""
        hash_content = {
            "symbol": packet["company"]["symbol"],
            "as_of_date": packet["as_of_date"],
            "metrics_hash": hashlib.md5(
                json.dumps(packet["quantitative_metrics"], sort_keys=True).encode()
            ).hexdigest(),
            "prompt_version": self.PROMPT_VERSION,
            "model": self.model_name
        }
        return hashlib.sha256(json.dumps(hash_content, sort_keys=True).encode()).hexdigest()
    
    def _check_existing_score(self, asset_id: int, as_of_date: str, input_hash: str) -> Optional[Dict]:
        """Check if we already have a score for this input."""
        query = """
        SELECT * FROM fundamental_vigor_scores
        WHERE asset_id = %s AND as_of_date = %s AND input_hash = %s
        ORDER BY created_at DESC LIMIT 1
        """
        result = self.db.fetch_one(query, (asset_id, as_of_date, input_hash))
        return dict(result) if result else None
    
    def _call_gemini(self, packet: Dict[str, Any]) -> Dict[str, Any]:
        """Call Gemini API with the context packet."""
        user_message = f"""
Analyze the following company's fundamental data and provide a Fundamental Vigor Score assessment.

INPUT DATA:
```json
{json.dumps(packet, indent=2)}
```

Provide your analysis following the scoring methodology in your instructions.
Return JSON only.
"""
        
        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=user_message,
                config=types.GenerateContentConfig(
                    system_instruction=self.system_prompt,
                    temperature=0,  # Deterministic
                    response_mime_type="application/json",
                    response_schema=self.output_schema
                )
            )
            
            return json.loads(response.text)
        
        except Exception as e:
            logger.error(f"Gemini API call failed: {e}")
            raise
    
    def _calculate_final_score(self, sub_scores: Dict[str, int]) -> float:
        """Calculate weighted final score from sub-scores."""
        return (
            sub_scores['profitability'] * PILLAR_WEIGHTS['profitability'] +
            sub_scores['solvency'] * PILLAR_WEIGHTS['solvency'] +
            sub_scores['growth'] * PILLAR_WEIGHTS['growth'] +
            sub_scores['moat'] * PILLAR_WEIGHTS['moat']
        )
    
    def _save_result(self, result: FVSResult) -> None:
        """Save FVS result to database."""
        query = """
        INSERT INTO fundamental_vigor_scores (
            asset_id, as_of_date,
            profitability_score, solvency_score, growth_score, moat_score,
            final_score, confidence_level, data_quality_score,
            piotroski_f_score, altman_z_score,
            reasoning_scratchpad, final_reasoning_paragraph,
            score_breakdown, quantitative_metrics,
            model_name, prompt_version, input_hash
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        ON CONFLICT (asset_id, as_of_date, prompt_version)
        DO UPDATE SET
            profitability_score = EXCLUDED.profitability_score,
            solvency_score = EXCLUDED.solvency_score,
            growth_score = EXCLUDED.growth_score,
            moat_score = EXCLUDED.moat_score,
            final_score = EXCLUDED.final_score,
            confidence_level = EXCLUDED.confidence_level,
            data_quality_score = EXCLUDED.data_quality_score,
            piotroski_f_score = EXCLUDED.piotroski_f_score,
            altman_z_score = EXCLUDED.altman_z_score,
            reasoning_scratchpad = EXCLUDED.reasoning_scratchpad,
            final_reasoning_paragraph = EXCLUDED.final_reasoning_paragraph,
            score_breakdown = EXCLUDED.score_breakdown,
            quantitative_metrics = EXCLUDED.quantitative_metrics,
            model_name = EXCLUDED.model_name,
            input_hash = EXCLUDED.input_hash,
            updated_at = NOW()
        """
        
        self.db.execute(query, (
            result.asset_id, result.as_of_date,
            result.profitability_score, result.solvency_score,
            result.growth_score, result.moat_score,
            result.final_score, result.confidence_level, result.data_quality_score,
            result.piotroski_f_score, result.altman_z_score,
            result.reasoning_scratchpad, result.final_reasoning_paragraph,
            json.dumps(result.score_breakdown), json.dumps(result.quantitative_metrics),
            result.model_name, result.prompt_version, result.input_hash
        ))
    
    def _save_inputs(self, asset_id: int, as_of_date: str, metrics: QuantitativeMetrics) -> None:
        """Save calculation inputs for auditing."""
        query = """
        INSERT INTO fvs_calculation_inputs (
            asset_id, as_of_date,
            roic, gross_margin, gross_margin_trend, operating_margin, net_margin,
            asset_turnover, roe, roa,
            dupont_profit_margin, dupont_asset_turnover, dupont_equity_multiplier,
            current_ratio, quick_ratio, cash_ratio, net_debt_to_ebitda,
            interest_coverage, debt_to_equity, debt_to_assets, altman_z_score,
            revenue_cagr_4y, ebitda_cagr_4y, fcf_cagr_4y, eps_cagr_4y,
            revenue_growth_yoy, revenue_acceleration,
            accruals_ratio, fcf_to_net_income, share_buyback_yield, dividend_yield, peg_ratio,
            piotroski_positive_net_income, piotroski_positive_ocf, piotroski_roa_increasing,
            piotroski_ocf_gt_net_income, piotroski_debt_ratio_decreasing,
            piotroski_current_ratio_increasing, piotroski_no_dilution,
            piotroski_gross_margin_increasing, piotroski_asset_turnover_increasing,
            revenue_ttm, ebitda_ttm, net_income_ttm, free_cash_flow_ttm,
            total_debt, total_equity, total_assets, cash_and_equivalents, market_cap,
            revenue_history, ebitda_history, net_income_history, fcf_history, quarterly_revenue
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        ON CONFLICT (asset_id, as_of_date) DO UPDATE SET
            roic = EXCLUDED.roic,
            gross_margin = EXCLUDED.gross_margin,
            current_ratio = EXCLUDED.current_ratio,
            altman_z_score = EXCLUDED.altman_z_score,
            revenue_cagr_4y = EXCLUDED.revenue_cagr_4y
        """
        
        pc = metrics.piotroski_components
        
        self.db.execute(query, (
            asset_id, as_of_date,
            metrics.roic, metrics.gross_margin, metrics.gross_margin_trend,
            metrics.operating_margin, metrics.net_margin, metrics.asset_turnover,
            metrics.roe, metrics.roa,
            metrics.dupont_profit_margin, metrics.dupont_asset_turnover, metrics.dupont_equity_multiplier,
            metrics.current_ratio, metrics.quick_ratio, metrics.cash_ratio, metrics.net_debt_to_ebitda,
            metrics.interest_coverage, metrics.debt_to_equity, metrics.debt_to_assets, metrics.altman_z_score,
            metrics.revenue_cagr_4y, metrics.ebitda_cagr_4y, metrics.fcf_cagr_4y, metrics.eps_cagr_4y,
            metrics.revenue_growth_yoy, metrics.revenue_acceleration,
            metrics.accruals_ratio, metrics.fcf_to_net_income, metrics.share_buyback_yield,
            metrics.dividend_yield, metrics.peg_ratio,
            pc.get('positive_net_income'), pc.get('positive_ocf'), pc.get('roa_increasing'),
            pc.get('ocf_gt_net_income'), pc.get('debt_ratio_decreasing'),
            pc.get('current_ratio_increasing'), pc.get('no_dilution'),
            pc.get('gross_margin_increasing'), pc.get('asset_turnover_increasing'),
            metrics.revenue_ttm, metrics.ebitda_ttm, metrics.net_income_ttm, metrics.free_cash_flow_ttm,
            metrics.total_debt, metrics.total_equity, metrics.total_assets,
            metrics.cash_and_equivalents, metrics.market_cap,
            json.dumps(metrics.revenue_history), json.dumps(metrics.ebitda_history),
            json.dumps(metrics.net_income_history), json.dumps(metrics.fcf_history),
            json.dumps(metrics.quarterly_revenue)
        ))
    
    def score_asset(
        self,
        asset_id: int,
        symbol: str,
        name: str,
        sector: Optional[str] = None,
        industry: Optional[str] = None,
        as_of_date: Optional[str] = None,
        force_refresh: bool = False
    ) -> Optional[FVSResult]:
        """
        Calculate Fundamental Vigor Score for a single asset.
        
        Args:
            asset_id: Database asset ID
            symbol: Stock ticker symbol
            name: Company name
            sector: Company sector
            industry: Company industry
            as_of_date: Date for the score (defaults to today)
            force_refresh: If True, recalculate even if cached
        
        Returns:
            FVSResult or None if scoring failed
        """
        as_of_date = as_of_date or date.today().isoformat()
        logger.info(f"Scoring {symbol} ({asset_id}) for {as_of_date}")
        
        # 1. Fetch fundamental data from FMP
        logger.info(f"Fetching fundamental data for {symbol}")
        metrics = fetch_fundamental_data(symbol)
        
        if metrics is None:
            logger.error(f"Failed to fetch fundamental data for {symbol}")
            return None
        
        # 2. Build context packet
        packet = self._build_context_packet(
            symbol, name, sector, industry, as_of_date, metrics
        )
        
        # 3. Check for existing score (idempotency)
        input_hash = self._compute_input_hash(packet)
        
        if not force_refresh:
            existing = self._check_existing_score(asset_id, as_of_date, input_hash)
            if existing:
                logger.info(f"Using cached FVS for {symbol}")
                return FVSResult(
                    asset_id=asset_id,
                    symbol=symbol,
                    as_of_date=as_of_date,
                    profitability_score=existing['profitability_score'],
                    solvency_score=existing['solvency_score'],
                    growth_score=existing['growth_score'],
                    moat_score=existing['moat_score'],
                    final_score=existing['final_score'],
                    confidence_level=existing['confidence_level'],
                    data_quality_score=existing['data_quality_score'],
                    piotroski_f_score=existing['piotroski_f_score'],
                    altman_z_score=existing['altman_z_score'],
                    reasoning_scratchpad=existing['reasoning_scratchpad'],
                    final_reasoning_paragraph=existing['final_reasoning_paragraph'],
                    score_breakdown=existing['score_breakdown'],
                    quantitative_metrics=existing['quantitative_metrics'],
                    model_name=existing['model_name'],
                    prompt_version=existing['prompt_version'],
                    input_hash=input_hash
                )
        
        # 4. Call Gemini for qualitative analysis
        logger.info(f"Calling Gemini for FVS analysis of {symbol}")
        try:
            llm_result = self._call_gemini(packet)
        except Exception as e:
            logger.error(f"LLM call failed for {symbol}: {e}")
            return None
        
        # 5. Extract scores and calculate final
        sub_scores = llm_result['sub_scores']
        final_score = self._calculate_final_score(sub_scores)
        
        # 6. Build result
        result = FVSResult(
            asset_id=asset_id,
            symbol=symbol,
            as_of_date=as_of_date,
            profitability_score=sub_scores['profitability'],
            solvency_score=sub_scores['solvency'],
            growth_score=sub_scores['growth'],
            moat_score=sub_scores['moat'],
            final_score=round(final_score, 2),
            confidence_level=llm_result['confidence_level'],
            data_quality_score=llm_result['data_quality_assessment']['data_quality_score'],
            piotroski_f_score=metrics.piotroski_f_score,
            altman_z_score=metrics.altman_z_score,
            reasoning_scratchpad=llm_result['reasoning_scratchpad'],
            final_reasoning_paragraph=llm_result['final_reasoning_paragraph'],
            score_breakdown=llm_result,
            quantitative_metrics=asdict(metrics),
            model_name=self.model_name,
            prompt_version=self.PROMPT_VERSION,
            input_hash=input_hash
        )
        
        # 7. Save to database
        logger.info(f"Saving FVS for {symbol}: {final_score:.1f}")
        self._save_inputs(asset_id, as_of_date, metrics)
        self._save_result(result)
        
        return result
    
    def run_batch(
        self,
        limit: Optional[int] = None,
        as_of_date: Optional[str] = None,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Run FVS scoring for a batch of equities.
        
        Args:
            limit: Maximum number of assets to process
            as_of_date: Date for scoring
            force_refresh: Force recalculation
        
        Returns:
            Summary of results
        """
        as_of_date = as_of_date or date.today().isoformat()
        
        # Get equities to process (ordered by market cap)
        query = """
        SELECT a.asset_id, a.symbol, a.name, em.sector, em.industry
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
        
        assets = self.db.fetch_all(query)
        
        results = {
            'total': len(assets),
            'success': 0,
            'failed': 0,
            'skipped': 0,
            'scores': []
        }
        
        for asset in assets:
            try:
                result = self.score_asset(
                    asset_id=asset['asset_id'],
                    symbol=asset['symbol'],
                    name=asset['name'],
                    sector=asset.get('sector'),
                    industry=asset.get('industry'),
                    as_of_date=as_of_date,
                    force_refresh=force_refresh
                )
                
                if result:
                    results['success'] += 1
                    results['scores'].append({
                        'symbol': result.symbol,
                        'final_score': result.final_score,
                        'confidence': result.confidence_level
                    })
                else:
                    results['failed'] += 1
                    
            except Exception as e:
                logger.error(f"Error scoring {asset['symbol']}: {e}")
                results['failed'] += 1
        
        logger.info(f"FVS batch complete: {results['success']}/{results['total']} successful")
        return results
