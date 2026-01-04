import pandas as pd
import numpy as np
import hashlib
import json
from typing import List, Dict, Any, Optional

class ChartAnalyzer:
    """
    Utility class for calculating chart fingerprints and similarity based on OHLCV data.
    """
    
    def __init__(self, window_size: int = 60):
        self.window_size = window_size

    def _prepare_data(self, ohlcv_data: List[Any]) -> Optional[pd.DataFrame]:
        """Converts OHLCV list to DataFrame and calculates log returns and volume changes.
        
        Handles both formats:
        - List of dicts: [{"date": ..., "open": ..., ...}]
        - List of lists: [[date, open, high, low, close, volume], ...]
        """
        if not ohlcv_data or len(ohlcv_data) < self.window_size:
            return None

        # Check if data is list of lists or list of dicts
        if isinstance(ohlcv_data[0], list):
            # Convert list of lists to list of dicts
            df = pd.DataFrame(ohlcv_data, columns=['date', 'open', 'high', 'low', 'close', 'volume'])
        else:
            df = pd.DataFrame(ohlcv_data)
        
        # Ensure numeric columns are properly typed
        for col in ['open', 'high', 'low', 'close', 'volume']:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        
        df = df.sort_values(by='date').tail(self.window_size)
        
        # 1. Calculate log returns
        df['log_return'] = np.log(df['close'].astype(float) / df['close'].shift(1).astype(float))
        
        # 2. Calculate log volume changes
        df['log_volume_change'] = np.log(df['volume'].astype(float) / df['volume'].shift(1).astype(float))
        
        # Drop the first row which will have NaNs from shift(1)
        df = df.iloc[1:].copy()
        
        return df

    def _normalize_data(self, df: pd.DataFrame) -> Optional[np.ndarray]:
        """Normalizes log returns and volume changes using Z-score."""
        if df.empty:
            return None

        # Select the columns to normalize
        data_to_normalize = df[['log_return', 'log_volume_change']]
        
        # Calculate Z-scores (mean=0, std=1) over the window
        mean = data_to_normalize.mean()
        std = data_to_normalize.std()
        
        # Handle case where std is 0 to avoid division by zero
        std[std == 0] = 1.0
        
        normalized_data = (data_to_normalize - mean) / std
        
        # Flatten and convert to numpy array
        return normalized_data.values.flatten()

    def calculate_fingerprint(self, ohlcv_data: List[Dict[str, Any]]) -> Optional[str]:
        """Calculates a SHA256 hash fingerprint of the normalized chart data."""
        df = self._prepare_data(ohlcv_data)
        if df is None:
            return None
        
        normalized_vector = self._normalize_data(df)
        if normalized_vector is None:
            return None

        # Round the values to a few decimal places to ensure consistent hashing
        # 4 decimal places should be sufficient for stability
        rounded_vector = np.round(normalized_vector, 4)
        
        # Convert to a JSON string and hash
        vector_list = rounded_vector.tolist()
        vector_json = json.dumps(vector_list, sort_keys=True)
        
        return hashlib.sha256(vector_json.encode('utf-8')).hexdigest()

    def calculate_similarity(self, ohlcv_data_today: List[Dict[str, Any]], ohlcv_data_prev: List[Dict[str, Any]]) -> Optional[float]:
        """
        Calculates the cosine similarity between today's and yesterday's normalized chart vectors.
        The similarity is calculated between the last N bars of data.
        """
        df_today = self._prepare_data(ohlcv_data_today)
        df_prev = self._prepare_data(ohlcv_data_prev)

        if df_today is None or df_prev is None:
            return None

        vec_today = self._normalize_data(df_today)
        vec_prev = self._normalize_data(df_prev)

        if vec_today is None or vec_prev is None or len(vec_today) != len(vec_prev):
            return None

        # Cosine similarity: dot product / (norm_today * norm_prev)
        dot_product = np.dot(vec_today, vec_prev)
        norm_today = np.linalg.norm(vec_today)
        norm_prev = np.linalg.norm(vec_prev)

        if norm_today == 0 or norm_prev == 0:
            # If one or both vectors are zero (e.g., all data points were the same),
            # similarity is undefined or 1.0 if they are identical zero vectors.
            return 1.0 if np.allclose(vec_today, vec_prev) else 0.0

        similarity = dot_product / (norm_today * norm_prev)
        
        # Clamp to [-1, 1] due to potential floating point errors
        return np.clip(similarity, -1.0, 1.0).item()

# Set the AI review version
AI_REVIEW_VERSION = "v2.0"
