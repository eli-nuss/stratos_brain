"""Configuration management for Stratos Engine."""

import os
from dataclasses import dataclass, field
from typing import Optional

from dotenv import load_dotenv

load_dotenv()


@dataclass
class SupabaseConfig:
    """Supabase connection configuration."""
    
    # Direct DATABASE_URL takes precedence (simpler for deployment)
    database_url: str = field(default_factory=lambda: os.getenv("DATABASE_URL", ""))
    
    # Individual components (fallback)
    url: str = field(default_factory=lambda: os.getenv("SUPABASE_URL", ""))
    service_key: str = field(default_factory=lambda: os.getenv("SUPABASE_SERVICE_KEY", ""))
    db_host: str = field(default_factory=lambda: os.getenv("SUPABASE_DB_HOST", ""))
    db_port: int = field(default_factory=lambda: int(os.getenv("SUPABASE_DB_PORT", "5432")))
    db_name: str = field(default_factory=lambda: os.getenv("SUPABASE_DB_NAME", "postgres"))
    db_user: str = field(default_factory=lambda: os.getenv("SUPABASE_DB_USER", "postgres"))
    db_password: str = field(default_factory=lambda: os.getenv("SUPABASE_DB_PASSWORD", ""))
    
    @property
    def connection_string(self) -> str:
        """Get PostgreSQL connection string. DATABASE_URL takes precedence."""
        if self.database_url:
            return self.database_url
        return (
            f"postgresql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}?sslmode=require"
        )


@dataclass
class OpenAIConfig:
    """OpenAI configuration for AI analysis stage."""
    
    api_key: str = field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    model: str = field(default_factory=lambda: os.getenv("OPENAI_MODEL", "gpt-4.1-mini"))
    base_url: Optional[str] = field(default_factory=lambda: os.getenv("OPENAI_BASE_URL"))


@dataclass
class WorkerConfig:
    """Worker process configuration."""
    
    poll_interval: int = field(
        default_factory=lambda: int(os.getenv("WORKER_POLL_INTERVAL", "5"))
    )
    visibility_timeout: int = field(
        default_factory=lambda: int(os.getenv("WORKER_VISIBILITY_TIMEOUT", "300"))
    )
    max_retries: int = field(
        default_factory=lambda: int(os.getenv("WORKER_MAX_RETRIES", "3"))
    )
    queue_name: str = "signal_engine_jobs"


@dataclass
class EngineConfig:
    """Engine runtime configuration."""
    
    enable_ai_stage: bool = field(
        default_factory=lambda: os.getenv("ENABLE_AI_STAGE", "true").lower() == "true"
    )
    ai_budget_per_run: int = field(
        default_factory=lambda: int(os.getenv("AI_BUDGET_PER_RUN", "50"))
    )
    template_version: str = "v3.2"
    feature_version: str = "v2"


@dataclass
class LogConfig:
    """Logging configuration."""
    
    level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))
    format: str = field(default_factory=lambda: os.getenv("LOG_FORMAT", "json"))


@dataclass
class Config:
    """Main configuration container."""
    
    supabase: SupabaseConfig = field(default_factory=SupabaseConfig)
    openai: OpenAIConfig = field(default_factory=OpenAIConfig)
    worker: WorkerConfig = field(default_factory=WorkerConfig)
    engine: EngineConfig = field(default_factory=EngineConfig)
    log: LogConfig = field(default_factory=LogConfig)


# Global config instance
config = Config()
