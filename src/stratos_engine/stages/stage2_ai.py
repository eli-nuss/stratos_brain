"""Stage 2: AI Analysis - LLM-powered signal analysis."""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import structlog
from openai import OpenAI

from ..config import config
from ..db import Database

logger = structlog.get_logger()

# Load prompts
PROMPT_DIR = Path(__file__).parent.parent / "prompts"


@dataclass
class AIAnnotation:
    """AI annotation for a signal."""
    instance_id: str
    attention_level: str  # ignore, glance, focus, priority
    confidence: float  # 0.0 - 1.0
    thesis: str
    supporting_factors: List[str]
    risk_factors: List[str]
    recommended_action: str
    priority_rank: int
    tokens_used: int


class Stage2AI:
    """Stage 2: AI-powered signal analysis."""
    
    ATTENTION_LEVELS = ["ignore", "glance", "focus", "priority"]
    
    def __init__(self, db: Database, client: Optional[OpenAI] = None):
        self.db = db
        self.client = client or OpenAI(
            api_key=config.openai.api_key,
            base_url=config.openai.base_url,
        )
        self.model = config.openai.model
        self._load_prompts()
    
    def _load_prompts(self) -> None:
        """Load system prompt and output schema."""
        system_prompt_path = PROMPT_DIR / "ta_analyst_system.txt"
        schema_path = PROMPT_DIR / "ta_analyst_schema.json"
        
        if system_prompt_path.exists():
            self.system_prompt = system_prompt_path.read_text()
        else:
            self.system_prompt = self._default_system_prompt()
        
        if schema_path.exists():
            self.output_schema = json.loads(schema_path.read_text())
        else:
            self.output_schema = self._default_schema()
    
    def _default_system_prompt(self) -> str:
        return """You are a technical analysis expert evaluating trading signals.

Given a signal with its evidence (technical indicators), provide:
1. attention_level: How much attention this deserves (ignore/glance/focus/priority)
2. confidence: Your confidence in this signal (0.0-1.0)
3. thesis: Brief explanation of why this signal matters
4. supporting_factors: List of factors supporting this signal
5. risk_factors: List of risks or concerns
6. recommended_action: What to do (monitor/consider_entry/strong_buy/avoid)
7. priority_rank: 1-100 ranking of urgency

Be concise and actionable. Focus on the most important factors."""
    
    def _default_schema(self) -> Dict:
        return {
            "type": "object",
            "properties": {
                "attention_level": {"type": "string", "enum": ["ignore", "glance", "focus", "priority"]},
                "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                "thesis": {"type": "string"},
                "supporting_factors": {"type": "array", "items": {"type": "string"}},
                "risk_factors": {"type": "array", "items": {"type": "string"}},
                "recommended_action": {"type": "string"},
                "priority_rank": {"type": "integer", "minimum": 1, "maximum": 100}
            },
            "required": ["attention_level", "confidence", "thesis", "supporting_factors", 
                        "risk_factors", "recommended_action", "priority_rank"]
        }
    
    def get_pending_signals(
        self,
        as_of_date: str,
        min_strength: float = 60,
        limit: int = 50,
        config_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get signals that need AI analysis."""
        config_filter = "AND si.config_id = %s" if config_id else "AND si.config_id IS NULL"
        params = (as_of_date, min_strength, limit, config_id) if config_id else (as_of_date, min_strength, limit)
        
        query = f"""
        SELECT 
            si.instance_id,
            si.asset_id,
            si.template_name,
            si.direction,
            si.strength_at_open,
            a.symbol,
            dsf.evidence,
            dsf.strength,
            dsf.attention_score
        FROM signal_instances si
        JOIN assets a ON si.asset_id = a.asset_id
        JOIN daily_signal_facts dsf ON 
            si.asset_id = dsf.asset_id 
            AND si.template_name = dsf.template_name
            AND dsf.date = %s
        LEFT JOIN signal_ai_annotations saa ON si.instance_id = saa.instance_id
        WHERE si.state IN ('new', 'active')
          AND dsf.strength >= %s
          AND saa.instance_id IS NULL
          {config_filter}
        ORDER BY dsf.strength DESC
        LIMIT %s
        """
        
        return self.db.fetch_all(query, params)
    
    def build_prompt(self, signal: Dict[str, Any]) -> str:
        """Build the user prompt for a signal."""
        evidence = signal.get("evidence", {})
        if isinstance(evidence, str):
            evidence = json.loads(evidence)
        
        prompt = f"""
Analyze this trading signal:

**Asset:** {signal.get('symbol')} 
**Signal Type:** {signal.get('template_name')}
**Direction:** {signal.get('direction')}
**Strength:** {signal.get('strength')}/100
**Attention Score:** {signal.get('attention_score')}

**Technical Evidence:**
"""
        for key, value in evidence.items():
            if value is not None:
                prompt += f"- {key}: {value}\n"
        
        prompt += "\nProvide your analysis in the specified JSON format."
        return prompt
    
    def analyze_signal(self, signal: Dict[str, Any]) -> Optional[AIAnnotation]:
        """Analyze a single signal with the LLM."""
        try:
            user_prompt = self.build_prompt(signal)
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
                max_tokens=500,
            )
            
            content = response.choices[0].message.content
            result = json.loads(content)
            tokens_used = response.usage.total_tokens if response.usage else 0
            
            return AIAnnotation(
                instance_id=signal["instance_id"],
                attention_level=result.get("attention_level", "glance"),
                confidence=result.get("confidence", 0.5),
                thesis=result.get("thesis", ""),
                supporting_factors=result.get("supporting_factors", []),
                risk_factors=result.get("risk_factors", []),
                recommended_action=result.get("recommended_action", "monitor"),
                priority_rank=result.get("priority_rank", 50),
                tokens_used=tokens_used,
            )
        except Exception as e:
            logger.error("ai_analysis_failed", error=str(e), signal=signal.get("instance_id"))
            return None
    
    def write_annotation(self, annotation: AIAnnotation) -> bool:
        """Write AI annotation to database."""
        query = """
        INSERT INTO signal_ai_annotations
            (instance_id, attention_level, confidence, thesis,
             supporting_factors, risk_factors, recommended_action,
             priority_rank, tokens_used)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (instance_id) DO UPDATE SET
            attention_level = EXCLUDED.attention_level,
            confidence = EXCLUDED.confidence,
            thesis = EXCLUDED.thesis,
            supporting_factors = EXCLUDED.supporting_factors,
            risk_factors = EXCLUDED.risk_factors,
            recommended_action = EXCLUDED.recommended_action,
            priority_rank = EXCLUDED.priority_rank,
            tokens_used = EXCLUDED.tokens_used,
            updated_at = NOW()
        """
        
        self.db.execute(query, (
            annotation.instance_id,
            annotation.attention_level,
            annotation.confidence,
            annotation.thesis,
            json.dumps(annotation.supporting_factors),
            json.dumps(annotation.risk_factors),
            annotation.recommended_action,
            annotation.priority_rank,
            annotation.tokens_used,
        ))
        return True
    
    def run(
        self,
        as_of_date: str,
        min_strength: float = 60,
        budget: Optional[int] = None,
        config_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Run the full Stage 2 AI analysis pipeline."""
        logger.info("stage2_started", date=as_of_date, min_strength=min_strength, budget=budget)
        
        budget = budget or config.engine.ai_budget_per_run
        
        # Get pending signals
        signals = self.get_pending_signals(as_of_date, min_strength, budget, config_id)
        logger.info("pending_signals", count=len(signals))
        
        if not signals:
            return {
                "status": "no_signals",
                "analyzed": 0,
                "tokens_used": 0,
            }
        
        # Analyze each signal
        analyzed = 0
        total_tokens = 0
        
        for signal in signals:
            annotation = self.analyze_signal(signal)
            if annotation:
                self.write_annotation(annotation)
                analyzed += 1
                total_tokens += annotation.tokens_used
                logger.debug("signal_analyzed", 
                           instance_id=annotation.instance_id,
                           attention=annotation.attention_level,
                           confidence=annotation.confidence)
        
        result = {
            "status": "success",
            "signals_pending": len(signals),
            "analyzed": analyzed,
            "tokens_used": total_tokens,
        }
        
        logger.info("stage2_complete", **result)
        return result
