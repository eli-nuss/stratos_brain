"""Database connection utilities for Stratos Engine."""

from contextlib import contextmanager
from typing import Any, Dict, Generator, List, Optional

import psycopg2
import psycopg2.extras
import structlog

from .config import config

logger = structlog.get_logger()


class Database:
    """Database connection manager."""
    
    def __init__(self):
        self._conn = None
    
    def connect(self) -> None:
        """Establish database connection."""
        if self._conn is None or self._conn.closed:
            self._conn = psycopg2.connect(
                host=config.supabase.db_host,
                port=config.supabase.db_port,
                dbname=config.supabase.db_name,
                user=config.supabase.db_user,
                password=config.supabase.db_password,
                sslmode="require",
            )
            self._conn.autocommit = False
            logger.info("database_connected", host=config.supabase.db_host)
    
    def close(self) -> None:
        """Close database connection."""
        if self._conn and not self._conn.closed:
            self._conn.close()
            logger.info("database_disconnected")
    
    @contextmanager
    def cursor(self, dict_cursor: bool = True) -> Generator:
        """Get a database cursor with automatic cleanup."""
        self.connect()
        cursor_factory = psycopg2.extras.RealDictCursor if dict_cursor else None
        cursor = self._conn.cursor(cursor_factory=cursor_factory)
        try:
            yield cursor
            self._conn.commit()
        except Exception as e:
            self._conn.rollback()
            logger.error("database_error", error=str(e))
            raise
        finally:
            cursor.close()
    
    def execute(self, query: str, params: Optional[tuple] = None) -> None:
        """Execute a query without returning results."""
        with self.cursor() as cur:
            cur.execute(query, params)
    
    def fetch_one(self, query: str, params: Optional[tuple] = None) -> Optional[Dict[str, Any]]:
        """Execute a query and return one result."""
        with self.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchone()
    
    def fetch_all(self, query: str, params: Optional[tuple] = None) -> List[Dict[str, Any]]:
        """Execute a query and return all results."""
        with self.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchall()
    
    def execute_batch(self, query: str, params_list: List[tuple]) -> None:
        """Execute a query with multiple parameter sets."""
        with self.cursor() as cur:
            psycopg2.extras.execute_batch(cur, query, params_list)


# Queue operations using pgmq
class Queue:
    """pgmq queue operations."""
    
    def __init__(self, db: Database, queue_name: str = "signal_engine_jobs"):
        self.db = db
        self.queue_name = queue_name
    
    def read(self, visibility_timeout: int = 300, limit: int = 1) -> List[Dict[str, Any]]:
        """Read messages from the queue."""
        query = f"""
        SELECT * FROM pgmq.read(
            queue_name := %s,
            vt := %s,
            qty := %s
        )
        """
        return self.db.fetch_all(query, (self.queue_name, visibility_timeout, limit))
    
    def send(self, message: Dict[str, Any]) -> int:
        """Send a message to the queue."""
        import json
        query = f"SELECT pgmq.send(%s, %s::jsonb)"
        result = self.db.fetch_one(query, (self.queue_name, json.dumps(message)))
        return result["send"] if result else 0
    
    def archive(self, msg_id: int) -> bool:
        """Archive (acknowledge) a message."""
        query = f"SELECT pgmq.archive(%s, %s)"
        result = self.db.fetch_one(query, (self.queue_name, msg_id))
        return result["archive"] if result else False
    
    def delete(self, msg_id: int) -> bool:
        """Delete a message from the queue."""
        query = f"SELECT pgmq.delete(%s, %s)"
        result = self.db.fetch_one(query, (self.queue_name, msg_id))
        return result["delete"] if result else False


# Global database instance
db = Database()
queue = Queue(db, config.worker.queue_name)
