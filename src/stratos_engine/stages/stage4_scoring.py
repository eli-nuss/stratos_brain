from typing import Dict, Any, List
import logging
from datetime import datetime
from ..utils.universe import parse_universe

logger = logging.getLogger(__name__)

class Stage4Scoring:
    def __init__(self, db):
        self.db = db

    def run(self, as_of_date: str, universe_id: str, config_id: str) -> Dict[str, Any]:
        """
        Aggregates daily_signal_facts into daily_asset_scores.
        """
        logger.info(f"Starting Stage 4 (Scoring) for {as_of_date} universe={universe_id}")
        
        # Determine universe parameters
        u_params = parse_universe(universe_id)
        asset_type = u_params["asset_type"]
        limit = u_params["limit"]
        min_volume = u_params["min_volume"]
        
        # Use the same universe selection logic as Stage 1
        query = """
        INSERT INTO daily_asset_scores (
            as_of_date, asset_id, universe_id, config_id,
            score_total, score_bullish, score_bearish, components, rank_in_universe
        )
        WITH universe_assets AS (
            SELECT df.asset_id
            FROM daily_features df
            JOIN assets a ON a.asset_id = df.asset_id
            WHERE df.date = %s
              AND a.asset_type = %s
              AND COALESCE(df.dollar_volume_sma_20, 0) > %s
            ORDER BY df.dollar_volume_sma_20 DESC NULLS LAST
            LIMIT %s
        ),
        signal_agg AS (
            SELECT 
                asset_id,
                SUM(CASE WHEN direction = 'bullish' THEN strength ELSE 0 END) as score_bullish,
                SUM(CASE WHEN direction = 'bearish' THEN strength ELSE 0 END) as score_bearish,
                jsonb_agg(
                    jsonb_build_object(
                        'signal_type', signal_type,
                        'direction', direction,
                        'strength', strength,
                        'weight', weight
                    )
                ) as components
            FROM daily_signal_facts
            WHERE date = %s AND config_id = %s
            GROUP BY asset_id
        )
        SELECT 
            %s as as_of_date,
            ua.asset_id,
            %s as universe_id,
            %s as config_id,
            COALESCE(sa.score_bullish, 0) - COALESCE(sa.score_bearish, 0) as score_total,
            COALESCE(sa.score_bullish, 0) as score_bullish,
            COALESCE(sa.score_bearish, 0) as score_bearish,
            COALESCE(sa.components, '[]'::jsonb) as components,
            RANK() OVER (ORDER BY (COALESCE(sa.score_bullish, 0) - COALESCE(sa.score_bearish, 0)) DESC) as rank_in_universe
        FROM universe_assets ua
        LEFT JOIN signal_agg sa ON ua.asset_id = sa.asset_id
        ON CONFLICT (as_of_date, asset_id, universe_id, config_id) 
        DO UPDATE SET
            score_total = EXCLUDED.score_total,
            score_bullish = EXCLUDED.score_bullish,
            score_bearish = EXCLUDED.score_bearish,
            components = EXCLUDED.components,
            rank_in_universe = EXCLUDED.rank_in_universe,
            created_at = NOW();
        """
        
        with self.db.cursor() as cur:
            cur.execute(query, (
                as_of_date, asset_type, min_volume, limit,  # universe_assets params
                as_of_date, config_id,                      # signal_agg params
                as_of_date, universe_id, config_id          # select params
            ))
            row_count = cur.rowcount
            
        logger.info(f"Stage 4 complete. Updated scores for {row_count} assets.")
        return {"assets_scored": row_count}
