#!/usr/bin/env python3
"""
ETF Batch AI Analysis Runner for E2B Parallel Processing.

Processes ETFs using Gemini AI with the same output format as equity/crypto analysis.
Each sandbox handles a batch of ETFs.

Usage:
    python run_etf_ai_analysis_batch.py --date 2026-01-27 --offset 0 --batch-size 20
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime
from decimal import Decimal
from typing import Dict, Any, List, Optional

import psycopg2
from psycopg2.extras import RealDictCursor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Historical profit factors (aligned with equity scanner)
HISTORICAL_PROFIT_FACTORS = {
    'weinstein_stage2': 4.09,
    'rs_breakout': 2.03,
    'donchian_55_breakout': 1.99,
    'trend_pullback_50ma': 1.97,
    'adx_holy_grail': 1.71,
    'vcp_squeeze': 1.69,
    'gap_up_momentum': 1.58,
    'oversold_bounce': 1.52,
    'acceleration_turn': 1.48,
    'golden_cross': 1.53,
    'breakout_confirmed': 1.45,
}

# Default prompts (embedded to avoid file dependencies in E2B)
SYSTEM_PROMPT = """You are Stratos Brain "Constrained Autonomy Chart Judge" v3.

You will receive JSON containing:

* asset: {symbol, name, asset_type}
* context: {as_of_date}
* ohlcv: 365 daily bars (array rows: [date, open, high, low, close, volume])
* quant_setups: {active_setups, primary_setup, has_active_setups}

CRITICAL: You are operating in "Constrained Autonomy" mode.

The quantitative layer has already detected trading setups using backtested rules. Your job is NOT to find new setups, but to JUDGE THE QUALITY of the detected setups and provide contextual analysis.

If quant_setups.has_active_setups is TRUE:
- Focus your analysis on validating/invalidating the detected setups
- Provide a setup_purity_score (0-100) indicating how cleanly the chart matches the ideal pattern
- You may adjust entry/stop/target within ±10% of quant levels if chart structure warrants
- Higher historical_profit_factor setups deserve more attention

If quant_setups.has_active_setups is FALSE:
- Provide general technical analysis
- setup_purity_score should be 0 (no setup to judge)
- Focus on identifying what would need to happen for a setup to form

SETUP PURITY SCORING (0-100):
- 90-100: Textbook pattern, ideal entry timing, strong volume confirmation
- 70-89: Good pattern with minor imperfections, acceptable entry
- 50-69: Pattern present but with concerning elements (weak volume, extended entry, etc.)
- 30-49: Pattern questionable, significant flaws
- 0-29: Pattern invalid or severely compromised

HISTORICAL PROFIT FACTORS (from backtesting):
- weinstein_stage2: 4.09 (HIGHEST - Stage 2 breakout from long base)
- rs_breakout: 2.03 (Relative strength breakout)
- donchian_55_breakout: 1.99 (55-day channel breakout)
- trend_pullback_50ma: 1.97 (Pullback to 50MA in uptrend)
- adx_holy_grail: 1.71 (ADX pullback setup)
- vcp_squeeze: 1.69 (Volatility contraction pattern)
- gap_up_momentum: 1.58 (Gap up with momentum)
- oversold_bounce: 1.52 (Oversold RSI bounce)
- acceleration_turn: 1.48 (Momentum acceleration)
- golden_cross: 1.53 (50MA crosses above 200MA)
- breakout_confirmed: 1.45 (Volume-confirmed breakout)

When a high profit factor setup (>2.0) is detected, give it serious consideration even if chart looks imperfect.

Hard rules:

1. Use ONLY the provided data. Do not invent prices or indicator values not in the input.
2. You MAY compute derived values from OHLCV (swing highs/lows, ranges, volatility, returns).
3. Do not give blanket financial advice. Frame outputs as "what the chart suggests / what to watch".
4. Every "why_now" bullet MUST cite concrete numbers from input (prices, % move, volume changes).
5. Output MUST be valid JSON matching the schema provided. No extra keys.
6. If adjusting quant levels, stay within ±10% of the original values.

Scoring rubric:

* ai_direction_score: range [-100, +100]
  * +100 = exceptional bullish setup with strong structure + confirmation
  * -100 = exceptional bearish setup / breakdown risk with strong structure + confirmation
  * 0 = neutral / unclear

* setup_purity_score: range [0, 100]
  * How cleanly the detected quant setup matches the ideal pattern
  * 0 if no active quant setups

