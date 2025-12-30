"""Direction rules for signal templates.

Direction is computed from features at evaluation time, not hardcoded in templates.
This allows the same template to fire as bullish or bearish depending on market conditions.
"""

from typing import Any, Callable, Dict


def _safe_get(row: Dict[str, Any], key: str, default: Any = None) -> Any:
    """Safely get a value from row, handling None and NaN."""
    val = row.get(key, default)
    if val is None:
        return default
    try:
        if val != val:  # NaN check
            return default
    except (TypeError, ValueError):
        pass
    return val


def _to_float(val: Any, default: float = 0.0) -> float:
    """Convert value to float safely."""
    if val is None:
        return default
    try:
        if val != val:  # NaN
            return default
        return float(val)
    except (TypeError, ValueError):
        return default


def _to_bool(val: Any, default: bool = False) -> bool:
    """Convert value to bool safely."""
    if val is None:
        return default
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.lower() in ("true", "1", "yes")
    return bool(val)


# Direction rule functions
def momentum_inflection_direction(row: Dict[str, Any]) -> str:
    """
    Direction based on acceleration turn, not ROC sign.
    A stock with negative ROC but positive acceleration (Druckenmiller setup) is BULLISH.
    """
    accel_turn_up = _to_bool(_safe_get(row, "accel_turn_up"))
    accel_turn_down = _to_bool(_safe_get(row, "accel_turn_down"))
    droc_20 = _to_float(_safe_get(row, "droc_20"))
    
    if accel_turn_up or droc_20 > 0:
        return "bullish"
    elif accel_turn_down or droc_20 < 0:
        return "bearish"
    return "neutral"


def breakout_participation_direction(row: Dict[str, Any]) -> str:
    """Direction based on breakout direction."""
    breakout_up = _to_bool(_safe_get(row, "breakout_up_20"))
    breakout_down = _to_bool(_safe_get(row, "breakout_down_20"))
    return_1d = _to_float(_safe_get(row, "return_1d"))
    
    if breakout_up:
        return "bullish"
    elif breakout_down:
        return "bearish"
    elif return_1d > 0:
        return "bullish"
    elif return_1d < 0:
        return "bearish"
    return "neutral"


def trend_ignition_direction(row: Dict[str, Any]) -> str:
    """Direction based on trend regime and MA slope."""
    trend_regime = _safe_get(row, "trend_regime", "")
    ma_slope_20 = _to_float(_safe_get(row, "ma_slope_20"))
    roc_20 = _to_float(_safe_get(row, "roc_20"))
    
    if trend_regime in ("uptrend", "strong_uptrend") or ma_slope_20 > 0 or roc_20 > 0:
        return "bullish"
    elif trend_regime in ("downtrend", "strong_downtrend") or ma_slope_20 < 0 or roc_20 < 0:
        return "bearish"
    return "neutral"


def squeeze_release_direction(row: Dict[str, Any]) -> str:
    """Direction based on momentum at squeeze release."""
    roc_5 = _to_float(_safe_get(row, "roc_5"))
    macd_histogram = _to_float(_safe_get(row, "macd_histogram"))
    return_1d = _to_float(_safe_get(row, "return_1d"))
    
    if roc_5 > 0 or macd_histogram > 0 or return_1d > 0:
        return "bullish"
    elif roc_5 < 0 or macd_histogram < 0 or return_1d < 0:
        return "bearish"
    return "neutral"


def rs_breakout_direction(row: Dict[str, Any]) -> str:
    """RS breakout is always bullish (outperforming benchmark)."""
    return "bullish"


def volatility_shock_direction(row: Dict[str, Any]) -> str:
    """Direction based on return direction."""
    return_1d = _to_float(_safe_get(row, "return_1d"))
    gap_up = _to_bool(_safe_get(row, "gap_up"))
    gap_down = _to_bool(_safe_get(row, "gap_down"))
    
    if gap_up or return_1d > 0:
        return "bullish"
    elif gap_down or return_1d < 0:
        return "bearish"
    return "neutral"


def exhaustion_direction(row: Dict[str, Any]) -> str:
    """
    Direction based on RSI level:
    - RSI >= 70 (overbought) = bearish exhaustion (top)
    - RSI <= 30 (oversold) = bullish exhaustion (washout reversal)
    """
    rsi_14 = _to_float(_safe_get(row, "rsi_14"), 50)
    
    if rsi_14 >= 70:
        return "bearish"
    elif rsi_14 <= 30:
        return "bullish"
    return "neutral"


def trend_breakdown_direction(row: Dict[str, Any]) -> str:
    """Trend breakdown is always bearish."""
    return "bearish"


def trend_leadership_direction(row: Dict[str, Any]) -> str:
    """Trend leadership is always bullish."""
    return "bullish"


# Direction rules registry
DIRECTION_RULES: Dict[str, Callable[[Dict[str, Any]], str]] = {
    "momentum_inflection": momentum_inflection_direction,
    "breakout_participation": breakout_participation_direction,
    "trend_ignition": trend_ignition_direction,
    "squeeze_release": squeeze_release_direction,
    "rs_breakout": rs_breakout_direction,
    "volatility_shock": volatility_shock_direction,
    "exhaustion": exhaustion_direction,
    "trend_breakdown": trend_breakdown_direction,
    "trend_leadership": trend_leadership_direction,
}


def get_direction(template_name: str, row: Dict[str, Any]) -> str:
    """Get direction for a template given feature row."""
    rule_fn = DIRECTION_RULES.get(template_name)
    if rule_fn:
        return rule_fn(row)
    return "neutral"
