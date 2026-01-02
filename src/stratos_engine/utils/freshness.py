"""Utilities for checking data freshness and coverage."""

from typing import Dict, Tuple
import structlog
from .universe import parse_universe

logger = structlog.get_logger()

class FreshnessCheck:
    def __init__(self, db):
        self.db = db

    def check_coverage(self, as_of_date: str, universe_id: str, threshold: float = 0.95) -> Tuple[bool, Dict[str, int]]:
        """
        Check if we have enough feature data for the given date and universe.
        
        Returns:
            Tuple[bool, Dict]: (passed, stats)
        """
        # Determine universe parameters
        u_params = parse_universe(universe_id)
        asset_type = u_params["asset_type"]
        limit = u_params["limit"]
        min_volume = u_params["min_volume"]
        
        # Expected count is simply the limit (e.g. 100 or 500)
        # Or we could query the previous day's count for this specific universe logic
        # But the user suggested: expected = limit (100/500)
        expected = limit
        
        # Count actual assets that match the universe criteria for the given date
        query_curr = """
        SELECT COUNT(*) as count
        FROM (
            SELECT df.asset_id
            FROM daily_features df
            JOIN assets a ON a.asset_id = df.asset_id
            WHERE df.date = %s
              AND a.asset_type = %s
              AND COALESCE(df.dollar_volume_sma_20, 0) > %s
            ORDER BY df.dollar_volume_sma_20 DESC NULLS LAST
            LIMIT %s
        ) sub
        """
        
        curr_count_res = self.db.fetch_one(query_curr, (as_of_date, asset_type, min_volume, limit))
        curr_count = curr_count_res['count'] if curr_count_res else 0
        
        coverage = curr_count / expected if expected > 0 else 0.0
        
        stats = {
            "expected": expected,
            "actual": curr_count,
            "coverage": coverage
        }
        
        if coverage < threshold:
            logger.error("freshness_check_failed", **stats)
            return False, stats
            
        logger.info("freshness_check_passed", **stats)
        return True, stats