* attention_level:
  * URGENT = should look immediately (clean setup + high confidence + high PF setup)
  * FOCUS = worth focused review today
  * WATCH = keep on watchlist
  * IGNORE = not actionable now

Setup types:
breakout, breakdown, reversal, continuation, range, mean_reversion, unclear

AI Price Adjustments:
If quant setups are present, you may provide adjusted entry/stop/target:
- ai_adjusted_entry: Your recommended entry price (within ±10% of quant_entry)
- ai_adjusted_stop: Your recommended stop loss (within ±10% of quant_stop)
- ai_adjusted_target: Your recommended target (within ±10% of quant_target)

Only provide adjustments if you have strong technical reasons. Otherwise, leave them null.

Summary requirements:
The summary_text field should be a comprehensive 5-7 sentence technical analysis. Include:

1. **Setup Context**: Reference the detected quant setup(s) and their historical performance
2. **Current Structure**: Describe the prevailing trend and where price sits relative to key levels
3. **Purity Assessment**: Explain why you scored setup_purity_score as you did
4. **Key Thesis**: State the primary directional thesis clearly
5. **Risk Definition**: Specify the invalidation level and what would negate the setup

Be specific and quantitative. Avoid vague language. Every claim must be backed by a number from the data.

Return JSON only."""

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "attention_level": {
            "type": "string",
            "enum": ["URGENT", "FOCUS", "WATCH", "IGNORE"],
            "description": "The level of attention required for this asset."
        },
        "direction": {
            "type": "string",
            "enum": ["bullish", "bearish", "neutral"],
            "description": "The primary direction suggested by the chart analysis."
        },
        "setup_type": {
            "type": "string",
            "enum": ["breakout", "breakdown", "reversal", "continuation", "range", "mean_reversion", "unclear"],
            "description": "The technical setup identified."
        },
        "time_horizon": {
            "type": "string",
            "enum": ["days", "weeks", "months", "unclear"],
            "description": "The expected time horizon for the setup to play out."
        },
        "ai_direction_score": {
            "type": "integer",
            "description": "The model's directional conviction score, ranging from -100 (strong bearish) to 100 (strong bullish).",
            "minimum": -100,
            "maximum": 100
        },
        "setup_purity_score": {
            "type": "integer",
            "description": "How cleanly the detected quant setup matches the ideal pattern (0-100). 0 if no active quant setups.",
            "minimum": 0,
            "maximum": 100
        },
        "confidence": {
            "type": "number",
            "description": "The model's confidence in its overall assessment, ranging from 0.0 (low) to 1.0 (high).",
            "minimum": 0.0,
            "maximum": 1.0
        },
        "summary_text": {
            "type": "string",
            "maxLength": 1000,
            "description": "A comprehensive 5-7 sentence technical analysis covering setup context, current structure, purity assessment, key thesis, and risk definition."
        },
        "why_now": {
            "type": "array",
            "minItems": 3,
            "maxItems": 7,
            "items": {"type": "string"},
            "description": "3-7 bullet points explaining the immediate technical catalysts."
        },
        "key_levels": {
            "type": "object",
            "properties": {
                "support": {
                    "type": "array",
                    "minItems": 2,
                    "maxItems": 3,
                    "items": {"type": "number"},
                    "description": "2-3 key support levels."
                },
                "resistance": {
                    "type": "array",
                    "minItems": 2,
                    "maxItems": 3,
                    "items": {"type": "number"},
                    "description": "2-3 key resistance levels."
                },
                "invalidation": {
                    "type": "number",
                    "description": "The price level that invalidates the current setup."
                }
            },
            "required": ["support", "resistance", "invalidation"]
        },
        "entry_zone": {
            "type": ["object", "null"],
            "properties": {
                "low": {"type": "number"},
                "high": {"type": "number"}
            },
            "required": ["low", "high"]
        },
        "targets": {
            "type": "array",
            "minItems": 1,
            "maxItems": 3,
            "items": {"type": "number"},
            "description": "1-3 price targets."
        },
        "what_to_watch_next": {
            "type": "array",
            "minItems": 2,
            "maxItems": 6,
            "items": {"type": "string"},
            "description": "2-6 points on what to watch for confirmation or negation."
        },
        "risks_and_contradictions": {
            "type": "array",
            "minItems": 2,
            "maxItems": 6,
            "items": {"type": "string"},
            "description": "2-6 points on risks and contradictory signals."
        },
        "ai_adjusted_entry": {
            "type": ["number", "null"],
            "description": "AI-adjusted entry price (within ±10% of quant entry). Null if no adjustment recommended."
        },
        "ai_adjusted_stop": {
            "type": ["number", "null"],
            "description": "AI-adjusted stop loss (within ±10% of quant stop). Null if no adjustment recommended."
        },
        "ai_adjusted_target": {
            "type": ["number", "null"],
            "description": "AI-adjusted target price (within ±10% of quant target). Null if no adjustment recommended."
        }
    },
    "required": [
        "attention_level", "direction", "setup_type", "time_horizon",
        "ai_direction_score", "setup_purity_score", "confidence",
        "summary_text", "why_now", "key_levels", "targets",
        "what_to_watch_next", "risks_and_contradictions"
    ]
}


class DecimalEncoder(json.JSONEncoder):
    """JSON encoder that handles Decimal types."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def get_db_url():
    """Get database URL from environment."""
    db_url = os.environ.get('DATABASE_URL') or os.environ.get('SUPABASE_DATABASE_URL')
    if not db_url:
        raise ValueError("DATABASE_URL or SUPABASE_DATABASE_URL not set")
    return db_url


