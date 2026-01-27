#!/usr/bin/env python3
"""
Migration Script: Add Indices, Commodities, and ETFs to Assets Table
====================================================================
This script migrates existing indices, commodities, and ETFs into the unified
assets table and copies their historical OHLCV data to the daily_bars table.

This enables these asset types to use the existing feature calculation,
setup detection, and AI analysis pipelines.

Usage:
    python scripts/migrate_indices_commodities_etfs.py

Tables affected:
    - assets: New rows added for indices, commodities, ETFs
    - daily_bars: Historical data copied from index_daily_bars, commodity_daily_bars, etf_daily_bars
"""

import os
import sys
import psycopg2
from psycopg2.extras import execute_values
import logging

# Configuration
DB_HOST = "db.wfogbaipiqootjrsprde.supabase.co"
DB_NAME = "postgres"
DB_USER = "postgres"
DB_PASSWORD = "stratosbrainpostgresdbpw"

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)


def get_db_connection():
    """Create database connection."""
    return psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )


def migrate_indices(conn):
    """Migrate indices from market_indices to assets table."""
    logger.info("Migrating indices...")
    
    with conn.cursor() as cur:
        # Check if indices already exist in assets
        cur.execute("SELECT COUNT(*) FROM assets WHERE asset_type = 'index'")
        existing = cur.fetchone()[0]
        if existing > 0:
            logger.info(f"  {existing} indices already exist in assets table, skipping...")
            return
        
        # Get indices from market_indices
        cur.execute("""
            SELECT symbol, name, exchange, country
            FROM market_indices
            WHERE is_active = true
        """)
        indices = cur.fetchall()
        logger.info(f"  Found {len(indices)} indices to migrate")
        
        # Insert into assets
        for symbol, name, exchange, country in indices:
            cur.execute("""
                INSERT INTO assets (symbol, name, asset_type, exchange, is_active, fmp_symbol)
                VALUES (%s, %s, 'index', %s, true, %s)
                ON CONFLICT (symbol, asset_type) DO NOTHING
            """, (symbol, name, exchange, symbol))
        
        conn.commit()
        logger.info(f"  Migrated {len(indices)} indices to assets table")


def migrate_commodities(conn):
    """Migrate commodities to assets table."""
    logger.info("Migrating commodities...")
    
    with conn.cursor() as cur:
        # Check if commodities already exist in assets
        cur.execute("SELECT COUNT(*) FROM assets WHERE asset_type = 'commodity'")
        existing = cur.fetchone()[0]
        if existing > 0:
            logger.info(f"  {existing} commodities already exist in assets table, skipping...")
            return
        
        # Get commodities
        cur.execute("""
            SELECT symbol, name, exchange
            FROM commodities
            WHERE is_active = true
        """)
        commodities = cur.fetchall()
        logger.info(f"  Found {len(commodities)} commodities to migrate")
        
        # Insert into assets
        for symbol, name, exchange in commodities:
            cur.execute("""
                INSERT INTO assets (symbol, name, asset_type, exchange, is_active, fmp_symbol)
                VALUES (%s, %s, 'commodity', %s, true, %s)
                ON CONFLICT (symbol, asset_type) DO NOTHING
            """, (symbol, name, exchange, symbol))
        
        conn.commit()
        logger.info(f"  Migrated {len(commodities)} commodities to assets table")


def migrate_etfs(conn):
    """Migrate ETFs to assets table."""
    logger.info("Migrating ETFs...")
    
    with conn.cursor() as cur:
        # Check if ETFs already exist in assets
        cur.execute("SELECT COUNT(*) FROM assets WHERE asset_type = 'etf'")
        existing = cur.fetchone()[0]
        if existing > 0:
            logger.info(f"  {existing} ETFs already exist in assets table, skipping...")
            return
        
        # Get ETFs
        cur.execute("""
            SELECT symbol, name, exchange
            FROM etf_assets
            WHERE is_active = true
        """)
        etfs = cur.fetchall()
        logger.info(f"  Found {len(etfs)} ETFs to migrate")
        
        # Insert into assets
        for symbol, name, exchange in etfs:
            cur.execute("""
                INSERT INTO assets (symbol, name, asset_type, exchange, is_active, fmp_symbol)
                VALUES (%s, %s, 'etf', %s, true, %s)
                ON CONFLICT (symbol, asset_type) DO NOTHING
            """, (symbol, name, exchange, symbol))
        
        conn.commit()
        logger.info(f"  Migrated {len(etfs)} ETFs to assets table")


