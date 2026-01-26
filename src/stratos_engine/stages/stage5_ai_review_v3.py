"""Stage 5 AI Review V3: Constrained Autonomy with Quant Setup Integration.

This version integrates quantitative setup signals from the setup_signals table
with AI analysis to provide a unified trading recommendation.

Key Features:
- Fetches active quant setups for each asset from setup_signals table
- Includes setup context (historical profit factor, entry/stop/target) in AI prompt
- AI provides single setup_purity_score (0-100) instead of dual scoring
- Auto-elevates attention level for high profit factor setups (PF > 2.0 → minimum FOCUS)
- AI can adjust entry/stop/target within ±10% of quant levels (soft guardrails)
"""

import json
import hashlib
import logging
import os
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

from google import genai
from google.genai import types
import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)

# Load prompts
PROMPT_DIR = Path(__file__).parent.parent.parent.parent / "prompts"

# Historical profit factors from backtesting optimization
HISTORICAL_PROFIT_FACTORS = {
    'weinstein_stage2': 4.09,
    'rs_breakout': 2.03,
    'donchian_55_breakout': 1.99,
    'trend_pullback_50ma': 1.97,
    'adx_holy_grail': 1.71,
    'vcp_squeeze': 1.69,
    'gap_up_momentum': 1.58,
    'oversold_bounce': 1.52,
    'acceleration_turn': 1.48,
    'ema_crossover': 1.45,
}

# Attention level elevation threshold
HIGH_PF_THRESHOLD = 2.0


