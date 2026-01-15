#!/usr/bin/env python3
"""
Insert ETFs and indices into the database.
"""

import json
import psycopg2
from psycopg2.extras import execute_values

DB_URL = "postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres"


def main():
    # Load the verified ETFs and indices
    with open("/home/ubuntu/stratos_brain/scripts/etfs_indices_verified.json") as f:
        data = json.load(f)
    
    etfs = data["etfs"]
    indices = data["indices"]
    
    print(f"Inserting {len(etfs)} ETFs and {len(indices)} indices...")
    
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    # Insert ETFs
    etf_values = [
        (
            etf["symbol"],
            etf["name"],
            etf.get("asset_class"),
            etf.get("geography"),
            etf.get("category"),
            etf.get("issuer"),
            None,  # expense_ratio
            True,  # is_active
            "fmp"  # data_vendor
        )
        for etf in etfs
    ]
    
    etf_query = """
        INSERT INTO etf_assets (symbol, name, asset_class, geography, category, issuer, expense_ratio, is_active, data_vendor)
        VALUES %s
        ON CONFLICT (symbol) DO UPDATE SET
            name = EXCLUDED.name,
            asset_class = EXCLUDED.asset_class,
            geography = EXCLUDED.geography,
            category = EXCLUDED.category,
            issuer = EXCLUDED.issuer,
            updated_at = NOW()
        RETURNING etf_id, symbol
    """
    
    result = execute_values(cur, etf_query, etf_values, fetch=True)
    print(f"  Inserted/updated {len(result)} ETFs")
    
    # Insert Indices
    index_values = [
        (
            idx["symbol"],
            idx["name"],
            idx.get("region"),
            idx.get("country"),
            idx.get("index_type"),
            True,  # is_active
            "fmp"  # data_vendor
        )
        for idx in indices
    ]
    
    index_query = """
        INSERT INTO market_indices (symbol, name, region, country, index_type, is_active, data_vendor)
        VALUES %s
        ON CONFLICT (symbol) DO UPDATE SET
            name = EXCLUDED.name,
            region = EXCLUDED.region,
            country = EXCLUDED.country,
            index_type = EXCLUDED.index_type,
            updated_at = NOW()
        RETURNING index_id, symbol
    """
    
    result = execute_values(cur, index_query, index_values, fetch=True)
    print(f"  Inserted/updated {len(result)} indices")
    
    conn.commit()
    
    # Verify counts
    cur.execute("SELECT COUNT(*) FROM etf_assets")
    etf_count = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(*) FROM market_indices")
    index_count = cur.fetchone()[0]
    
    print(f"\nDatabase now contains:")
    print(f"  ETFs: {etf_count}")
    print(f"  Indices: {index_count}")
    
    cur.close()
    conn.close()
    
    print("\nDone!")


if __name__ == "__main__":
    main()
