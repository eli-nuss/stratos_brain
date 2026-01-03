"""
Stratos Signal Engine - Feature Calculator v2
==============================================

Computes 102 technical features from daily_bars and writes to daily_features.
Aligned with SCORING_SYSTEM spec and Druckenmiller-style velocity/acceleration.

Version: 2.0.0
Changes from v1:
  - P0.1: Fixed Supabase pagination (handles >1000 rows)
  - P0.2: Velocity/acceleration now uses log returns per spec
  - P0.3: droc_* is now 1-day delta (not 5-day)
  - P0.4: Squeeze detection includes Keltner channel variant
  - P0.5: no_new_5d_lows logic corrected
  - P0.6: RS velocity/acceleration per spec (EMA of log ratio)
  - P1.*: Added missing features to complete 102-feature promise
  - P2.*: Production hardening (coverage fields, tiered lookback)

Usage:
    # Backfill from 2020 for all assets
    python feature_calculator_v2.py --backfill --start-date 2020-01-01
    
    # Daily incremental update
    python feature_calculator_v2.py --incremental
    
    # Single asset for testing
    python feature_calculator_v2.py --asset-id 123 --start-date 2024-01-01

Requirements:
    pip install pandas numpy supabase python-dotenv

Environment Variables:
    SUPABASE_URL - Your Supabase project URL
    SUPABASE_KEY - Your Supabase service role key (not anon key)
"""

import os
import argparse
import logging
from datetime import date, datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
import numpy as np
import pandas as pd
from supabase import create_client, Client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Feature version - increment when calculation logic changes
FEATURE_VERSION = "2.0"
CALC_VERSION = "2.0.0"

# Lookback requirements
MAX_LOOKBACK = 300      # Need 252 for yearly returns + buffer
MIN_LOOKBACK = 60       # Minimum for basic features (tiered approach)
EQUITY_CALENDAR_MULTIPLIER = 2.0  # Equities: 300 bars ≈ 600 calendar days
CRYPTO_CALENDAR_MULTIPLIER = 1.2  # Crypto trades 7 days/week