class Stage5AIReviewV3:
    """Stage 5 AI Review V3: Constrained Autonomy with Quant Setup Integration."""
    
    PROMPT_VERSION = "v3.0.0"
    DEFAULT_MODEL = "gemini-3-flash-preview"
    PASS1_BARS = 365
    
    def __init__(self, model: Optional[str] = None, db_url: Optional[str] = None):
        """Initialize the Stage5AIReviewV3.
        
        Args:
            model: Gemini model to use (default: gemini-3-flash-preview)
            db_url: Database connection URL (default: from env)
        """
        self.model_name = model or os.environ.get("GEMINI_MODEL") or self.DEFAULT_MODEL
        self.db_url = db_url or os.environ.get(
            "SUPABASE_DATABASE_URL",
            os.environ.get("DATABASE_URL")
        )
        
        # Initialize Gemini client
        self.api_key = os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not set in environment")
        self.client = genai.Client(api_key=self.api_key)
        
        # Load prompts
        self._load_prompts()
        
        logger.info(f"Stage5AIReviewV3 initialized with model: {self.model_name}, version: {self.PROMPT_VERSION}")
    
    def _get_connection(self):
        """Get database connection."""
        return psycopg2.connect(self.db_url)
    
    def _load_prompts(self) -> None:
        """Load system prompts and schemas for v3 analysis."""
        self.system_prompt = (PROMPT_DIR / "ai_score_system_v2.txt").read_text()
        self.output_schema = json.loads((PROMPT_DIR / "ai_score_schema_v2.json").read_text())
    
    def get_assets_to_process(
        self,
        as_of_date: str,
        asset_type: Optional[str] = None,
        limit: int = 500
    ) -> List[Dict[str, Any]]:
        """Get assets to process for AI analysis.
        
        Prioritizes assets with active quant setups, then fills remaining slots
        with top assets by market cap or volume.
        
        Args:
            as_of_date: Target date for analysis
            asset_type: Filter by asset type ('crypto' or 'equity')
            limit: Maximum number of assets to process
            
        Returns:
            List of asset dictionaries with asset_id and symbol
        """
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # First get assets with active quant setups
                setup_query = """
                SELECT DISTINCT ss.asset_id, a.symbol, a.asset_type, a.name,
                       TRUE as has_active_setup
                FROM setup_signals ss
                JOIN assets a ON ss.asset_id = a.asset_id
                WHERE ss.signal_date = %s
                  AND a.is_active = TRUE
                """
                params = [as_of_date]
                
                if asset_type:
                    setup_query += " AND a.asset_type = %s"
                    params.append(asset_type)
                
                setup_query += " ORDER BY ss.asset_id LIMIT %s"
                params.append(limit)
                
                cur.execute(setup_query, params)
                setup_assets = list(cur.fetchall())
                
                logger.info(f"Found {len(setup_assets)} assets with active quant setups")
                
                # If we have fewer than limit, fill with top assets
                if len(setup_assets) < limit:
                    remaining = limit - len(setup_assets)
                    existing_ids = [a['asset_id'] for a in setup_assets]
                    
                    fill_query = """
                    SELECT a.asset_id, a.symbol, a.asset_type, a.name,
                           FALSE as has_active_setup
                    FROM assets a
                    WHERE a.is_active = TRUE
                    """
                    fill_params = []
                    
                    if asset_type:
                        fill_query += " AND a.asset_type = %s"
                        fill_params.append(asset_type)
                    
                    if existing_ids:
                        fill_query += f" AND a.asset_id NOT IN ({','.join(['%s'] * len(existing_ids))})"
                        fill_params.extend(existing_ids)
                    
                    fill_query += " ORDER BY a.asset_id LIMIT %s"
                    fill_params.append(remaining)
                    
                    cur.execute(fill_query, fill_params)
                    fill_assets = list(cur.fetchall())
                    setup_assets.extend(fill_assets)
                
                return setup_assets
        finally:
            conn.close()
    
    def _get_active_setups(self, asset_id: int, as_of_date: str) -> List[Dict[str, Any]]:
        """Get active quant setups for an asset on a given date.
        
        Args:
            asset_id: Asset ID
            as_of_date: Target date
            
        Returns:
            List of active setup dictionaries
        """
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                SELECT setup_name, entry_price, stop_loss, target_price,
                       risk_reward, entry_params, exit_params, context,
                       historical_profit_factor
                FROM setup_signals
                WHERE asset_id = %s AND signal_date = %s
                ORDER BY historical_profit_factor DESC NULLS LAST
                """
                cur.execute(query, (asset_id, as_of_date))
                setups = list(cur.fetchall())
                
                # Ensure historical_profit_factor is set from our constants if missing
                for setup in setups:
                    if setup.get('historical_profit_factor') is None:
                        setup['historical_profit_factor'] = HISTORICAL_PROFIT_FACTORS.get(
                            setup['setup_name'], 1.0
                        )
                
                return setups
        finally:
            conn.close()
    
    def _get_ohlcv_data(self, asset_id: int, as_of_date: str, limit: int = 365) -> List[Dict[str, Any]]:
        """Fetch OHLCV data for an asset.
        
        Args:
            asset_id: Asset ID
            as_of_date: End date for data
            limit: Number of bars to fetch
            
        Returns:
            List of OHLCV bar dictionaries (oldest first)
        """
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                SELECT date, open, high, low, close, volume
                FROM daily_bars
                WHERE asset_id = %s AND date <= %s
                ORDER BY date DESC
                LIMIT %s
                """
                cur.execute(query, (asset_id, as_of_date, limit))
                bars = list(cur.fetchall())
                return list(reversed(bars))  # Return oldest first
        finally:
            conn.close()
    
    def _build_ai_packet(
        self,
        asset_id: int,
        symbol: str,
        name: str,
        asset_type: str,
        as_of_date: str,
        ohlcv_data: List[Dict[str, Any]],
        active_setups: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Build the data packet for AI analysis.
        
        Args:
            asset_id: Asset ID
            symbol: Asset symbol
            name: Asset name
            asset_type: 'crypto' or 'equity'
            as_of_date: Analysis date
            ohlcv_data: OHLCV bar data
            active_setups: Active quant setups
            
        Returns:
            Data packet dictionary for AI prompt
        """
        # Format OHLCV as array rows
        ohlcv_formatted = [
            [
                str(b["date"]),
                float(b["open"]) if b["open"] else None,
                float(b["high"]) if b["high"] else None,
                float(b["low"]) if b["low"] else None,
                float(b["close"]) if b["close"] else None,
                float(b["volume"]) if b["volume"] else None,
            ]
            for b in ohlcv_data
        ]
        
        # Format active setups for AI context
        setups_context = []
        for setup in active_setups:
            setups_context.append({
                "setup_name": setup["setup_name"],
                "entry_price": float(setup["entry_price"]) if setup["entry_price"] else None,
                "stop_loss": float(setup["stop_loss"]) if setup["stop_loss"] else None,
                "target_price": float(setup["target_price"]) if setup["target_price"] else None,
                "risk_reward": float(setup["risk_reward"]) if setup["risk_reward"] else None,
                "historical_profit_factor": float(setup.get("historical_profit_factor", 1.0)),
            })
        
        # Determine primary setup (highest profit factor)
        primary_setup = None
        if setups_context:
            primary_setup = max(setups_context, key=lambda x: x.get("historical_profit_factor", 0))
        
        packet = {
            "asset": {
                "symbol": symbol,
                "name": name,
                "asset_type": asset_type,
            },
            "context": {
                "as_of_date": as_of_date,
            },
            "ohlcv": ohlcv_formatted,
            "quant_setups": {
                "active_setups": setups_context,
                "primary_setup": primary_setup,
                "has_active_setups": len(setups_context) > 0,
            }
        }
        
        return packet
    
    def _compute_input_hash(self, packet: Dict[str, Any]) -> str:
        """Compute hash of input data for idempotency.
        
        Args:
            packet: AI data packet
            
        Returns:
            SHA256 hash string
        """
        # Hash key elements
        hash_content = {
            "symbol": packet["asset"]["symbol"],
            "as_of_date": packet["context"]["as_of_date"],
            "ohlcv_last_10": packet["ohlcv"][-10:] if len(packet["ohlcv"]) >= 10 else packet["ohlcv"],
            "active_setups": [s["setup_name"] for s in packet["quant_setups"]["active_setups"]],
            "prompt_version": self.PROMPT_VERSION,
            "model": self.model_name,
        }
        return hashlib.sha256(json.dumps(hash_content, sort_keys=True).encode()).hexdigest()
    
    def _apply_attention_elevation(
        self,
        attention_level: str,
        primary_setup: Optional[Dict[str, Any]]
    ) -> str:
        """Apply attention level elevation for high profit factor setups.
        
        Args:
            attention_level: AI-assigned attention level
            primary_setup: Primary quant setup (highest PF)
            
        Returns:
            Potentially elevated attention level
        """
        if not primary_setup:
            return attention_level
        
        pf = primary_setup.get("historical_profit_factor", 0)
        
        # Elevate to minimum FOCUS if PF > 2.0
        if pf >= HIGH_PF_THRESHOLD:
            attention_hierarchy = ["IGNORE", "WATCH", "FOCUS", "URGENT"]
            current_idx = attention_hierarchy.index(attention_level) if attention_level in attention_hierarchy else 0
            min_idx = attention_hierarchy.index("FOCUS")
            
            if current_idx < min_idx:
                elevated = attention_hierarchy[min_idx]
                logger.info(f"Elevated attention from {attention_level} to {elevated} (PF={pf:.2f})")
                return elevated
        
        return attention_level
    
    def _validate_ai_adjustments(
        self,
        ai_result: Dict[str, Any],
        primary_setup: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Validate and log AI price adjustments against quant levels.
        
        Soft guardrails: log deviations but don't reject outputs.
        
        Args:
            ai_result: AI analysis result
            primary_setup: Primary quant setup
            
        Returns:
            Validated result with adjustment metadata
        """
        if not primary_setup:
            return ai_result
        
        deviations = []
        max_deviation_pct = 0.10  # 10% max deviation
        
        # Check entry adjustment
        quant_entry = primary_setup.get("entry_price")
        ai_entry = ai_result.get("ai_adjusted_entry")
        if quant_entry and ai_entry:
            deviation = abs(ai_entry - quant_entry) / quant_entry
            if deviation > max_deviation_pct:
                deviations.append(f"Entry deviation: {deviation:.1%} (quant={quant_entry}, ai={ai_entry})")
        
        # Check stop adjustment
        quant_stop = primary_setup.get("stop_loss")
        ai_stop = ai_result.get("ai_adjusted_stop")
        if quant_stop and ai_stop:
            deviation = abs(ai_stop - quant_stop) / quant_stop
            if deviation > max_deviation_pct:
                deviations.append(f"Stop deviation: {deviation:.1%} (quant={quant_stop}, ai={ai_stop})")
        
        # Check target adjustment
        quant_target = primary_setup.get("target_price")
        ai_target = ai_result.get("ai_adjusted_target")
        if quant_target and ai_target:
            deviation = abs(ai_target - quant_target) / quant_target
            if deviation > max_deviation_pct:
                deviations.append(f"Target deviation: {deviation:.1%} (quant={quant_target}, ai={ai_target})")
        
        # Log deviations (soft guardrails)
        if deviations:
            logger.warning(f"AI price adjustments exceed 10% threshold for {ai_result.get('symbol', 'unknown')}: {deviations}")
        
        ai_result["adjustment_deviations"] = deviations
        return ai_result
    
    def analyze_asset(
        self,
        asset_id: int,
        symbol: str,
        as_of_date: str,
        name: str = "",
        asset_type: str = "equity"
    ) -> Optional[Dict[str, Any]]:
        """Run AI analysis for a single asset.
        
        Args:
            asset_id: Asset ID
            symbol: Asset symbol
            as_of_date: Analysis date
            name: Asset name (optional)
            asset_type: 'crypto' or 'equity'
            
        Returns:
            Analysis result dictionary or None on error
        """
        logger.info(f"Analyzing {symbol} (asset_id={asset_id}) for {as_of_date}")
        
        # Get OHLCV data
        ohlcv_data = self._get_ohlcv_data(asset_id, as_of_date, self.PASS1_BARS)
        if len(ohlcv_data) < 30:
            logger.warning(f"Insufficient OHLCV data for {symbol}: {len(ohlcv_data)} bars")
            return None
        
        # Get active quant setups
        active_setups = self._get_active_setups(asset_id, as_of_date)
        logger.info(f"Found {len(active_setups)} active setups for {symbol}")
        
        # Build AI packet
        packet = self._build_ai_packet(
            asset_id=asset_id,
            symbol=symbol,
            name=name,
            asset_type=asset_type,
            as_of_date=as_of_date,
            ohlcv_data=ohlcv_data,
            active_setups=active_setups
        )
        
        input_hash = self._compute_input_hash(packet)
        
        # Call Gemini API
        try:
            prompt_with_schema = f"{self.system_prompt}\n\nYou MUST respond with valid JSON matching this schema:\n{json.dumps(self.output_schema, indent=2)}"
            
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[prompt_with_schema, json.dumps(packet)],
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=4000,
                    response_mime_type="application/json",
                )
            )
            ai_result = json.loads(response.text)
        except Exception as e:
            logger.error(f"Error calling Gemini API for {symbol}: {e}")
            return None
        
        # Get primary setup for post-processing
        primary_setup = packet["quant_setups"]["primary_setup"]
        
        # Apply attention elevation for high PF setups
        original_attention = ai_result.get("attention_level", "WATCH")
        ai_result["attention_level"] = self._apply_attention_elevation(
            original_attention, primary_setup
        )
        
        # Validate AI adjustments (soft guardrails)
        ai_result = self._validate_ai_adjustments(ai_result, primary_setup)
        
        # Build final result
        result = {
            "asset_id": str(asset_id),
            "symbol": symbol,
            "as_of_date": as_of_date,
            "prompt_version": self.PROMPT_VERSION,
            "ai_review_version": self.PROMPT_VERSION,
            "model": self.model_name,
            "input_hash": input_hash,
            
            # Quant setup integration
            "active_quant_setups": active_setups,
            "primary_setup": primary_setup["setup_name"] if primary_setup else None,
            "historical_profit_factor": primary_setup.get("historical_profit_factor") if primary_setup else None,
            "quant_entry_price": primary_setup.get("entry_price") if primary_setup else None,
            "quant_stop_loss": primary_setup.get("stop_loss") if primary_setup else None,
            "quant_target_price": primary_setup.get("target_price") if primary_setup else None,
            
            # AI outputs
            "setup_purity_score": ai_result.get("setup_purity_score"),
            "ai_direction_score": ai_result.get("ai_direction_score"),
            "attention_level": ai_result.get("attention_level"),
            "direction": ai_result.get("direction"),
            "setup_type": ai_result.get("setup_type"),
            "time_horizon": ai_result.get("time_horizon"),
            "confidence": ai_result.get("confidence"),
            "summary_text": ai_result.get("summary_text"),
            "why_now": ai_result.get("why_now"),
            "key_levels": ai_result.get("key_levels"),
            "entry_zone": ai_result.get("entry_zone"),
            "targets": ai_result.get("targets"),
            "risks_and_contradictions": ai_result.get("risks_and_contradictions"),
            "what_to_watch_next": ai_result.get("what_to_watch_next"),
            
            # AI price adjustments
            "ai_adjusted_entry": ai_result.get("ai_adjusted_entry"),
            "ai_adjusted_stop": ai_result.get("ai_adjusted_stop"),
            "ai_adjusted_target": ai_result.get("ai_adjusted_target"),
            
            # Metadata
            "adjustment_deviations": ai_result.get("adjustment_deviations", []),
            "created_at": datetime.utcnow().isoformat(),
        }
        
        # Save to database
        self._save_review(result)
        
        return result
    
    def _save_review(self, result: Dict[str, Any]) -> None:
        """Save AI review to database.
        
        Args:
            result: Analysis result dictionary
        """
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                # Build the record
                db_record = {
                    "asset_id": result["asset_id"],
                    "as_of_date": result["as_of_date"],
                    "prompt_version": result["prompt_version"],
                    "ai_review_version": result["ai_review_version"],
                    "model": result["model"],
                    "input_hash": result["input_hash"],
                    
                    # Quant setup fields
                    "active_quant_setups": json.dumps(result.get("active_quant_setups")),
                    "primary_setup": result.get("primary_setup"),
                    "setup_purity_score": result.get("setup_purity_score"),
                    "historical_profit_factor": result.get("historical_profit_factor"),
                    "quant_entry_price": result.get("quant_entry_price"),
                    "quant_stop_loss": result.get("quant_stop_loss"),
                    "quant_target_price": result.get("quant_target_price"),
                    "ai_adjusted_entry": result.get("ai_adjusted_entry"),
                    "ai_adjusted_stop": result.get("ai_adjusted_stop"),
                    "ai_adjusted_target": result.get("ai_adjusted_target"),
                    
                    # AI analysis fields
                    "ai_direction_score": result.get("ai_direction_score"),
                    "ai_attention_level": result.get("attention_level"),
                    "ai_setup_type": result.get("setup_type"),
                    "ai_time_horizon": result.get("time_horizon"),
                    "ai_confidence": result.get("confidence"),
                    "ai_summary_text": result.get("summary_text"),
                    "ai_key_levels": json.dumps(result.get("key_levels")),
                    "ai_entry": json.dumps(result.get("entry_zone")),
                    "ai_targets": json.dumps(result.get("targets")),
                    "ai_why_now": json.dumps(result.get("why_now")),
                    "ai_risks": json.dumps(result.get("risks_and_contradictions")),
                    "ai_what_to_watch_next": json.dumps(result.get("what_to_watch_next")),
                    
                    # Legacy compatibility
                    "attention_level": result.get("attention_level"),
                    "direction": result.get("direction"),
                    "setup_type": result.get("setup_type"),
                    "confidence": result.get("confidence"),
                    "summary_text": result.get("summary_text"),
                    
                    # Review JSON for backward compatibility
                    "review_json": json.dumps({
                        "ai_direction_score": result.get("ai_direction_score"),
                        "setup_purity_score": result.get("setup_purity_score"),
                        "attention_level": result.get("attention_level"),
                        "setup_type": result.get("setup_type"),
                        "time_horizon": result.get("time_horizon"),
                        "confidence": result.get("confidence"),
                        "summary_text": result.get("summary_text"),
                        "key_levels": result.get("key_levels"),
                        "entry_zone": result.get("entry_zone"),
                        "targets": result.get("targets"),
                        "why_now": result.get("why_now"),
                        "risks_and_contradictions": result.get("risks_and_contradictions"),
                        "what_to_watch_next": result.get("what_to_watch_next"),
                        "active_quant_setups": result.get("active_quant_setups"),
                        "primary_setup": result.get("primary_setup"),
                    }),
                }
                
                # Build INSERT ON CONFLICT statement
                columns = list(db_record.keys())
                placeholders = ', '.join(['%s'] * len(columns))
                column_names = ', '.join(columns)
                update_clause = ', '.join([
                    f"{col} = EXCLUDED.{col}" 
                    for col in columns 
                    if col not in ['asset_id', 'as_of_date', 'prompt_version']
                ])
                
                query = f"""
                INSERT INTO asset_ai_reviews ({column_names})
                VALUES ({placeholders})
                ON CONFLICT (asset_id, as_of_date, prompt_version)
                DO UPDATE SET {update_clause}, updated_at = NOW()
                """
                
                values = [db_record[col] for col in columns]
                cur.execute(query, values)
                conn.commit()
                
                logger.info(f"Saved AI review for {result['symbol']} with version {result['ai_review_version']}")
        finally:
            conn.close()
