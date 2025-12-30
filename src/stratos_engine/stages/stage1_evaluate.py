"""Stage 1: Signal Evaluation - Evaluate templates against features."""

import json
from dataclasses import dataclass, asdict
from datetime import date
from typing import Any, Dict, List, Optional

import structlog

from ..db import Database
from ..templates import TemplateEngine

logger = structlog.get_logger()


@dataclass
class SignalFact:
    """A signal fact to be written to daily_signal_facts."""
    asset_id: int
    date: str
    template_name: str
    direction: str
    strength: float
    strength_components: Dict[str, Any]
    evidence: Dict[str, Any]
    attention_score: float
    config_id: Optional[str] = None


class Stage1Evaluate:
    """Stage 1: Evaluate templates against daily features."""
    
    def __init__(self, db: Database, engine: Optional[TemplateEngine] = None):
        self.db = db
        self.engine = engine or TemplateEngine()
    
    def load_features(
        self,
        as_of_date: str,
        universe_id: str = "equities_all",
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Load features from database for evaluation."""
        
        # Parse universe
        asset_type = "equity"
        min_dollar_volume = 1_000_000
        
        if universe_id.startswith("equities"):
            asset_type = "equity"
            if "top100" in universe_id:
                limit = limit or 100
            elif "top500" in universe_id:
                limit = limit or 500
        elif universe_id.startswith("crypto"):
            asset_type = "crypto"
            min_dollar_volume = 500_000
            if "top100" in universe_id:
                limit = limit or 100
            elif "top500" in universe_id:
                limit = limit or 500
        
        limit_clause = f"LIMIT {limit}" if limit else ""
        
        query = f"""
        SELECT 
            df.*,
            a.symbol,
            a.asset_type
        FROM daily_features df
        JOIN assets a ON df.asset_id = a.asset_id
        WHERE df.date = %s
          AND a.asset_type = %s
          AND COALESCE(df.dollar_volume_sma_20, 0) > %s
        ORDER BY df.dollar_volume_sma_20 DESC NULLS LAST
        {limit_clause}
        """
        
        features = self.db.fetch_all(query, (as_of_date, asset_type, min_dollar_volume))
        logger.info("features_loaded", count=len(features), date=as_of_date, universe=universe_id)
        return features
    
    def evaluate_all(
        self,
        features: List[Dict[str, Any]],
        as_of_date: str,
        config_id: Optional[str] = None
    ) -> List[SignalFact]:
        """Evaluate all features and return signal facts."""
        facts = []
        
        for row in features:
            asset_id = row.get("asset_id")
            if not asset_id:
                continue
            
            # Evaluate templates
            signals = self.engine.evaluate(row)
            
            if not signals:
                continue
            
            # Compute attention score
            attention_score = self.engine.compute_attention_score(signals)
            
            # Create signal facts
            for signal in signals:
                facts.append(SignalFact(
                    asset_id=asset_id,
                    date=as_of_date,
                    template_name=signal["template_name"],
                    direction=signal["direction"],
                    strength=signal["strength"],
                    strength_components=signal["strength_components"],
                    evidence=signal["evidence"],
                    attention_score=attention_score,
                    config_id=config_id,
                ))
        
        logger.info("evaluation_complete", facts=len(facts), assets=len(features))
        return facts
    
    def write_facts(self, facts: List[SignalFact]) -> int:
        """Write signal facts to database using upsert."""
        if not facts:
            return 0
        
        query = """
        INSERT INTO daily_signal_facts 
            (asset_id, date, template_name, direction, strength, 
             strength_components, evidence, attention_score, config_id)
        VALUES 
            (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (asset_id, date, template_name, COALESCE(config_id, '00000000-0000-0000-0000-000000000000'::uuid)) 
        DO UPDATE SET 
            direction = EXCLUDED.direction,
            strength = EXCLUDED.strength,
            strength_components = EXCLUDED.strength_components,
            evidence = EXCLUDED.evidence,
            attention_score = EXCLUDED.attention_score,
            updated_at = NOW()
        """
        
        params_list = [
            (
                f.asset_id,
                f.date,
                f.template_name,
                f.direction,
                f.strength,
                json.dumps(f.strength_components),
                json.dumps(f.evidence),
                f.attention_score,
                f.config_id,
            )
            for f in facts
        ]
        
        self.db.execute_batch(query, params_list)
        logger.info("facts_written", count=len(facts))
        return len(facts)
    
    def update_attention_scores(self, facts: List[SignalFact]) -> int:
        """Update attention_score in daily_features table."""
        if not facts:
            return 0
        
        # Group by asset_id to get one attention score per asset
        attention_by_asset = {}
        for f in facts:
            attention_by_asset[f.asset_id] = f.attention_score
        
        query = """
        UPDATE daily_features
        SET attention_score = %s,
            updated_at = NOW()
        WHERE asset_id = %s AND date = %s
        """
        
        # Get date from first fact
        as_of_date = facts[0].date
        
        params_list = [
            (score, asset_id, as_of_date)
            for asset_id, score in attention_by_asset.items()
        ]
        
        self.db.execute_batch(query, params_list)
        logger.info("attention_scores_updated", count=len(attention_by_asset))
        return len(attention_by_asset)
    
    def run(
        self,
        as_of_date: str,
        universe_id: str = "equities_all",
        config_id: Optional[str] = None,
        write: bool = True
    ) -> Dict[str, Any]:
        """Run the full Stage 1 evaluation pipeline."""
        logger.info("stage1_started", date=as_of_date, universe=universe_id, config=config_id)
        
        # Load features
        features = self.load_features(as_of_date, universe_id)
        
        if not features:
            logger.warning("no_features_found", date=as_of_date, universe=universe_id)
            return {
                "status": "no_data",
                "assets_evaluated": 0,
                "signals_generated": 0,
            }
        
        # Evaluate
        facts = self.evaluate_all(features, as_of_date, config_id)
        
        # Summarize
        by_template = {}
        by_direction = {"bullish": 0, "bearish": 0, "neutral": 0}
        assets_with_signals = set()
        
        for fact in facts:
            by_template[fact.template_name] = by_template.get(fact.template_name, 0) + 1
            by_direction[fact.direction] = by_direction.get(fact.direction, 0) + 1
            assets_with_signals.add(fact.asset_id)
        
        # Write if requested
        written = 0
        attention_updated = 0
        if write and facts:
            written = self.write_facts(facts)
            attention_updated = self.update_attention_scores(facts)
        
        result = {
            "status": "success",
            "assets_evaluated": len(features),
            "assets_with_signals": len(assets_with_signals),
            "signals_generated": len(facts),
            "signals_written": written,
            "attention_updated": attention_updated,
            "by_template": by_template,
            "by_direction": by_direction,
        }
        
        logger.info("stage1_complete", **result)
        return result
