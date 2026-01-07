"""Database connection utilities for Stratos Engine."""

from contextlib import contextmanager
from typing import Any, Dict, Generator, List, Optional
import time

import psycopg2
import psycopg2.extras
import structlog

from .config import config

logger = structlog.get_logger()


class Database:
    """Database connection manager with reconnection support."""
    
    def __init__(self):
        self._conn = None
    
    def connect(self) -> None:
        """Establish database connection with keepalives for stability."""
        if self._conn is None or self._conn.closed:
            conn_string = config.supabase.connection_string
            self._conn = psycopg2.connect(
                conn_string,
                connect_timeout=10,
                keepalives=1,
                keepalives_idle=30,
                keepalives_interval=10,
                keepalives_count=5,
            )
            self._conn.autocommit = False
            logger.info("database_connected")
    
    def close(self) -> None:
        """Close database connection."""
        if self._conn and not self._conn.closed:
            try:
                self._conn.close()
                logger.info("database_disconnected")
            except Exception:
                pass
        self._conn = None
    
    def _safe_rollback(self) -> None:
        """Safely attempt rollback without raising on dead connections."""
        try:
            if self._conn and not self._conn.closed:
                self._conn.rollback()
        except Exception:
            pass
    
    def _force_reconnect(self) -> None:
        """Force close connection so next call reconnects."""
        try:
            if self._conn and not self._conn.closed:
                self._conn.close()
        except Exception:
            pass
        self._conn = None
    
    @contextmanager
    def cursor(self, dict_cursor: bool = True) -> Generator:
        """Get a database cursor with automatic cleanup and reconnection support."""
        self.connect()
        cursor_factory = psycopg2.extras.RealDictCursor if dict_cursor else None
        cursor = self._conn.cursor(cursor_factory=cursor_factory)
        try:
            yield cursor
            self._conn.commit()
        except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
            # Connection died - don't try rollback on a closed conn
            self._safe_rollback()
            # Force reconnect on next use
            self._force_reconnect()
            logger.error("database_disconnected_mid_query", error=str(e))
            raise
        except Exception as e:
            # Normal query error (SQL error etc.)
            self._safe_rollback()
            logger.error("database_error", error=str(e))
            raise
        finally:
            try:
                cursor.close()
            except Exception:
                pass
    
    def execute(self, query: str, params: Optional[tuple] = None) -> None:
        """Execute a query without returning results, with retry logic."""
        for attempt in range(3):
            try:
                with self.cursor() as cur:
                    cur.execute(query, params)
                return
            except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
                if attempt == 2:
                    raise
                logger.warning(f"Database execute retry {attempt + 1}/3", error=str(e))
                time.sleep(1.5 * (attempt + 1))
    
    def fetch_one(self, query: str, params: Optional[tuple] = None) -> Optional[Dict[str, Any]]:
        """Execute a query and return one result, with retry logic."""
        for attempt in range(3):
            try:
                with self.cursor() as cur:
                    cur.execute(query, params)
                    return cur.fetchone()
            except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
                if attempt == 2:
                    raise
                logger.warning(f"Database fetch_one retry {attempt + 1}/3", error=str(e))
                time.sleep(1.5 * (attempt + 1))
    
    def fetch_all(self, query: str, params: Optional[tuple] = None) -> List[Dict[str, Any]]:
        """Execute a query and return all results, with retry logic."""
        for attempt in range(3):
            try:
                with self.cursor() as cur:
                    cur.execute(query, params)
                    return cur.fetchall()
            except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
                if attempt == 2:
                    raise
                logger.warning(f"Database fetch_all retry {attempt + 1}/3", error=str(e))
                time.sleep(1.5 * (attempt + 1))
    
    def execute_batch(self, query: str, params_list: List[tuple]) -> None:
        """Execute a query with multiple parameter sets, with retry logic."""
        for attempt in range(3):
            try:
                with self.cursor() as cur:
                    psycopg2.extras.execute_batch(cur, query, params_list)
                return
            except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
                if attempt == 2:
                    raise
                logger.warning(f"Database execute_batch retry {attempt + 1}/3", error=str(e))
                time.sleep(1.5 * (attempt + 1))


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