class FeatureCalculator:
    """Computes technical features for assets."""
    
    def __init__(self, supabase_url: str, supabase_key: str):
        """Initialize with Supabase credentials."""
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.benchmark_cache: Dict[int, pd.DataFrame] = {}
    
    # =========================================================================
    # P0.1 FIX: Paginated Supabase fetch (handles >1000 rows)
    # =========================================================================
    def _paged_select(self, table: str, select: str, filters: Dict[str, Any], 
                      order_by: str = 'date', page_size: int = 1000) -> List[Dict]:
        """
        Supabase PostgREST paginated fetch using range().
        Supabase projects default to max 1000 rows per request unless you page.
        """
        out: List[Dict] = []
        offset = 0
        
        while True:
            query = self.supabase.table(table).select(select)
            
            # Apply filters
            for key, value in filters.items():
                if key.endswith('__gte'):
                    query = query.gte(key[:-5], value)
                elif key.endswith('__lte'):
                    query = query.lte(key[:-5], value)
                elif key.endswith('__eq'):
                    query = query.eq(key[:-4], value)
                else:
                    query = query.eq(key, value)
            
            query = query.order(order_by).range(offset, offset + page_size - 1)
            resp = query.execute()
            page = resp.data or []
            out.extend(page)
            
            if len(page) < page_size:
                break
            
            offset += page_size
        
        return out
        
    def get_active_assets(self, asset_type: Optional[str] = None) -> pd.DataFrame:
        """Get all active assets, optionally filtered by type."""
        filters = {'is_active': True}
        if asset_type:
            filters['asset_type'] = asset_type
        
        data = self._paged_select('assets', '*', filters, order_by='asset_id')
        return pd.DataFrame(data)
    
    def get_asset_info(self, asset_id: int) -> Optional[Dict]:
        """Get asset info including type for calendar multiplier."""
        resp = self.supabase.table('assets').select('*').eq('asset_id', asset_id).execute()
        if resp.data:
            return resp.data[0]
        return None
    
    def get_bars(
        self, 
        asset_id: int, 
        start_date: date, 
        end_date: date,
        asset_type: str = 'equity',
        include_lookback: bool = True
    ) -> pd.DataFrame:
        """
        Fetch OHLCV bars for an asset with proper pagination.
        
        P0.1 FIX: Uses paginated fetch to handle >1000 rows.
        P2.2 FIX: Uses asset-type-aware calendar multiplier.
        """
        # Determine calendar multiplier based on asset type
        if asset_type == 'crypto':
            multiplier = CRYPTO_CALENDAR_MULTIPLIER
        else:
            multiplier = EQUITY_CALENDAR_MULTIPLIER
        
        # Extend start date for lookback period
        if include_lookback:
            lookback_days = int(MAX_LOOKBACK * multiplier) + 50
            fetch_start = start_date - timedelta(days=lookback_days)
        else:
            fetch_start = start_date
        
        filters = {
            'asset_id': asset_id,
            'date__gte': fetch_start.isoformat(),
            'date__lte': end_date.isoformat()
        }
        
        data = self._paged_select(
            'daily_bars',
            'date, open, high, low, close, volume',
            filters,
            order_by='date'
        )
        
        if not data:
            return pd.DataFrame()
            
        df = pd.DataFrame(data)
        df['date'] = pd.to_datetime(df['date']).dt.date
        df = df.sort_values('date').reset_index(drop=True)
        
        # Convert to float
        for col in ['open', 'high', 'low', 'close', 'volume']:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            
        return df
    
    def get_benchmark_bars(self, benchmark_asset_id: int, start_date: date, 
                           end_date: date, asset_type: str = 'equity') -> pd.DataFrame:
        """Get benchmark bars with caching."""
        cache_key = benchmark_asset_id
        if cache_key not in self.benchmark_cache:
            self.benchmark_cache[cache_key] = self.get_bars(
                benchmark_asset_id, start_date, end_date, 
                asset_type=asset_type, include_lookback=True
            )
        return self.benchmark_cache[cache_key]
    
    def compute_features(self, bars: pd.DataFrame, benchmark_bars: Optional[pd.DataFrame] = None,
                         asset_type: str = 'equity') -> pd.DataFrame:
        """
        Compute all 102 technical features for a single asset.
        
        Aligned with SCORING_SYSTEM spec and Druckenmiller-style velocity/acceleration.
        
        Args:
            bars: DataFrame with date, open, high, low, close, volume
            benchmark_bars: Optional benchmark data for relative strength
            asset_type: 'crypto' or 'equity' for annualization factor
            
        Returns:
            DataFrame with one row per date and all feature columns
        """
        # P2.1: Tiered minimum - compute what we can with available data
        bars_available = len(bars)
        if bars_available < MIN_LOOKBACK:
            logger.warning(f"Insufficient data: {bars_available} bars, need at least {MIN_LOOKBACK}")
            return pd.DataFrame()
        
        has_full_history = bars_available >= MAX_LOOKBACK
        
        df = bars.copy()
        df = df.set_index('date')
        
        # Ensure numeric types
        close = df['close'].astype(float)
        high = df['high'].astype(float)
        low = df['low'].astype(float)
        open_price = df['open'].astype(float)
        volume = df['volume'].astype(float).fillna(0)
        
        features = pd.DataFrame(index=df.index)
        features['close'] = close
        
        # P2.1: Coverage fields
        features['bars_available'] = bars_available
        features['coverage_252'] = bars_available / MAX_LOOKBACK  # Ratio of available bars to max lookback
        
        # Annualization factor (crypto trades 365 days, equities 252)
        ann_factor = 365 if asset_type == 'crypto' else 252
        
        # ============================================================
        # P0.2 FIX: LOG RETURNS (required for Druckenmiller-style features)
        # ============================================================
        log_return = np.log(close / close.shift(1))
        features['log_return'] = log_return
        
        return_std_20 = log_return.rolling(20).std()
        features['return_std_20'] = return_std_20
        
        # Volatility shock wants a standardized daily move
        features['return_z'] = log_return / return_std_20
        
        # ============================================================
        # PRICE RETURNS (simple returns for compatibility)
        # ============================================================
        features['return_1d'] = close.pct_change(1)
        features['return_5d'] = close.pct_change(5)
        features['return_21d'] = close.pct_change(21)
        features['return_63d'] = close.pct_change(63)
        
        if has_full_history:
            features['return_252d'] = close.pct_change(252)
        else:
            features['return_252d'] = np.nan
        
        # P1.7: Gap features
        prev_close = close.shift(1)
        features['gap_pct'] = (open_price - prev_close) / prev_close
        features['gap_up'] = features['gap_pct'] > 0
        features['gap_down'] = features['gap_pct'] < 0
        
        # Z-score of 1-day return
        return_1d_std = features['return_1d'].rolling(20).std()
        return_1d_mean = features['return_1d'].rolling(20).mean()
        features['return_1d_z'] = (features['return_1d'] - return_1d_mean) / return_1d_std
        
        # ============================================================
        # MOVING AVERAGES
        # ============================================================
        features['sma_20'] = close.rolling(20).mean()
        features['sma_50'] = close.rolling(50).mean()
        
        if has_full_history:
            features['sma_200'] = close.rolling(200).mean()
        else:
            features['sma_200'] = np.nan
        
        # Distance from MAs (percentage)
        features['ma_dist_20'] = (close - features['sma_20']) / features['sma_20']
        features['ma_dist_50'] = (close - features['sma_50']) / features['sma_50']
        features['ma_dist_200'] = (close - features['sma_200']) / features['sma_200']
        
        # MA slopes (rate of change of MA)
        features['ma_slope_20'] = features['sma_20'].pct_change(5)
        features['ma_slope_50'] = features['sma_50'].pct_change(10)
        features['ma_slope_200'] = features['sma_200'].pct_change(20)
        
        # P1.1: Trend state features
        features['above_ma200'] = close > features['sma_200']
        features['ma50_above_ma200'] = features['sma_50'] > features['sma_200']
        
        # Trend regime based on MA stack
        features['trend_regime'] = 'neutral'
        bullish = (close > features['sma_20']) & (features['sma_20'] > features['sma_50']) & (features['sma_50'] > features['sma_200'])
        bearish = (close < features['sma_20']) & (features['sma_20'] < features['sma_50']) & (features['sma_50'] < features['sma_200'])
        features.loc[bullish, 'trend_regime'] = 'bullish'
        features.loc[bearish, 'trend_regime'] = 'bearish'
        
        # ============================================================
        # MOMENTUM (ROC)
        # ============================================================
        features['roc_5'] = close.pct_change(5)
        features['roc_10'] = close.pct_change(10)
        features['roc_20'] = close.pct_change(20)
        features['roc_63'] = close.pct_change(63)
        
        # ROC z-score (standardized momentum)
        roc_20_std = features['roc_20'].rolling(63).std()
        roc_20_mean = features['roc_20'].rolling(63).mean()
        features['roc_z_20'] = (features['roc_20'] - roc_20_mean) / roc_20_std
        
        # P1.8: Additional ROC z variants
        roc_5_std = features['roc_5'].rolling(20).std()
        roc_5_mean = features['roc_5'].rolling(20).mean()
        features['roc_z_5'] = (features['roc_5'] - roc_5_mean) / roc_5_std
        
        # ROC 90th percentile over 63 days (for exhaustion detection)
        features['roc_20_p90_63d'] = features['roc_20'].rolling(63).quantile(0.9)
        
        # P0.3 FIX: Delta ROC is 1-day delta (not 5-day)
        features['droc_20'] = features['roc_20'] - features['roc_20'].shift(1)
        features['droc_63'] = features['roc_63'] - features['roc_63'].shift(1)
        
        # P1.8: Additional droc variants (keep 5-day version as separate feature)
        features['droc_5'] = features['roc_5'] - features['roc_5'].shift(1)
        features['droc_10'] = features['roc_10'] - features['roc_10'].shift(1)
        features['droc_20_5d'] = features['roc_20'] - features['roc_20'].shift(5)  # Original 5-day version
        
        # ============================================================
        # P0.2 FIX: VELOCITY & ACCELERATION (Druckenmiller-style)
        # Uses log returns per spec
        # ============================================================
        features['vel_ema_5'] = log_return.ewm(span=5, adjust=False).mean()
        features['vel_ema_10'] = log_return.ewm(span=10, adjust=False).mean()
        
        # Acceleration (change in velocity) - 1-day delta per spec
        features['accel_ema_5'] = features['vel_ema_5'].diff()
        features['accel_ema_10'] = features['vel_ema_10'].diff()
        
        # P0.2 FIX: Acceleration z-score normalized by return volatility (not its own history)
        features['accel_z_20'] = features['accel_ema_5'] / return_std_20
        features['accel_z_20_prev'] = features['accel_z_20'].shift(1)
        
        # P0.2 FIX: Acceleration turn signals with significance threshold
        # Spec gates on crossing from < -0.3 to > +0.3 (and vice versa)
        features['accel_turn_up'] = (
            (features['accel_z_20'] > 0.3) &
            (features['accel_z_20_prev'] < -0.3)
        )
        features['accel_turn_down'] = (
            (features['accel_z_20'] < -0.3) &
            (features['accel_z_20_prev'] > 0.3)
        )
        
        # Keep simple zero-cross as separate feature
        features['accel_zero_cross_up'] = (features['accel_z_20'] > 0) & (features['accel_z_20_prev'] <= 0)
        features['accel_zero_cross_down'] = (features['accel_z_20'] < 0) & (features['accel_z_20_prev'] >= 0)
        
        # ============================================================
        # RSI
        # ============================================================
        delta = close.diff()
        gain = delta.where(delta > 0, 0).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss
        features['rsi_14'] = 100 - (100 / (1 + rs))
        
        # ============================================================
        # P1.4: MACD (full components + histogram slope)
        # ============================================================
        ema_12 = close.ewm(span=12, adjust=False).mean()
        ema_26 = close.ewm(span=26, adjust=False).mean()
        macd_line = ema_12 - ema_26
        macd_signal = macd_line.ewm(span=9, adjust=False).mean()
        macd_hist = macd_line - macd_signal
        
        features['macd_line'] = macd_line
        features['macd_signal'] = macd_signal
        features['macd_histogram'] = macd_hist
        features['macd_hist_slope'] = macd_hist.diff()
        
        # ============================================================
        # VOLATILITY
        # ============================================================
        # True Range
        tr = pd.concat([
            high - low,
            (high - close.shift(1)).abs(),
            (low - close.shift(1)).abs()
        ], axis=1).max(axis=1)
        
        # P1.3: ATR features
        features['atr_14'] = tr.rolling(14).mean()
        features['atr_pct'] = features['atr_14'] / close
        
        if has_full_history:
            features['atr_pctile'] = features['atr_pct'].rolling(252).rank(pct=True) * 100
        else:
            features['atr_pctile'] = features['atr_pct'].rolling(63).rank(pct=True) * 100
        
        # P1.2: Realized volatility (multiple windows + vol-of-vol)
        features['realized_vol_10'] = log_return.rolling(10).std() * np.sqrt(ann_factor)
        features['realized_vol_20'] = log_return.rolling(20).std() * np.sqrt(ann_factor)
        features['realized_vol_60'] = log_return.rolling(60).std() * np.sqrt(ann_factor)
        features['vol_of_vol'] = features['realized_vol_20'].rolling(20).std()
        
        # ============================================================
        # P0.4 FIX: BOLLINGER BANDS + KELTNER SQUEEZE
        # ============================================================
        bb_std = close.rolling(20).std()
        features['bb_middle'] = features['sma_20']
        features['bb_upper'] = features['bb_middle'] + 2 * bb_std
        features['bb_lower'] = features['bb_middle'] - 2 * bb_std
        features['bb_width'] = (features['bb_upper'] - features['bb_lower']) / features['bb_middle']
        features['bb_pct'] = (close - features['bb_lower']) / (features['bb_upper'] - features['bb_lower'])
        
        # BB width percentile (0-100 scale)
        if has_full_history:
            features['bb_width_pctile'] = features['bb_width'].rolling(252).rank(pct=True) * 100
        else:
            features['bb_width_pctile'] = features['bb_width'].rolling(126).rank(pct=True) * 100
        
        features['bb_width_pctile_prev'] = features['bb_width_pctile'].shift(1)
        features['bb_width_pctile_expanding'] = features['bb_width_pctile'] > features['bb_width_pctile_prev']
        
        # Keltner Channel (ATR(10) typical for squeeze logic)
        atr_10 = tr.rolling(10).mean()
        kc_middle = close.ewm(span=20, adjust=False).mean()
        kc_upper = kc_middle + 1.5 * atr_10
        kc_lower = kc_middle - 1.5 * atr_10
        
        features['kc_upper'] = kc_upper
        features['kc_lower'] = kc_lower
        
        # P0.4 FIX: Squeeze detection with Keltner variant
        features['squeeze_keltner'] = (features['bb_upper'] < kc_upper) & (features['bb_lower'] > kc_lower)
        # squeeze_pctile is the actual percentile value (numeric), not a boolean
        features['squeeze_pctile'] = features['bb_width_pctile']
        squeeze_by_pctile = features['bb_width_pctile'] < 10  # Boolean for squeeze detection
        features['squeeze_flag'] = features['squeeze_keltner'] | squeeze_by_pctile
        
        # Squeeze release: was in squeeze, now not
        features['squeeze_release'] = features['squeeze_flag'].shift(1) & (~features['squeeze_flag'])
        
        # ============================================================
        # VOLUME
        # ============================================================
        features['volume_sma_20'] = volume.rolling(20).mean()
        features['dollar_volume'] = close * volume
        features['dollar_volume_sma_20'] = features['dollar_volume'].rolling(20).mean()
        
        # Relative volume
        features['rvol_20'] = volume / features['volume_sma_20']
        
        # RVOL declining check
        features['rvol_declining_3d'] = (
            (features['rvol_20'] < features['rvol_20'].shift(1)) &
            (features['rvol_20'].shift(1) < features['rvol_20'].shift(2)) &
            (features['rvol_20'].shift(2) < features['rvol_20'].shift(3))
        )
        
        # Volume z-score
        vol_std_60 = volume.rolling(60).std()
        vol_mean_60 = volume.rolling(60).mean()
        features['volume_z_60'] = (volume - vol_mean_60) / vol_std_60
        
        # OBV slope
        obv = (np.sign(close.diff()) * volume).cumsum()
        features['obv_slope_20'] = obv.diff(20) / obv.shift(20).abs().replace(0, np.nan)
        
        # P1.5: Illiquidity (Amihud-style)
        dv = features['dollar_volume'].replace(0, np.nan)
        features['illiquidity'] = log_return.abs() / dv
        
        # ============================================================
        # DONCHIAN CHANNELS & BREAKOUTS
        # ============================================================
        features['donchian_high_20'] = high.rolling(20).max()
        features['donchian_low_20'] = low.rolling(20).min()
        features['donchian_high_55'] = high.rolling(55).max()
        features['donchian_low_55'] = low.rolling(55).min()
        features['donchian_high_20_prev'] = features['donchian_high_20'].shift(1)
        
        # Breakout flags
        features['breakout_up_20'] = close > features['donchian_high_20'].shift(1)
        features['breakout_down_20'] = close < features['donchian_low_20'].shift(1)
        
        # P1.6: Confirmed breakouts (with volume or squeeze confirmation)
        features['breakout_confirmed_up'] = features['breakout_up_20'] & (
            (features['rvol_20'] > 1.5) | features['squeeze_release']
        )
        features['breakout_confirmed_down'] = features['breakout_down_20'] & (
            (features['rvol_20'] > 1.5) | features['squeeze_release']
        )
        
        # P0.5 FIX: no_new_5d_lows (corrected logic with >=)
        features['low_5d_min'] = low.rolling(5).min()
        features['no_new_5d_lows'] = features['low_5d_min'] >= features['low_5d_min'].shift(5)
        
        # ============================================================
        # 52-WEEK HIGH/LOW & DRAWDOWNS
        # ============================================================
        if has_full_history:
            high_252 = high.rolling(252).max()
            low_252 = low.rolling(252).min()
            features['dist_52w_high'] = (close - high_252) / high_252
            features['dist_52w_low'] = (close - low_252) / low_252
        else:
            features['dist_52w_high'] = np.nan
            features['dist_52w_low'] = np.nan
        
        # P1.1: Drawdown features
        for n in [20, 63, 252]:
            if n <= bars_available:
                roll_max = close.rolling(n).max()
                features[f'drawdown_{n}d'] = (close / roll_max) - 1.0
            else:
                features[f'drawdown_{n}d'] = np.nan
        
        # ============================================================
        # P0.6 FIX: RELATIVE STRENGTH (per spec)
        # rs_velocity = EMA(log(rs_ratio), 5)
        # rs_acceleration = rs_velocity - rs_velocity[1]
        # ============================================================
        if benchmark_bars is not None and len(benchmark_bars) > 0:
            bench = benchmark_bars.set_index('date')['close'].astype(float)
            # Align benchmark to asset dates
            bench = bench.reindex(features.index, method='ffill')
            
            # RS ratio
            features['rs_vs_benchmark'] = close / bench
            
            # RS momentum (simple)
            features['rs_roc_20'] = features['rs_vs_benchmark'].pct_change(20)
            
            # P0.6 FIX: RS velocity and acceleration per spec
            features['rs_velocity'] = np.log(features['rs_vs_benchmark']).ewm(span=5, adjust=False).mean()
            features['rs_acceleration'] = features['rs_velocity'].diff()
            
            # RS breakout signal
            features['rs_breakout'] = (
                (features['rs_roc_20'] > 0.05) &
                (features['rs_acceleration'] > 0) &
                (features['roc_20'] > 0)
            )
        else:
            features['rs_vs_benchmark'] = np.nan
            features['rs_roc_20'] = np.nan
            features['rs_velocity'] = np.nan
            features['rs_acceleration'] = np.nan
            features['rs_breakout'] = False
        
        # ============================================================
        # CROSS-SECTIONAL RANKS (placeholder - computed separately in batch)
        # ============================================================
        features['cs_rank_return_21d'] = np.nan
        features['cs_rank_roc_20'] = np.nan
        features['cs_rank_droc_20'] = np.nan
        features['cs_rank_rvol_20'] = np.nan
        features['cs_rank_bb_width_pctile'] = np.nan
        features['cs_rank_attention_score'] = np.nan
        features['cs_unusualness'] = np.nan
        
        # ============================================================
        # ATTENTION SCORE (default 0 - computed by signal evaluator)
        # ============================================================
        # Default to 0 (no signal) - Signal Evaluator will overwrite with
        # actual computed scores after template evaluation
        features['attention_score'] = 0.0
        features['attention_score_components'] = {}
        
        # Reset index for output
        features = features.reset_index()
        features = features.rename(columns={'index': 'date'})
        
        return features
    
    def write_features(self, asset_id: int, features: pd.DataFrame, data_vendor: str = 'computed') -> int:
        """Write computed features to daily_features table."""
        if features.empty:
            return 0
        
        # Get list of valid columns from the features DataFrame
        # Exclude columns that aren't in the database schema
        exclude_cols = {'date', 'attention_score_components'}  # JSONB handled separately
        
        # Prepare records for upsert
        records = []
        for _, row in features.iterrows():
            record = {
                'asset_id': asset_id,
                'date': row['date'].isoformat() if hasattr(row['date'], 'isoformat') else str(row['date']),
                'feature_version': FEATURE_VERSION,
                'calc_version': CALC_VERSION,
                'data_vendor': data_vendor,
            }
            
            # Add all feature columns
            for col in features.columns:
                if col in exclude_cols:
                    continue
                val = row[col]
                if pd.isna(val):
                    record[col] = None
                elif isinstance(val, (np.bool_, bool)):
                    # Handle numpy bool BEFORE numeric types (np.bool_ can be subclass of np.integer)
                    record[col] = bool(val)
                elif isinstance(val, (np.integer, np.int64)):
                    record[col] = int(val)
                elif isinstance(val, (np.floating, np.float64)):
                    record[col] = float(val)
                else:
                    record[col] = str(val) if not isinstance(val, str) else val
                    
            records.append(record)
        
        # Upsert in batches
        batch_size = 500
        total_written = 0
        
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            try:
                self.supabase.table('daily_features').upsert(
                    batch,
                    on_conflict='asset_id,date'
                ).execute()
                total_written += len(batch)
            except Exception as e:
                logger.error(f"Error writing batch {i//batch_size}: {e}")
                # Log first record for debugging
                if batch:
                    logger.error(f"First record keys: {list(batch[0].keys())}")
                raise
                
        return total_written
    
    def process_asset(
        self,
        asset_id: int,
        benchmark_asset_id: Optional[int],
        start_date: date,
        end_date: date,
        asset_type: str = 'equity',
        data_vendor: str = 'computed'
    ) -> int:
        """Process a single asset: fetch bars, compute features, write to DB."""
        # Get bars
        bars = self.get_bars(asset_id, start_date, end_date, asset_type=asset_type)
        if bars.empty:
            logger.warning(f"No bars for asset {asset_id}")
            return 0
            
        # Get benchmark bars if specified
        benchmark_bars = None
        if benchmark_asset_id:
            benchmark_bars = self.get_benchmark_bars(
                benchmark_asset_id, start_date, end_date, asset_type=asset_type
            )
        
        # Compute features
        features = self.compute_features(bars, benchmark_bars, asset_type=asset_type)
        if features.empty:
            return 0
            
        # Filter to requested date range (remove lookback period)
        features = features[features['date'] >= start_date]
        features = features[features['date'] <= end_date]
        
        # Write to database
        written = self.write_features(asset_id, features, data_vendor)
        return written
    
    def backfill(
        self,
        start_date: date,
        end_date: Optional[date] = None,
        asset_type: Optional[str] = None,
        asset_ids: Optional[List[int]] = None,
        batch_size: int = 100
    ) -> Dict[str, Any]:
        """
        Backfill features for multiple assets.
        
        Args:
            start_date: Start date for feature computation
            end_date: End date (defaults to today)
            asset_type: Filter by asset type ('crypto', 'equity')
            asset_ids: Specific asset IDs to process (overrides asset_type)
            batch_size: Number of assets to process before logging progress
            
        Returns:
            Summary statistics
        """
        if end_date is None:
            end_date = date.today()
            
        # Get assets to process
        if asset_ids:
            filters = {'asset_id__in': asset_ids}
            # Can't use __in with _paged_select, use direct query
            assets_resp = self.supabase.table('assets')\
                .select('asset_id, asset_type, symbol, benchmark_asset_id')\
                .in_('asset_id', asset_ids)\
                .execute()
            assets = pd.DataFrame(assets_resp.data)
        else:
            assets = self.get_active_assets(asset_type)
            
        total_assets = len(assets)
        logger.info(f"Starting backfill for {total_assets} assets from {start_date} to {end_date}")
        
        # Process assets
        processed = 0
        total_rows = 0
        errors = []
        skipped = 0
        
        for idx, asset in assets.iterrows():
            asset_id = asset['asset_id']
            asset_type_val = asset.get('asset_type', 'equity')
            benchmark_id = asset.get('benchmark_asset_id')
            # Ensure benchmark_id is an integer (not float or NaN)
            if benchmark_id is not None and not (isinstance(benchmark_id, float) and np.isnan(benchmark_id)):
                benchmark_id = int(benchmark_id)
            else:
                benchmark_id = None
            symbol = asset.get('symbol', 'unknown')
            
            try:
                rows = self.process_asset(
                    asset_id=asset_id,
                    benchmark_asset_id=benchmark_id,
                    start_date=start_date,
                    end_date=end_date,
                    asset_type=asset_type_val
                )
                
                if rows > 0:
                    total_rows += rows
                    processed += 1
                else:
                    skipped += 1
                
                if (processed + skipped) % batch_size == 0:
                    logger.info(f"Progress: {processed + skipped}/{total_assets} assets, "
                               f"{processed} processed, {skipped} skipped, {total_rows} rows written")
                    
            except Exception as e:
                logger.error(f"Error processing asset {asset_id} ({symbol}): {e}")
                errors.append({'asset_id': asset_id, 'symbol': symbol, 'error': str(e)})
                
        logger.info(f"Backfill complete: {processed}/{total_assets} processed, "
                   f"{skipped} skipped, {total_rows} rows, {len(errors)} errors")
        
        return {
            'total_assets': total_assets,
            'processed': processed,
            'skipped': skipped,
            'total_rows': total_rows,
            'errors': errors
        }


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(description='Stratos Feature Calculator v2')
    parser.add_argument('--backfill', action='store_true', help='Run backfill mode')
    parser.add_argument('--incremental', action='store_true', help='Run incremental update')
    parser.add_argument('--start-date', type=str, help='Start date (YYYY-MM-DD)')
    parser.add_argument('--end-date', type=str, help='End date (YYYY-MM-DD)')
    parser.add_argument('--asset-type', type=str, choices=['crypto', 'equity', 'commodity', 'fx', 'rate', 'etf', 'index'],
                       help='Filter by asset type')
    parser.add_argument('--asset-id', type=int, help='Process single asset')
    parser.add_argument('--batch-size', type=int, default=100, help='Batch size for progress logging')
    
    args = parser.parse_args()
    
    # Get credentials from environment
    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_KEY')
    
    if not supabase_url or not supabase_key:
        logger.error("Missing SUPABASE_URL or SUPABASE_KEY environment variables")
        return 1
    
    calculator = FeatureCalculator(supabase_url, supabase_key)
    
    # Determine dates
    if args.start_date:
        start_date = date.fromisoformat(args.start_date)
    else:
        start_date = date(2020, 1, 1)  # Default backfill start
        
    end_date = date.fromisoformat(args.end_date) if args.end_date else date.today()
    
    # Run appropriate mode
    if args.asset_id:
        # Single asset mode
        logger.info(f"Processing single asset {args.asset_id}")
        
        # Get asset info
        asset_info = calculator.get_asset_info(args.asset_id)
        if not asset_info:
            logger.error(f"Asset {args.asset_id} not found")
            return 1
        
        rows = calculator.process_asset(
            asset_id=args.asset_id,
            benchmark_asset_id=asset_info.get('benchmark_asset_id'),
            start_date=start_date,
            end_date=end_date,
            asset_type=asset_info.get('asset_type', 'equity')
        )
        logger.info(f"Wrote {rows} feature rows")
        
    elif args.incremental:
        # Incremental mode - just yesterday
        start_date = date.today() - timedelta(days=1)
        end_date = date.today()
        result = calculator.backfill(
            start_date=start_date,
            end_date=end_date,
            asset_type=args.asset_type,
            batch_size=args.batch_size
        )
        logger.info(f"Incremental update complete: {result}")
        
    elif args.backfill:
        # Full backfill mode
        result = calculator.backfill(
            start_date=start_date,
            end_date=end_date,
            asset_type=args.asset_type,
            batch_size=args.batch_size
        )
        logger.info(f"Backfill complete: {result}")
        
    else:
        parser.print_help()
        return 1
        
    return 0


if __name__ == '__main__':
    exit(main())
