import os
import sys
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

from src.stratos_engine.db import Database

def main():
    db = Database()
    db.connect()
    
    target_date = "2026-01-02"
    
    print(f"--- AI Review Progress for {target_date} ---")
    
    query = """
    SELECT 
        COUNT(*) as total_reviews,
        COUNT(CASE WHEN scope LIKE 'inflections%%' THEN 1 END) as inflections,
        COUNT(CASE WHEN scope = 'trends' THEN 1 END) as trends,
        COUNT(CASE WHEN scope = 'risk' THEN 1 END) as risk
    FROM asset_ai_reviews
    WHERE as_of_date = %s
    """
    
    stats = db.fetch_one(query, (target_date,))
    print(f"Total Reviews: {stats['total_reviews']}")
    print(f"  - Inflections: {stats['inflections']}")
    print(f"  - Trends: {stats['trends']}")
    print(f"  - Risk: {stats['risk']}")
    
    # Check by asset type (requires join)
    query_by_type = """
    SELECT 
        a.asset_type,
        COUNT(*) as count
    FROM asset_ai_reviews r
    JOIN assets a ON r.asset_id::bigint = a.asset_id
    WHERE r.as_of_date = %s
    GROUP BY a.asset_type
    """
    
    print("\nBy Asset Type:")
    by_type = db.fetch_all(query_by_type, (target_date,))
    for row in by_type:
        print(f"  - {row['asset_type']}: {row['count']}")
        
    db.close()

if __name__ == "__main__":
    main()