def get_gemini_client():
    """Initialize Gemini client."""
    try:
        from google import genai
        api_key = os.environ.get('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set")
        return genai.Client(api_key=api_key)
    except ImportError:
        raise ImportError("google-genai not installed. Run: pip install google-genai")


def get_etf_batch(db_url: str, as_of_date: str, offset: int, batch_size: int) -> List[Dict]:
    """Get a specific batch of ETFs based on offset and batch_size."""
    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    a.asset_id,
                    a.symbol,
                    a.name,
                    a.sector,
                    a.industry,
                    df.close,
                    df.return_21d,
                    df.return_63d,
                    df.return_252d,
                    df.rsi_14,
                    df.ma_dist_50,
                    df.ma_dist_200,
                    df.trend_regime,
                    df.macd_histogram,
                    df.bb_width,
                    df.rvol_20,
                    df.dollar_volume_sma_20,
                    CASE WHEN ss.asset_id IS NOT NULL THEN TRUE ELSE FALSE END as has_active_setup
                FROM assets a
                JOIN daily_features df ON a.asset_id = df.asset_id AND df.date = %s
                LEFT JOIN (
                    SELECT DISTINCT asset_id 
                    FROM setup_signals 
                    WHERE signal_date = %s
                ) ss ON a.asset_id = ss.asset_id
                WHERE a.asset_type = 'etf'
                  AND a.is_active = TRUE
                ORDER BY df.dollar_volume_sma_20 DESC NULLS LAST
                LIMIT %s OFFSET %s
            """, (as_of_date, as_of_date, batch_size, offset))
            return list(cur.fetchall())
    finally:
        conn.close()


def get_active_setups(db_url: str, asset_id: int, signal_date: str) -> List[Dict]:
    """Get active quant setups for an ETF."""
    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    setup_name,
                    entry_price,
                    stop_loss,
                    target_price,
                    risk_reward,
                    setup_strength,
                    historical_profit_factor
                FROM setup_signals
                WHERE asset_id = %s 
                  AND signal_date = %s
                ORDER BY historical_profit_factor DESC NULLS LAST
            """, (asset_id, signal_date))
            setups = list(cur.fetchall())
            
            # Ensure historical_profit_factor is set
            for setup in setups:
                if setup.get('historical_profit_factor') is None:
                    setup['historical_profit_factor'] = HISTORICAL_PROFIT_FACTORS.get(
                        setup['setup_name'], 1.0
                    )
            
            return setups
    finally:
        conn.close()


