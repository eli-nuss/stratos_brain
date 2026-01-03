from typing import Dict, Any, List
import logging
from datetime import datetime, timedelta
from ..utils.universe import parse_universe

logger = logging.getLogger(__name__)

# Scoring configuration constants
NEW_SIGNAL_BOOST = 1.5       # Multiplier for NEW signals vs ACTIVE
MAX_BULLISH_CAP = 300        # Maximum capped bullish score
MAX_BEARISH_CAP = 300        # Maximum capped bearish score
DELTA_WEIGHT = 0.3           # Weight for score_delta in inflection_score
NEW_SIGNAL_WEIGHT = 0.2      # Weight for new_signal_count in inflection_score


class Stage4Scoring:
    def __init__(self, db):
        self.db = db

    def run(self, as_of_date: str, universe_id: str, config_id: str) -> Dict[str, Any]:
        """
        Aggregates daily_signal_facts into daily_asset_scores with improved scoring:
        
        1. Weighted scoring: contribution = strength * weight
        2. Stacking caps: max bullish/bearish to prevent signal spam
        3. Novelty scoring: NEW signals get boost, delta from yesterday
        4. Inflection score: combines novelty factors for ranking
        """
        logger.info(f"Starting Stage 4 (Scoring) for {as_of_date} universe={universe_id}")
        
        # Determine universe parameters
        u_params = parse_universe(universe_id)
        asset_type = u_params["asset_type"]
        limit = u_params["limit"]
        min_volume = u_params["min_volume"]
        
        # Get the most recent prior score date for delta calculation
        # This handles weekends/holidays correctly (e.g., Monday compares to Friday)
        
        query = """
        INSERT INTO daily_asset_scores (
            as_of_date, asset_id, universe_id, config_id,
            score_total, score_bullish, score_bearish, 
            weighted_score, score_delta, new_signal_count, inflection_score,
            components, rank_in_universe
        )
        WITH universe_assets AS (
            -- Select assets in the universe based on liquidity
            SELECT df.asset_id
            FROM daily_features df
            JOIN assets a ON a.asset_id = df.asset_id
            WHERE df.date = %(as_of_date)s
              AND a.asset_type = %(asset_type)s
              AND COALESCE(df.dollar_volume_sma_20, 0) > %(min_volume)s
            ORDER BY df.dollar_volume_sma_20 DESC NULLS LAST
            LIMIT %(limit)s
        ),
        
        -- Get signal state (NEW vs ACTIVE) from signal_instances
        signal_states AS (
            SELECT 
                si.asset_id,
                si.signal_type,
                si.direction,
                si.state,
                CASE 
                    WHEN si.state = 'new' AND si.triggered_at = %(as_of_date)s::date THEN %(new_signal_boost)s
                    ELSE 1.0 
                END as state_multiplier
            FROM signal_instances si
            WHERE si.state IN ('new', 'active')
              AND si.config_id = %(config_id)s
        ),
        
        -- Aggregate signals with weights and state boost
        signal_agg AS (
            SELECT 
                dsf.asset_id,
                -- Raw scores (sum of strength)
                SUM(CASE WHEN dsf.direction = 'bullish' THEN dsf.strength ELSE 0 END) as raw_bullish,
                SUM(CASE WHEN dsf.direction = 'bearish' THEN dsf.strength ELSE 0 END) as raw_bearish,
                
                -- Weighted scores (strength * weight * state_multiplier)
                SUM(CASE WHEN dsf.direction = 'bullish' 
                    THEN dsf.strength * COALESCE(dsf.weight, 1.0) * COALESCE(ss.state_multiplier, 1.0)
                    ELSE 0 END) as weighted_bullish,
                SUM(CASE WHEN dsf.direction = 'bearish' 
                    THEN dsf.strength * COALESCE(dsf.weight, 1.0) * COALESCE(ss.state_multiplier, 1.0)
                    ELSE 0 END) as weighted_bearish,
                
                -- Count of NEW signals (triggered today)
                COUNT(CASE WHEN ss.state = 'new' AND ss.state_multiplier > 1.0 THEN 1 END) as new_signal_count,
                
                -- Components JSON with full details
                jsonb_agg(
                    jsonb_build_object(
                        'signal_type', dsf.signal_type,
                        'direction', dsf.direction,
                        'strength', dsf.strength,
                        'weight', COALESCE(dsf.weight, 1.0),
                        'state', COALESCE(ss.state, 'unknown'),
                        'contribution', dsf.strength * COALESCE(dsf.weight, 1.0) * COALESCE(ss.state_multiplier, 1.0)
                    )
                ) as components
            FROM daily_signal_facts dsf
            LEFT JOIN signal_states ss 
                ON dsf.asset_id = ss.asset_id 
                AND dsf.signal_type = ss.signal_type 
                AND dsf.direction = ss.direction
            WHERE dsf.date = %(as_of_date)s AND dsf.config_id = %(config_id)s
            GROUP BY dsf.asset_id
        ),
        
        -- Get the most recent prior score date for this universe/config
        prev_score_date AS (
            SELECT MAX(as_of_date) as prev_date
            FROM daily_asset_scores
            WHERE as_of_date < %(as_of_date)s
              AND universe_id = %(universe_id)s 
              AND config_id = %(config_id)s
        ),
        
        -- Get previous scores for delta calculation
        yesterday_scores AS (
            SELECT das.asset_id, das.score_total as prev_score
            FROM daily_asset_scores das
            CROSS JOIN prev_score_date psd
            WHERE das.as_of_date = psd.prev_date
              AND das.universe_id = %(universe_id)s 
              AND das.config_id = %(config_id)s
        ),
        
        -- Calculate final scores with caps
        scored AS (
            SELECT 
                ua.asset_id,
                -- Capped raw scores
                LEAST(COALESCE(sa.raw_bullish, 0), %(max_bullish_cap)s) as score_bullish,
                LEAST(COALESCE(sa.raw_bearish, 0), %(max_bearish_cap)s) as score_bearish,
                -- Capped weighted scores
                LEAST(COALESCE(sa.weighted_bullish, 0), %(max_bullish_cap)s) - 
                LEAST(COALESCE(sa.weighted_bearish, 0), %(max_bearish_cap)s) as weighted_score,
                -- Score delta from yesterday
                (LEAST(COALESCE(sa.raw_bullish, 0), %(max_bullish_cap)s) - 
                 LEAST(COALESCE(sa.raw_bearish, 0), %(max_bearish_cap)s)) - 
                COALESCE(ys.prev_score, 0) as score_delta,
                -- New signal count
                COALESCE(sa.new_signal_count, 0) as new_signal_count,
                -- Components
                COALESCE(sa.components, '[]'::jsonb) as components
            FROM universe_assets ua
            LEFT JOIN signal_agg sa ON ua.asset_id = sa.asset_id
            LEFT JOIN yesterday_scores ys ON ua.asset_id::text = ys.asset_id::text
        )
        
        SELECT 
            %(as_of_date)s as as_of_date,
            s.asset_id,
            %(universe_id)s as universe_id,
            %(config_id)s as config_id,
            -- score_total = capped bullish - capped bearish
            s.score_bullish - s.score_bearish as score_total,
            s.score_bullish,
            s.score_bearish,
            s.weighted_score,
            s.score_delta,
            s.new_signal_count,
            -- inflection_score: combines weighted_score, delta, and new signals
            s.weighted_score + 
            (s.score_delta * %(delta_weight)s) + 
            (s.new_signal_count * %(new_signal_weight)s * 50) as inflection_score,
            s.components,
            -- Rank by inflection_score (not just score_total)
            RANK() OVER (ORDER BY (
                s.weighted_score + 
                (s.score_delta * %(delta_weight)s) + 
                (s.new_signal_count * %(new_signal_weight)s * 50)
            ) DESC) as rank_in_universe
        FROM scored s
        ON CONFLICT (as_of_date, asset_id, universe_id, config_id) 
        DO UPDATE SET
            score_total = EXCLUDED.score_total,
            score_bullish = EXCLUDED.score_bullish,
            score_bearish = EXCLUDED.score_bearish,
            weighted_score = EXCLUDED.weighted_score,
            score_delta = EXCLUDED.score_delta,
            new_signal_count = EXCLUDED.new_signal_count,
            inflection_score = EXCLUDED.inflection_score,
            components = EXCLUDED.components,
            rank_in_universe = EXCLUDED.rank_in_universe,
            created_at = NOW();
        """
        
        params = {
            'as_of_date': as_of_date,
            'asset_type': asset_type,
            'min_volume': min_volume,
            'limit': limit,
            'config_id': config_id,
            'universe_id': universe_id,
            'new_signal_boost': NEW_SIGNAL_BOOST,
            'max_bullish_cap': MAX_BULLISH_CAP,
            'max_bearish_cap': MAX_BEARISH_CAP,
            'delta_weight': DELTA_WEIGHT,
            'new_signal_weight': NEW_SIGNAL_WEIGHT,
        }
        
        with self.db.cursor() as cur:
            cur.execute(query, params)
            row_count = cur.rowcount
            
        logger.info(f"Stage 4 complete. Updated scores for {row_count} assets.")
        return {"assets_scored": row_count}
    
    def get_top_inflections(self, as_of_date: str, universe_id: str, config_id: str, 
                           direction: str = 'bullish', limit: int = 10) -> List[Dict]:
        """
        Get top assets by inflection_score for a given direction.
        
        Args:
            direction: 'bullish' for leaders, 'bearish' for risks
        """
        query = """
        SELECT 
            a.symbol,
            a.name,
            das.score_total,
            das.weighted_score,
            das.score_delta,
            das.new_signal_count,
            das.inflection_score,
            das.rank_in_universe,
            das.components
        FROM daily_asset_scores das
        JOIN assets a ON das.asset_id::text = a.asset_id::text
        WHERE das.as_of_date = %s
          AND das.universe_id = %s
          AND das.config_id = %s
          AND CASE 
              WHEN %s = 'bullish' THEN das.inflection_score > 0
              ELSE das.inflection_score < 0
          END
        ORDER BY 
            CASE WHEN %s = 'bullish' THEN das.inflection_score ELSE -das.inflection_score END DESC
        LIMIT %s;
        """
        
        with self.db.cursor() as cur:
            cur.execute(query, (as_of_date, universe_id, config_id, direction, direction, limit))
            columns = [desc[0] for desc in cur.description]
            return [dict(zip(columns, row)) for row in cur.fetchall()]
