#!/usr/bin/env python3
"""
Fill Missing Asset Descriptions using OpenAI API

This script identifies assets with missing descriptions in the equity_metadata table
and uses OpenAI API (gpt-4.1-nano) to generate concise company descriptions.

Author: Manus AI
Date: 2026-01-13
"""

import os
import sys
import time
import logging
from typing import Dict, Any, Optional, List

# OpenAI client
from openai import OpenAI

# Database connection
import psycopg2
from psycopg2.extras import RealDictCursor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database configuration
DB_HOST = os.environ.get('DB_HOST', 'db.wfogbaipiqootjrsprde.supabase.co')
DB_PORT = os.environ.get('DB_PORT', '5432')
DB_NAME = os.environ.get('DB_NAME', 'postgres')
DB_USER = os.environ.get('DB_USER', 'postgres')
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'stratosbrainpostgresdbpw')

# Rate limiting
REQUEST_DELAY = 0.5  # 0.5 seconds between requests

# Initialize OpenAI client
client = OpenAI()


def get_db_connection():
    """Create and return a database connection."""
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )


def generate_description_with_openai(symbol: str, name: str, sector: str, industry: str) -> Optional[str]:
    """
    Generate a company description using OpenAI API.
    
    Args:
        symbol: Stock ticker symbol
        name: Company name
        sector: Company sector
        industry: Company industry
        
    Returns:
        Generated description or None if failed
    """
    prompt = f"""Generate a concise 2-3 sentence description for the following publicly traded company. 
Focus on what the company does, its main products/services, and its market position.
Do not include financial metrics or stock price information.
Keep the description factual and professional.

Company: {name}
Ticker: {symbol}
Sector: {sector}
Industry: {industry}

Provide only the description, no preamble or labels."""

    try:
        response = client.chat.completions.create(
            model="gpt-4.1-nano",
            messages=[
                {"role": "user", "content": prompt}
            ],
            max_tokens=200,
            temperature=0.3
        )
        
        text = response.choices[0].message.content
        if text:
            return text.strip()
        return None
            
    except Exception as e:
        logger.error(f"OpenAI API request failed for {symbol}: {e}")
        return None


def get_assets_missing_descriptions(conn, limit: int = 100, symbols: List[str] = None) -> List[Dict[str, Any]]:
    """
    Get assets that are missing descriptions.
    
    Args:
        conn: Database connection
        limit: Maximum number of assets to return
        symbols: Optional list of specific symbols to process
        
    Returns:
        List of assets with missing descriptions
    """
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        if symbols:
            cur.execute("""
                SELECT em.asset_id, em.symbol, em.name, em.sector, em.industry
                FROM equity_metadata em
                WHERE em.symbol = ANY(%s)
                ORDER BY em.asset_id
            """, (symbols,))
        else:
            cur.execute("""
                SELECT em.asset_id, em.symbol, em.name, em.sector, em.industry
                FROM equity_metadata em
                WHERE (em.description IS NULL OR em.description = 'None' OR em.description = '')
                AND em.name IS NOT NULL
                AND em.sector IS NOT NULL
                ORDER BY em.asset_id
                LIMIT %s
            """, (limit,))
        return cur.fetchall()


def update_description(conn, asset_id: int, description: str) -> bool:
    """
    Update the description for an asset.
    
    Args:
        conn: Database connection
        asset_id: The asset ID to update
        description: The new description
        
    Returns:
        True if successful, False otherwise
    """
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE equity_metadata
                SET description = %s, last_updated = NOW()
                WHERE asset_id = %s
            """, (description, asset_id))
            conn.commit()
            return True
    except Exception as e:
        logger.error(f"Failed to update description for asset_id {asset_id}: {e}")
        conn.rollback()
        return False


def main():
    """Main function to fill missing descriptions."""
    # Parse command line arguments
    limit = 100  # Default limit
    symbols = None
    
    if len(sys.argv) > 1:
        # Check if first argument is a number (limit) or symbols
        try:
            limit = int(sys.argv[1])
        except ValueError:
            # Treat arguments as symbols
            symbols = sys.argv[1:]
    
    if symbols:
        logger.info(f"Processing specific symbols: {symbols}")
    else:
        logger.info(f"Starting to fill missing descriptions (limit: {limit})")
    
    conn = get_db_connection()
    
    try:
        # Get assets missing descriptions
        assets = get_assets_missing_descriptions(conn, limit, symbols)
        logger.info(f"Found {len(assets)} assets to process")
        
        if not assets:
            logger.info("No assets need descriptions filled")
            return
        
        success_count = 0
        fail_count = 0
        
        for asset in assets:
            symbol = asset['symbol']
            name = asset['name'] or symbol
            sector = asset['sector'] or 'Unknown'
            industry = asset['industry'] or 'Unknown'
            
            logger.info(f"Generating description for {symbol} ({name})")
            
            description = generate_description_with_openai(symbol, name, sector, industry)
            
            if description:
                if update_description(conn, asset['asset_id'], description):
                    logger.info(f"✓ Updated description for {symbol}: {description[:100]}...")
                    success_count += 1
                else:
                    logger.error(f"✗ Failed to update database for {symbol}")
                    fail_count += 1
            else:
                logger.warning(f"✗ Failed to generate description for {symbol}")
                fail_count += 1
            
            # Rate limiting
            time.sleep(REQUEST_DELAY)
        
        logger.info(f"Completed: {success_count} succeeded, {fail_count} failed")
        
    finally:
        conn.close()


if __name__ == '__main__':
    main()
