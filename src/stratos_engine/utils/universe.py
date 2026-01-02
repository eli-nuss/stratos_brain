"""Utilities for parsing universe identifiers."""

from typing import Dict, Any, Tuple

def parse_universe(universe_id: str) -> Dict[str, Any]:
    """
    Parse a universe identifier into its components.
    
    Args:
        universe_id: e.g. 'equities_top100', 'crypto_top500'
        
    Returns:
        Dict with keys:
            - asset_type: 'equity' or 'crypto'
            - limit: integer limit (default 100)
            - min_volume: minimum dollar volume (default 1M for equity, 100k for crypto)
    """
    asset_type = 'crypto' if 'crypto' in universe_id else 'equity'
    
    limit = 100
    if 'top500' in universe_id:
        limit = 500
    elif 'top100' in universe_id:
        limit = 100
    elif 'all' in universe_id:
        limit = 10000 # Arbitrary high number
        
    # Default volume thresholds
    min_volume = 1000000 if asset_type == 'equity' else 100000
    
    return {
        "asset_type": asset_type,
        "limit": limit,
        "min_volume": min_volume
    }