def migrate_index_bars(conn):
    """Copy index_daily_bars to daily_bars."""
    logger.info("Migrating index daily bars...")
    
    with conn.cursor() as cur:
        # Get asset_id mapping for indices
        cur.execute("""
            SELECT a.asset_id, mi.id as old_id
            FROM assets a
            JOIN market_indices mi ON a.symbol = mi.symbol
            WHERE a.asset_type = 'index'
        """)
        mapping = {old_id: asset_id for asset_id, old_id in cur.fetchall()}
        
        if not mapping:
            logger.info("  No index mapping found, skipping...")
            return
        
        # Check if bars already exist
        sample_asset_id = list(mapping.values())[0]
        cur.execute("SELECT COUNT(*) FROM daily_bars WHERE asset_id = %s", (sample_asset_id,))
        if cur.fetchone()[0] > 0:
            logger.info("  Index bars already migrated, skipping...")
            return
        
        # Copy bars in batches
        total_copied = 0
        for old_id, asset_id in mapping.items():
            cur.execute("""
                INSERT INTO daily_bars (asset_id, date, open, high, low, close, volume, source)
                SELECT %s, date, open, high, low, close, volume, 'fmp'
                FROM index_daily_bars
                WHERE index_id = %s
                ON CONFLICT (asset_id, date) DO NOTHING
            """, (asset_id, old_id))
            total_copied += cur.rowcount
        
        conn.commit()
        logger.info(f"  Copied {total_copied} index bars to daily_bars")


def migrate_commodity_bars(conn):
    """Copy commodity_daily_bars to daily_bars."""
    logger.info("Migrating commodity daily bars...")
    
    with conn.cursor() as cur:
        # Get asset_id mapping for commodities
        cur.execute("""
            SELECT a.asset_id, c.id as old_id
            FROM assets a
            JOIN commodities c ON a.symbol = c.symbol
            WHERE a.asset_type = 'commodity'
        """)
        mapping = {old_id: asset_id for asset_id, old_id in cur.fetchall()}
        
        if not mapping:
            logger.info("  No commodity mapping found, skipping...")
            return
        
        # Check if bars already exist
        sample_asset_id = list(mapping.values())[0]
        cur.execute("SELECT COUNT(*) FROM daily_bars WHERE asset_id = %s", (sample_asset_id,))
        if cur.fetchone()[0] > 0:
            logger.info("  Commodity bars already migrated, skipping...")
            return
        
        # Copy bars in batches
        total_copied = 0
        for old_id, asset_id in mapping.items():
            cur.execute("""
                INSERT INTO daily_bars (asset_id, date, open, high, low, close, volume, source)
                SELECT %s, date, open, high, low, close, volume, 'fmp'
                FROM commodity_daily_bars
                WHERE commodity_id = %s
                ON CONFLICT (asset_id, date) DO NOTHING
            """, (asset_id, old_id))
            total_copied += cur.rowcount
        
        conn.commit()
        logger.info(f"  Copied {total_copied} commodity bars to daily_bars")


def migrate_etf_bars(conn):
    """Copy etf_daily_bars to daily_bars."""
    logger.info("Migrating ETF daily bars...")
    
    with conn.cursor() as cur:
        # Get asset_id mapping for ETFs
        cur.execute("""
            SELECT a.asset_id, e.id as old_id
            FROM assets a
            JOIN etf_assets e ON a.symbol = e.symbol
            WHERE a.asset_type = 'etf'
        """)
        mapping = {old_id: asset_id for asset_id, old_id in cur.fetchall()}
        
        if not mapping:
            logger.info("  No ETF mapping found, skipping...")
            return
        
        # Check if bars already exist
        sample_asset_id = list(mapping.values())[0]
        cur.execute("SELECT COUNT(*) FROM daily_bars WHERE asset_id = %s", (sample_asset_id,))
        if cur.fetchone()[0] > 0:
            logger.info("  ETF bars already migrated, skipping...")
            return
        
        # Copy bars in batches
        total_copied = 0
        for old_id, asset_id in mapping.items():
            cur.execute("""
                INSERT INTO daily_bars (asset_id, date, open, high, low, close, volume, source)
                SELECT %s, date, open, high, low, close, volume, 'fmp'
                FROM etf_daily_bars
                WHERE etf_id = %s
                ON CONFLICT (asset_id, date) DO NOTHING
            """, (asset_id, old_id))
            total_copied += cur.rowcount
        
        conn.commit()
        logger.info(f"  Copied {total_copied} ETF bars to daily_bars")


def main():
    logger.info("=" * 60)
    logger.info("Migration: Indices, Commodities, ETFs to Assets Table")
    logger.info("=" * 60)
    
    conn = get_db_connection()
    
    try:
        # Step 1: Migrate asset metadata
        migrate_indices(conn)
        migrate_commodities(conn)
        migrate_etfs(conn)
        
        # Step 2: Migrate historical OHLCV data
        migrate_index_bars(conn)
        migrate_commodity_bars(conn)
        migrate_etf_bars(conn)
        
        # Summary
        logger.info("=" * 60)
        logger.info("Summary")
        logger.info("=" * 60)
        
        with conn.cursor() as cur:
            for asset_type in ['index', 'commodity', 'etf']:
                cur.execute("SELECT COUNT(*) FROM assets WHERE asset_type = %s", (asset_type,))
                asset_count = cur.fetchone()[0]
                
                cur.execute("""
                    SELECT COUNT(*) FROM daily_bars db
                    JOIN assets a ON db.asset_id = a.asset_id
                    WHERE a.asset_type = %s
                """, (asset_type,))
                bar_count = cur.fetchone()[0]
                
                logger.info(f"  {asset_type}: {asset_count} assets, {bar_count} bars")
        
    finally:
        conn.close()
    
    logger.info("Migration complete!")


if __name__ == "__main__":
    main()
