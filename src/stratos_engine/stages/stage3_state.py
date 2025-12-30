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
        config_filter = "AND config_id = %s" if config_id else "AND config_id IS NULL"
        params = (config_id,) if config_id else ()
        
        query = f"""
        SELECT *
        FROM signal_instances
        WHERE state IN ('new', 'active')
        {config_filter}
        ORDER BY created_at DESC
        """
        
        return self.db.fetch_all(query, params)
    
    def get_todays_facts(self, as_of_date: str, config_id: Optional[str] = None) -> Dict[tuple, Dict]:
        """Get today's signal facts as a lookup dict."""
        config_filter = "AND config_id = %s" if config_id else "AND config_id IS NULL"
        params = (as_of_date, config_id) if config_id else (as_of_date,)
        
        query = f"""
        SELECT asset_id, template_name, direction, strength, attention_score
        FROM daily_signal_facts
        WHERE date = %s
        {config_filter}
        """
        
        facts = self.db.fetch_all(query, params)
        return {(f["asset_id"], f["template_name"]): f for f in facts}
    
    def create_instance(
        self,
        asset_id: int,
        template_name: str,
        direction: str,
        first_date: str,
        strength: float,
        config_id: Optional[str] = None
    ) -> str:
        """Create a new signal instance."""
        instance_id = str(uuid4())
        
        query = """
        INSERT INTO signal_instances
            (instance_id, asset_id, template_name, direction, state, 
             first_date, last_seen_date, strength_at_open, config_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (asset_id, template_name, COALESCE(config_id, '00000000-0000-0000-0000-000000000000'::uuid))
        WHERE state IN ('new', 'active')
        DO UPDATE SET
            last_seen_date = EXCLUDED.last_seen_date,
            updated_at = NOW()
        RETURNING instance_id
        """
        
        result = self.db.fetch_one(query, (
            instance_id, asset_id, template_name, direction,
            SignalState.NEW, first_date, first_date, strength, config_id
        ))
        
        return result["instance_id"] if result else instance_id
    
    def update_instance_state(
        self,
        instance_id: str,
        new_state: str,
        reason: Optional[str] = None
    ) -> bool:
        """Update an instance's state."""
        query = """
        UPDATE signal_instances
        SET state = %s,
            state_reason = %s,
            updated_at = NOW()
        WHERE instance_id = %s
        """
        
        self.db.execute(query, (new_state, reason, instance_id))
        logger.info("state_updated", instance_id=instance_id, new_state=new_state, reason=reason)
        return True
    
    def update_last_seen(self, instance_id: str, last_seen_date: str) -> None:
        """Update the last_seen_date for an instance."""
        query = """
        UPDATE signal_instances
        SET last_seen_date = %s,
            days_absent = 0,
            updated_at = NOW()
        WHERE instance_id = %s
        """
        self.db.execute(query, (last_seen_date, instance_id))
    
    def increment_days_absent(self, instance_id: str) -> int:
        """Increment days_absent counter and return new value."""
        query = """
        UPDATE signal_instances
        SET days_absent = COALESCE(days_absent, 0) + 1,
            updated_at = NOW()
        WHERE instance_id = %s
        RETURNING days_absent
        """
        result = self.db.fetch_one(query, (instance_id,))
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
        
        for (asset_id, template_name), fact in facts.items():
            key = (asset_id, template_name)
            
            # Skip if already has an active instance
            if key in existing_instances:
                continue
            
            # Check cooldown
            if self._is_in_cooldown(asset_id, template_name, as_of_date, config_id):
                continue
            
            # Create new instance
            self.create_instance(
                asset_id=asset_id,
                template_name=template_name,
                direction=fact["direction"],
                first_date=as_of_date,
                strength=fact["strength"],
                config_id=config_id,
            )
            created += 1
        
        logger.info("new_instances_created", count=created)
        return created
    
    def _is_in_cooldown(
        self,
        asset_id: int,
        template_name: str,
        as_of_date: str,
        config_id: Optional[str] = None
    ) -> bool:
        """Check if a signal is still in cooldown period."""
        config_filter = "AND config_id = %s" if config_id else "AND config_id IS NULL"
        params_base = (asset_id, template_name, as_of_date, self.COOLDOWN_DAYS)
        params = params_base + (config_id,) if config_id else params_base
        
        query = f"""
        SELECT 1 FROM signal_instances
        WHERE asset_id = %s
          AND template_name = %s
          AND state = 'cooldown'
          AND updated_at > (%s::date - INTERVAL '%s days')
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
            key = (instance["asset_id"], instance["template_name"])
            instance_id = instance["instance_id"]
            current_state = instance["state"]
            first_date = instance["first_date"]
            
            if key in facts:
                # Signal still firing - update last_seen
                self.update_last_seen(instance_id, as_of_date)
                stats["updated"] += 1
                
                # Promote NEW to ACTIVE after MIN_ACTIVE_DAYS
                if current_state == SignalState.NEW:
                    days_active = (datetime.strptime(as_of_date, "%Y-%m-%d").date() - first_date).days
                    if days_active >= self.MIN_ACTIVE_DAYS:
                        self.update_instance_state(instance_id, SignalState.ACTIVE, "promoted_after_min_days")
                        stats["promoted"] += 1
            else:
                # Signal not firing today
                days_absent = self.increment_days_absent(instance_id)
                
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
            state_reason = 'cooldown_started',
            updated_at = NOW()
        WHERE state = 'ended'
          AND updated_at < %s::date
        """
        
        self.db.execute(query, (as_of_date,))
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
        existing_map = {(i["asset_id"], i["template_name"]): i for i in instances}
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