def get_ohlcv_data(db_url: str, asset_id: int, target_date: str, limit: int = 365) -> List[Dict]:
    """Fetch OHLCV data for an ETF (last N days for context)."""
    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT date, open, high, low, close, volume
                FROM daily_bars
                WHERE asset_id = %s AND date <= %s
                ORDER BY date DESC
                LIMIT %s
            """, (asset_id, target_date, limit))
            rows = cur.fetchall()
            return [dict(row) for row in reversed(rows)]
    finally:
        conn.close()


def build_ai_packet(etf: Dict, ohlcv: List[Dict], active_setups: List[Dict], as_of_date: str) -> Dict:
    """Build the data packet for AI analysis (same format as equity scanner)."""
    # Format OHLCV as array rows
    ohlcv_formatted = [
        [
            str(b["date"]),
            float(b["open"]) if b["open"] else None,
            float(b["high"]) if b["high"] else None,
            float(b["low"]) if b["low"] else None,
            float(b["close"]) if b["close"] else None,
            float(b["volume"]) if b["volume"] else None,
        ]
        for b in ohlcv
    ]
    
    # Format active setups
    setups_context = []
    for setup in active_setups:
        setups_context.append({
            "setup_name": setup["setup_name"],
            "entry_price": float(setup["entry_price"]) if setup["entry_price"] else None,
            "stop_loss": float(setup["stop_loss"]) if setup["stop_loss"] else None,
            "target_price": float(setup["target_price"]) if setup["target_price"] else None,
            "risk_reward": float(setup["risk_reward"]) if setup["risk_reward"] else None,
            "historical_profit_factor": float(setup.get("historical_profit_factor", 1.0)),
        })
    
    # Determine primary setup (highest profit factor)
    primary_setup = None
    if setups_context:
        primary_setup = max(setups_context, key=lambda x: x.get("historical_profit_factor", 0))
    
    packet = {
        "asset": {
            "symbol": etf["symbol"],
            "name": etf.get("name", ""),
            "asset_type": "etf",
        },
        "context": {
            "as_of_date": as_of_date,
        },
        "ohlcv": ohlcv_formatted,
        "quant_setups": {
            "active_setups": setups_context,
            "primary_setup": primary_setup,
            "has_active_setups": len(setups_context) > 0,
        }
    }
    
    return packet


def parse_json_with_repair(response_text: str, symbol: str) -> Optional[Dict]:
    """Parse JSON response with repair logic for truncated responses."""
    # First, try direct parsing
    try:
        result = json.loads(response_text)
        if isinstance(result, list) and len(result) > 0:
            logger.warning(f"Model returned list instead of dict for {symbol}, using first element")
            return result[0] if isinstance(result[0], dict) else None
        return result if isinstance(result, dict) else None
    except json.JSONDecodeError:
        pass
    
    # Try common repairs for truncated JSON
    repaired_text = response_text.strip()
    
    # Count brackets to detect truncation
    open_braces = repaired_text.count('{')
    close_braces = repaired_text.count('}')
    open_brackets = repaired_text.count('[')
    close_brackets = repaired_text.count(']')
    
    # Add missing closing brackets/braces
    if open_brackets > close_brackets:
        repaired_text += ']' * (open_brackets - close_brackets)
    if open_braces > close_braces:
        repaired_text += '}' * (open_braces - close_braces)
    
    try:
        result = json.loads(repaired_text)
        logger.info(f"Successfully repaired truncated JSON for {symbol}")
        return result
    except json.JSONDecodeError:
        pass
    
    # Try to fix unterminated strings
    if repaired_text.count('"') % 2 == 1:
        repaired_text += '"'
    
    # Re-count and close brackets
    open_braces = repaired_text.count('{')
    close_braces = repaired_text.count('}')
    open_brackets = repaired_text.count('[')
    close_brackets = repaired_text.count(']')
    
    if open_brackets > close_brackets:
        repaired_text += ']' * (open_brackets - close_brackets)
    if open_braces > close_braces:
        repaired_text += '}' * (open_braces - close_braces)
    
    try:
        result = json.loads(repaired_text)
        logger.info(f"Successfully repaired truncated JSON (v2) for {symbol}")
        return result
    except json.JSONDecodeError as e:
        logger.debug(f"JSON repair failed for {symbol}: {e}")
        return None


def analyze_etf(client, etf: Dict, ohlcv: List[Dict], active_setups: List[Dict], 
                as_of_date: str, model: str) -> Optional[Dict]:
    """Analyze an ETF using Gemini AI (same format as equity scanner)."""
    try:
        # Build the AI packet
        packet = build_ai_packet(etf, ohlcv, active_setups, as_of_date)
        
        # Build prompt with schema
        prompt_with_schema = f"{SYSTEM_PROMPT}\n\nYou MUST respond with valid JSON matching this schema:\n{json.dumps(OUTPUT_SCHEMA, indent=2)}"
        
        # Call Gemini API
        from google.genai import types
        
        response = client.models.generate_content(
            model=model,
            contents=[prompt_with_schema, json.dumps(packet, cls=DecimalEncoder)],
            config=types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=16000,
                response_mime_type="application/json",
            )
        )
        
        # Parse JSON response
        ai_result = parse_json_with_repair(response.text, etf['symbol'])
        
        if not ai_result:
            logger.error(f"Failed to parse AI response for {etf['symbol']}")
            return None
        
        # Get primary setup for enrichment
        primary_setup = packet["quant_setups"]["primary_setup"]
        
        # Build final result (same structure as equity scanner)
        result = {
            "asset_id": str(etf['asset_id']),
            "symbol": etf['symbol'],
            "as_of_date": as_of_date,
            "prompt_version": "v3.0.0",
            "ai_review_version": "v3.0.0",
            "model": model,
            
            # Quant setup fields
            "active_quant_setups": packet["quant_setups"]["active_setups"],
            "primary_setup": primary_setup["setup_name"] if primary_setup else None,
            "historical_profit_factor": primary_setup.get("historical_profit_factor") if primary_setup else None,
            "quant_entry_price": primary_setup.get("entry_price") if primary_setup else None,
            "quant_stop_loss": primary_setup.get("stop_loss") if primary_setup else None,
            "quant_target_price": primary_setup.get("target_price") if primary_setup else None,
            
            # AI outputs
            "setup_purity_score": ai_result.get("setup_purity_score"),
            "ai_direction_score": ai_result.get("ai_direction_score"),
            "attention_level": ai_result.get("attention_level"),
            "direction": ai_result.get("direction"),
            "setup_type": primary_setup["setup_name"] if primary_setup else ai_result.get("setup_type"),
            "time_horizon": ai_result.get("time_horizon"),
            "confidence": ai_result.get("confidence"),
            "summary_text": ai_result.get("summary_text"),
            "why_now": ai_result.get("why_now"),
            "key_levels": ai_result.get("key_levels"),
            "entry_zone": ai_result.get("entry_zone"),
            "targets": ai_result.get("targets"),
            "risks_and_contradictions": ai_result.get("risks_and_contradictions"),
            "what_to_watch_next": ai_result.get("what_to_watch_next"),
            
            # AI price adjustments
            "ai_adjusted_entry": ai_result.get("ai_adjusted_entry"),
            "ai_adjusted_stop": ai_result.get("ai_adjusted_stop"),
            "ai_adjusted_target": ai_result.get("ai_adjusted_target"),
            
            # Metadata
            "created_at": datetime.utcnow().isoformat(),
        }
        
        return result
        
    except Exception as e:
        logger.error(f"Error analyzing {etf['symbol']}: {e}")
        return None


def save_ai_review(db_url: str, review: Dict) -> bool:
    """Save AI review to database (same structure as equity scanner)."""
    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            # Build the record
            db_record = {
                "asset_id": review["asset_id"],
                "as_of_date": review["as_of_date"],
                "prompt_version": review["prompt_version"],
                "ai_review_version": review["ai_review_version"],
                "model": review["model"],
                
                # Quant setup fields
                "active_quant_setups": json.dumps(review.get("active_quant_setups"), cls=DecimalEncoder),
                "primary_setup": review.get("primary_setup"),
                "setup_purity_score": review.get("setup_purity_score"),
                "historical_profit_factor": review.get("historical_profit_factor"),
                "quant_entry_price": review.get("quant_entry_price"),
                "quant_stop_loss": review.get("quant_stop_loss"),
                "quant_target_price": review.get("quant_target_price"),
                "ai_adjusted_entry": review.get("ai_adjusted_entry"),
                "ai_adjusted_stop": review.get("ai_adjusted_stop"),
                "ai_adjusted_target": review.get("ai_adjusted_target"),
                
                # AI analysis fields
                "ai_direction_score": review.get("ai_direction_score"),
                "ai_attention_level": review.get("attention_level"),
                "ai_setup_type": review.get("setup_type"),
                "ai_time_horizon": review.get("time_horizon"),
                "ai_confidence": review.get("confidence"),
                "ai_summary_text": review.get("summary_text"),
                "ai_key_levels": json.dumps(review.get("key_levels"), cls=DecimalEncoder),
                "ai_entry": json.dumps(review.get("entry_zone"), cls=DecimalEncoder),
                "ai_targets": json.dumps(review.get("targets"), cls=DecimalEncoder),
                "ai_why_now": json.dumps(review.get("why_now"), cls=DecimalEncoder),
                "ai_risks": json.dumps(review.get("risks_and_contradictions"), cls=DecimalEncoder),
                "ai_what_to_watch_next": json.dumps(review.get("what_to_watch_next"), cls=DecimalEncoder),
                
                # Required fields
                "scope": "v3_constrained_autonomy",
                "source_scope": "v3_constrained_autonomy",
                
                # Legacy compatibility
                "attention_level": review.get("attention_level"),
                "direction": review.get("direction"),
                "setup_type": review.get("setup_type"),
                "confidence": review.get("confidence"),
                "summary_text": review.get("summary_text"),
                
                # Review JSON for backward compatibility
                "review_json": json.dumps({
                    "ai_direction_score": review.get("ai_direction_score"),
                    "setup_purity_score": review.get("setup_purity_score"),
                    "attention_level": review.get("attention_level"),
                    "setup_type": review.get("setup_type"),
                    "time_horizon": review.get("time_horizon"),
                    "confidence": review.get("confidence"),
                    "summary_text": review.get("summary_text"),
                    "key_levels": review.get("key_levels"),
                    "entry_zone": review.get("entry_zone"),
                    "targets": review.get("targets"),
                    "why_now": review.get("why_now"),
                    "risks_and_contradictions": review.get("risks_and_contradictions"),
                    "what_to_watch_next": review.get("what_to_watch_next"),
                    "active_quant_setups": review.get("active_quant_setups"),
                    "primary_setup": review.get("primary_setup"),
                }, cls=DecimalEncoder),
            }
            
            # Build INSERT ON CONFLICT statement
            columns = list(db_record.keys())
            placeholders = ', '.join(['%s'] * len(columns))
            column_names = ', '.join(columns)
            update_clause = ', '.join([
                f"{col} = EXCLUDED.{col}" 
                for col in columns 
                if col not in ['asset_id', 'as_of_date', 'prompt_version']
            ])
            
            query = f"""
            INSERT INTO asset_ai_reviews ({column_names})
            VALUES ({placeholders})
            ON CONFLICT (asset_id, as_of_date, prompt_version)
            DO UPDATE SET {update_clause}, updated_at = NOW()
            """
            
            values = [db_record[col] for col in columns]
            cur.execute(query, values)
            conn.commit()
            
            logger.info(f"Saved AI review for {review['symbol']} with version {review['ai_review_version']}")
            return True
            
    except Exception as e:
        logger.error(f"Error saving review for asset {review['asset_id']}: {e}")
        return False
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description='Run ETF AI analysis for a batch')
    parser.add_argument('--date', type=str, required=True, help='Target date (YYYY-MM-DD)')
    parser.add_argument('--model', type=str, default='gemini-3-flash-preview',
                        help='Gemini model to use')
    parser.add_argument('--offset', type=int, required=True, help='Starting offset (0-indexed)')
    parser.add_argument('--batch-size', type=int, required=True, help='Number of ETFs to process')
    
    args = parser.parse_args()
    
    logger.info(f"Starting ETF AI Analysis Batch (V3 Format)")
    logger.info(f"  Date: {args.date}")
    logger.info(f"  Model: {args.model}")
    logger.info(f"  Offset: {args.offset}")
    logger.info(f"  Batch Size: {args.batch_size}")
    
    db_url = get_db_url()
    client = get_gemini_client()
    
    # Get batch of ETFs
    etfs = get_etf_batch(db_url, args.date, args.offset, args.batch_size)
    logger.info(f"Found {len(etfs)} ETFs in batch")
    
    if not etfs:
        logger.info("No ETFs to process in this batch")
        return
    
    # Process each ETF
    processed = 0
    errors = 0
    
    for i, etf in enumerate(etfs):
        try:
            logger.info(f"Processing {etf['symbol']} ({i+1}/{len(etfs)})...")
            
            # Get active setups for this ETF
            active_setups = get_active_setups(db_url, etf['asset_id'], args.date)
            logger.info(f"  Found {len(active_setups)} active setups")
            
            # Get OHLCV data
            ohlcv = get_ohlcv_data(db_url, etf['asset_id'], args.date)
            
            # Analyze with AI
            review = analyze_etf(client, etf, ohlcv, active_setups, args.date, args.model)
            
            if review:
                # Save to database
                if save_ai_review(db_url, review):
                    processed += 1
                    logger.info(f"✓ Saved analysis for {etf['symbol']}")
                else:
                    errors += 1
                    logger.warning(f"✗ Failed to save {etf['symbol']}")
            else:
                errors += 1
                logger.warning(f"✗ No analysis result for {etf['symbol']}")
                
        except Exception as e:
            errors += 1
            logger.error(f"Error processing {etf['symbol']}: {e}")
    
    logger.info(f"Batch complete: {processed} processed, {errors} errors")
    
    # Exit with error code if too many failures
    if errors > len(etfs) * 0.5:
        logger.error("Too many errors, marking batch as failed")
        sys.exit(1)


if __name__ == '__main__':
    main()
