"""Stage 3: State Machine - Manage signal instance lifecycle."""

import json
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

import structlog

from ..db import Database

logger = structlog.get_logger()


# State definitions
class SignalState:
    NEW = "new"
    ACTIVE = "active"
    ENDED = "ended"
    INVALIDATED = "invalidated"
    COOLDOWN = "cooldown"


# State transition rules
VALID_TRANSITIONS = {
    SignalState.NEW: [SignalState.ACTIVE, SignalState.ENDED, SignalState.INVALIDATED],
    SignalState.ACTIVE: [SignalState.ENDED, SignalState.INVALIDATED],
    SignalState.ENDED: [SignalState.COOLDOWN],
    SignalState.INVALIDATED: [SignalState.COOLDOWN],
    SignalState.COOLDOWN: [SignalState.NEW],  # Can restart after cooldown
}


class Stage3State:
    """Stage 3: Manage signal instance state machine."""
    
    # Configuration
    GRACE_PERIOD_DAYS = 2  # Days a signal can be absent before ending
    COOLDOWN_DAYS = 5  # Days before same signal can fire again
    MIN_ACTIVE_DAYS = 2  # Minimum days in ACTIVE before can end
    
    def __init__(self, db: Database):
        self.db = db
    
    def get_active_instances(self, config_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all instances in NEW or ACTIVE state."""
        config_filter = "AND config_id = %s" if config_id else ""
        params = (config_id,) if config_id else ()
        
        query = f"""
        SELECT id, asset_id, signal_type, direction, state, 
               triggered_at, last_seen_at, strength, config_id
        FROM signal_instances
        WHERE state IN ('new', 'active')
        {config_filter}
        ORDER BY created_at DESC
        """
        
        return self.db.fetch_all(query, params)
    
    def get_todays_facts(self, as_of_date: str, config_id: Optional[str] = None) -> Dict[tuple, Dict]:
        """Get today's signal facts as a lookup dict."""
        config_filter = "AND config_id = %s" if config_id else ""
        params = (as_of_date, config_id) if config_id else (as_of_date,)
        
        query = f"""
        SELECT asset_id, signal_type, direction, strength, attention_score
        FROM daily_signal_facts
        WHERE date = %s
        {config_filter}
        """
        
        facts = self.db.fetch_all(query, params)
        return {(f["asset_id"], f["signal_type"]): f for f in facts}
    
    def create_instance(
        self,
        asset_id: int,
        signal_type: str,
        direction: str,
        triggered_at: str,
        strength: float,
        config_id: Optional[str] = None
    ) -> int:
        """Create a new signal instance."""
        
        # Use INSERT with ON CONFLICT based on the actual unique constraint
        # UNIQUE (asset_id, signal_type, triggered_at)
        query = """
        INSERT INTO signal_instances
            (asset_id, signal_type, direction, state, 
             triggered_at, last_seen_at, strength, config_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT ON CONSTRAINT daily_signals_v2_asset_id_signal_type_triggered_at_key
        DO UPDATE SET
            last_seen_at = EXCLUDED.last_seen_at,
            strength = EXCLUDED.strength,
            updated_at = NOW()
        RETURNING id
        """
        
        result = self.db.fetch_one(query, (
            asset_id, signal_type, direction,
            SignalState.NEW, triggered_at, triggered_at, strength, config_id
        ))
        
        return result["id"] if result else None
    
    def update_instance_state(
        self,
        instance_id: int,
        new_state: str,
        reason: Optional[str] = None
    ) -> bool:
        """Update an instance's state."""
        query = """
        UPDATE signal_instances
        SET state = %s,
            invalidation_reason = %s,
            updated_at = NOW()
        WHERE id = %s
        """
        
        self.db.execute(query, (new_state, reason, instance_id))
        logger.info("state_updated", instance_id=instance_id, new_state=new_state, reason=reason)
        return True
    
    def update_last_seen(self, instance_id: int, last_seen_at: str) -> None:
        """Update the last_seen_at for an instance."""
        query = """
        UPDATE signal_instances
        SET last_seen_at = %s,
            updated_at = NOW()
        WHERE id = %s
        """
        self.db.execute(query, (last_seen_at, instance_id))
    
    def get_days_absent(self, instance_id: int, as_of_date: str) -> int:
        """Calculate days absent based on last_seen_at."""
        query = """
        SELECT (%s::date - last_seen_at::date) as days_absent
        FROM signal_instances
        WHERE id = %s
        """
        result = self.db.fetch_one(query, (as_of_date, instance_id))
        return result["days_absent"] if result else 0
    
    def process_new_signals(
        self,
        as_of_date: str,
        facts: Dict[tuple, Dict],
        existing_instances: Dict[tuple, Dict],
        config_id: Optional[str] = None
    ) -> int:
        """Create instances for new signals that don't have active instances."""
        created = 0
        
        for (asset_id, signal_type), fact in facts.items():
            key = (asset_id, signal_type)
            
            # Skip if already has an active instance
            if key in existing_instances:
                continue
            
            # Check cooldown
            if self._is_in_cooldown(asset_id, signal_type, as_of_date, config_id):
                continue
            
            # Create new instance
            self.create_instance(
                asset_id=asset_id,
                signal_type=signal_type,
                direction=fact["direction"],
                triggered_at=as_of_date,
                strength=fact["strength"],
                config_id=config_id,
            )
            created += 1
        
        logger.info("new_instances_created", count=created)
        return created
    
    def _is_in_cooldown(
        self,
        asset_id: int,
        signal_type: str,
        as_of_date: str,
        config_id: Optional[str] = None
    ) -> bool:
        """Check if a signal is still in cooldown period."""
        config_filter = "AND config_id = %s" if config_id else ""
        params_base = (asset_id, signal_type, as_of_date)
        params = params_base + (config_id,) if config_id else params_base
        
        query = f"""
        SELECT 1 FROM signal_instances
        WHERE asset_id = %s
          AND signal_type = %s
          AND state = 'cooldown'
          AND cooldown_until > %s::date
          {config_filter}
        LIMIT 1
        """
        
        result = self.db.fetch_one(query, params)
        return result is not None
    
    def process_existing_instances(
        self,
        as_of_date: str,
        facts: Dict[tuple, Dict],
        instances: List[Dict[str, Any]]
    ) -> Dict[str, int]:
        """Process existing instances - update or transition state."""
        stats = {"updated": 0, "ended": 0, "promoted": 0}
        
        for instance in instances:
            key = (instance["asset_id"], instance["signal_type"])
            instance_id = instance["id"]
            current_state = instance["state"]
            triggered_at = instance["triggered_at"]
            
            if key in facts:
                # Signal still firing - update last_seen
                self.update_last_seen(instance_id, as_of_date)
                stats["updated"] += 1
                
                # Promote NEW to ACTIVE after MIN_ACTIVE_DAYS
                if current_state == SignalState.NEW:
                    if isinstance(triggered_at, str):
                        triggered_at = datetime.strptime(triggered_at, "%Y-%m-%d").date()
                    as_of = datetime.strptime(as_of_date, "%Y-%m-%d").date()
                    days_active = (as_of - triggered_at).days
                    if days_active >= self.MIN_ACTIVE_DAYS:
                        self.update_instance_state(instance_id, SignalState.ACTIVE, "promoted_after_min_days")
                        stats["promoted"] += 1
            else:
                # Signal not firing today
                days_absent = self.get_days_absent(instance_id, as_of_date)
                
                if days_absent >= self.GRACE_PERIOD_DAYS:
                    # End the signal
                    self.update_instance_state(instance_id, SignalState.ENDED, f"absent_{days_absent}_days")
                    stats["ended"] += 1
        
        logger.info("instances_processed", **stats)
        return stats
    
    def expire_old_ended(self, as_of_date: str) -> int:
        """Move ENDED signals to COOLDOWN after a day."""
        query = """
        UPDATE signal_instances
        SET state = 'cooldown',
            invalidation_reason = 'cooldown_started',
            cooldown_until = %s::date + INTERVAL '5 days',
            ended_at = NOW(),
            updated_at = NOW()
        WHERE state = 'ended'
          AND updated_at < %s::date
        """
        
        self.db.execute(query, (as_of_date, as_of_date))
        # Note: Can't easily get count with execute, would need separate query
        return 0
    
    def run(
        self,
        as_of_date: str,
        config_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Run the full Stage 3 state machine update."""
        logger.info("stage3_started", date=as_of_date, config=config_id)
        
        # Get today's facts
        facts = self.get_todays_facts(as_of_date, config_id)
        logger.info("facts_loaded", count=len(facts))
        
        # Get active instances
        instances = self.get_active_instances(config_id)
        existing_map = {(i["asset_id"], i["signal_type"]): i for i in instances}
        logger.info("active_instances_loaded", count=len(instances))
        
        # Process new signals
        new_created = self.process_new_signals(as_of_date, facts, existing_map, config_id)
        
        # Process existing instances
        process_stats = self.process_existing_instances(as_of_date, facts, instances)
        
        # Expire old ended signals
        self.expire_old_ended(as_of_date)
        
        result = {
            "status": "success",
            "facts_today": len(facts),
            "instances_active": len(instances),
            "new_created": new_created,
            **process_stats,
        }
        
        logger.info("stage3_complete", **result)
        return result
