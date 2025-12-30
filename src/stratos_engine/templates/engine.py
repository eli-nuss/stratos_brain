"""Template evaluation engine for signal detection."""

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml
import structlog

from .direction import get_direction

logger = structlog.get_logger()

# Default template file path
DEFAULT_TEMPLATE_PATH = Path(__file__).parent / "v32.yaml"


class TemplateEngine:
    """Evaluates signal templates against feature data."""
    
    def __init__(self, config_path: Optional[str] = None, config_override: Optional[Dict] = None):
        """
        Initialize the template engine.
        
        Args:
            config_path: Path to YAML template file. Uses default v32.yaml if not specified.
            config_override: Optional dict to override template config (for UI-driven configs)
        """
        if config_override:
            self.config = config_override
        else:
            path = Path(config_path) if config_path else DEFAULT_TEMPLATE_PATH
            with open(path, "r") as f:
                self.config = yaml.safe_load(f)
        
        self.templates = {t["name"]: t for t in self.config.get("templates", [])}
        self.global_config = self.config.get("global", {})
        self.version = self.config.get("version", "unknown")
        
        logger.info("template_engine_initialized", version=self.version, templates=list(self.templates.keys()))
    
    def _safe_get(self, row: Dict[str, Any], key: str, default: Any = None) -> Any:
        """Safely get a value from row."""
        val = row.get(key, default)
        if val is None:
            return default
        try:
            if val != val:  # NaN check
                return default
        except (TypeError, ValueError):
            pass
        return val
    
    def _to_float(self, val: Any, default: float = 0.0) -> float:
        """Convert value to float safely."""
        if val is None:
            return default
        try:
            if val != val:
                return default
            return float(val)
        except (TypeError, ValueError):
            return default
    
    def _to_bool(self, val: Any) -> bool:
        """Convert value to bool safely."""
        if val is None:
            return False
        if isinstance(val, bool):
            return val
        if isinstance(val, str):
            return val.lower() in ("true", "1", "yes", "t")
        return bool(val)
    
    def evaluate_condition(self, cond: Dict[str, Any], row: Dict[str, Any]) -> bool:
        """Evaluate a single condition against a row of features."""
        feature = cond.get("feature")
        op = cond.get("op")
        value = cond.get("value")
        value_feature = cond.get("value_feature")
        use_abs = cond.get("abs", False)
        
        # Get feature value
        feat_val = self._safe_get(row, feature)
        if feat_val is None:
            return False
        
        # Convert string numbers to float for comparison
        if isinstance(feat_val, str):
            try:
                feat_val = float(feat_val)
            except (ValueError, TypeError):
                pass
        
        # Apply abs if needed
        if use_abs and isinstance(feat_val, (int, float)):
            feat_val = abs(feat_val)
        
        # Get comparison value
        if value_feature:
            comp_val = self._safe_get(row, value_feature)
            if comp_val is None:
                return False
            if isinstance(comp_val, str):
                try:
                    comp_val = float(comp_val)
                except (ValueError, TypeError):
                    pass
        else:
            comp_val = value
        
        # Evaluate operator
        try:
            if op == "==":
                if isinstance(comp_val, bool):
                    return self._to_bool(feat_val) == comp_val
                return feat_val == comp_val
            elif op == "!=":
                return feat_val != comp_val
            elif op == ">":
                return float(feat_val) > float(comp_val)
            elif op == ">=":
                return float(feat_val) >= float(comp_val)
            elif op == "<":
                return float(feat_val) < float(comp_val)
            elif op == "<=":
                return float(feat_val) <= float(comp_val)
            elif op == "in":
                return feat_val in comp_val
            elif op == "not_in":
                return feat_val not in comp_val
        except (ValueError, TypeError):
            return False
        
        return False
    
    def evaluate_gate(self, gate: Dict[str, Any], row: Dict[str, Any]) -> bool:
        """Evaluate a gate (all/any/not logic)."""
        if "all" in gate:
            return all(self._eval_gate_item(item, row) for item in gate["all"])
        elif "any" in gate:
            return any(self._eval_gate_item(item, row) for item in gate["any"])
        elif "not" in gate:
            return not self._eval_gate_item(gate["not"], row)
        else:
            return self.evaluate_condition(gate, row)
    
    def _eval_gate_item(self, item: Dict[str, Any], row: Dict[str, Any]) -> bool:
        """Evaluate a single gate item (could be condition or nested gate)."""
        if "all" in item or "any" in item or "not" in item:
            return self.evaluate_gate(item, row)
        else:
            return self.evaluate_condition(item, row)
    
    def compute_strength(self, template: Dict[str, Any], row: Dict[str, Any]) -> Tuple[float, Dict[str, Any]]:
        """Compute strength score and components."""
        strength_config = template.get("strength", {})
        base = strength_config.get("base", 50)
        
        components = {"base": base}
        score = base
        
        # Add boosters
        for booster in strength_config.get("add", []):
            if self.evaluate_condition(booster["when"], row):
                points = booster["points"]
                score += points
                components[booster["name"]] = points
        
        # Subtract penalties
        for penalty in strength_config.get("subtract", []):
            if self.evaluate_condition(penalty["when"], row):
                points = penalty["points"]
                score -= points
                components[penalty["name"]] = -points
        
        # Apply global adjustments
        global_adj = self.global_config.get("global_strength_adjustments", {})
        for adj in global_adj.get("add", []):
            if self.evaluate_condition(adj["when"], row):
                points = adj["points"]
                score += points
                components[f"global:{adj['name']}"] = points
        
        for adj in global_adj.get("subtract", []):
            if self.evaluate_condition(adj["when"], row):
                points = adj["points"]
                score -= points
                components[f"global:{adj['name']}"] = -points
        
        # Clamp to 0-100
        score = max(0, min(100, score))
        
        return score, components
    
    def extract_evidence(self, template: Dict[str, Any], row: Dict[str, Any]) -> Dict[str, Any]:
        """Extract evidence fields from row."""
        evidence = {}
        for field in template.get("evidence_fields", []):
            val = self._safe_get(row, field)
            if val is not None:
                evidence[field] = val
        return evidence
    
    def evaluate(self, row: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Evaluate all templates against a row.
        
        Returns:
            List of signal results with template_name, direction, strength, components, evidence
        """
        results = []
        
        for name, template in self.templates.items():
            gate = template.get("gate", {})
            
            if self.evaluate_gate(gate, row):
                direction = get_direction(name, row)
                strength, components = self.compute_strength(template, row)
                evidence = self.extract_evidence(template, row)
                base_weight = template.get("base_weight", 10)
                
                results.append({
                    "template_name": name,
                    "direction": direction,
                    "strength": strength,
                    "strength_components": components,
                    "evidence": evidence,
                    "base_weight": base_weight,
                })
        
        return results
    
    def compute_attention_score(self, signals: List[Dict[str, Any]]) -> float:
        """
        Compute attention score from fired signals.
        
        Bullish signals contribute positive weight, bearish contribute negative.
        Score is clipped to [-100, +100].
        """
        score = 0.0
        for signal in signals:
            weight = signal.get("base_weight", 10)
            direction = signal.get("direction", "neutral")
            
            if direction == "bullish":
                score += weight
            elif direction == "bearish":
                score -= weight
        
        return max(-100, min(100, score))
