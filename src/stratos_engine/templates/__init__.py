"""Signal template definitions and evaluation engine."""

from .engine import TemplateEngine
from .direction import get_direction, DIRECTION_RULES

__all__ = ["TemplateEngine", "get_direction", "DIRECTION_RULES"]
