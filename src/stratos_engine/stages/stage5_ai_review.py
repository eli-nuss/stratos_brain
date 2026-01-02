from typing import Dict, Any, List
import logging
import json
import hashlib
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class Stage5AIReview:
    def __init__(self, db):
        self.db = db
        self.prompt_version = "v1_screener_review"

    def _get_target_assets(self, as_of_date: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Select top leaders, risks, and movers for review."""
        targets = []
        
        # Leaders
        query_leaders = """
        SELECT asset_id, 'leaders' as scope, score_total, components 
        FROM daily_asset_scores 
        WHERE as_of_date = %s AND score_total > 0 
        ORDER BY score_total DESC LIMIT %s
        """
        leaders = self.db.fetch_all(query_leaders, (as_of_date, limit))
        targets.extend(leaders)
        
        # Risks
        query_risks = """
        SELECT asset_id, 'risks' as scope, score_total, components 
        FROM daily_asset_scores 
        WHERE as_of_date = %s AND score_total < 0 
        ORDER BY score_total ASC LIMIT %s
        """
        risks = self.db.fetch_all(query_risks, (as_of_date, limit))
        targets.extend(risks)
        
        # Movers (simplified for now, just reusing logic from view if possible, or query directly)
        # For MVP, let's stick to leaders/risks to save tokens.
        
        return targets

    def _compute_hash(self, asset_data: Dict[str, Any]) -> str:
        """Compute hash of input data to detect changes."""
        # Hash based on score components (signals)
        data_str = json.dumps(asset_data.get("components", {}), sort_keys=True)
        return hashlib.md5(data_str.encode()).hexdigest()

    def _generate_review(self, asset_id: str, asset_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate AI review for the asset.
        In a real implementation, this would call an LLM.
        For MVP, we'll generate a structured placeholder.
        """
        score = asset_data.get("score_total", 0)
        sentiment = "Bullish" if score > 0 else "Bearish"
        
        return {
            "summary": f"{sentiment} outlook driven by strong signal confluence.",
            "key_drivers": ["Momentum", "Volume"],
            "risk_factors": ["Overbought RSI"] if score > 80 else [],
            "conviction": min(abs(score), 100)
        }

    def run(self, as_of_date: str, config_id: str, limit: int = 10) -> Dict[str, Any]:
        logger.info(f"Starting Stage 5 (AI Review) for {as_of_date}")
        
        targets = self._get_target_assets(as_of_date, limit)
        reviewed_count = 0
        reused_count = 0
        
        for asset in targets:
            asset_id = asset["asset_id"]
            input_hash = self._compute_hash(asset)
            
            # Check if we can reuse yesterday's review
            # (Logic: if input hash is same as yesterday, reuse)
            # For MVP, we'll just check if we already have a review for TODAY (idempotency)
            
            existing = self.db.fetch_one(
                "SELECT 1 FROM asset_ai_reviews WHERE asset_id = %s AND as_of_date = %s AND prompt_version = %s",
                (asset_id, as_of_date, self.prompt_version)
            )
            
            if existing:
                logger.info(f"Review already exists for {asset_id}, skipping.")
                continue
                
            # Generate new review
            review_json = self._generate_review(asset_id, asset)
            summary_text = review_json["summary"]
            
            self.db.execute(
                """
                INSERT INTO asset_ai_reviews (
                    asset_id, as_of_date, prompt_version, review_json, summary_text, 
                    input_hash, source_scope
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (asset_id, as_of_date, prompt_version) DO NOTHING
                """,
                (
                    asset_id, as_of_date, self.prompt_version, json.dumps(review_json), 
                    summary_text, input_hash, asset["scope"]
                )
            )
            reviewed_count += 1
            
        logger.info(f"Stage 5 complete. Reviewed {reviewed_count} assets.")
        return {"reviewed": reviewed_count, "targets": len(targets)}
