#!/usr/bin/env python3
"""
Script to populate missing company names for equity assets
Uses Yahoo Finance API to fetch company names and updates Supabase database
"""

import sys
import json
import subprocess
import time

# Add the Manus API client path
sys.path.append('/opt/.manus/.sandbox-runtime')
from data_api import ApiClient

def get_company_name(symbol: str) -> str:
    """Fetch company name from Yahoo Finance API"""
    client = ApiClient()
    
    try:
        # Try get_stock_chart first (faster, has longName in meta)
        response = client.call_api('YahooFinance/get_stock_chart', query={
            'symbol': symbol,
            'region': 'US',
            'interval': '1d',
            'range': '1d'
        })
        
        if response and 'chart' in response and 'result' in response['chart']:
            result = response['chart']['result'][0]
            meta = result.get('meta', {})
            long_name = meta.get('longName')
            if long_name:
                return long_name
            # Fallback to shortName
            short_name = meta.get('shortName')
            if short_name:
                return short_name
    except Exception as e:
        print(f"  Error fetching chart for {symbol}: {e}")
    
    try:
        # Fallback to get_stock_profile
        response = client.call_api('YahooFinance/get_stock_profile', query={
            'symbol': symbol,
            'region': 'US'
        })
        
        if response:
            quote_type = response.get('quoteType', {})
            long_name = quote_type.get('longName')
            if long_name:
                return long_name
            short_name = quote_type.get('shortName')
            if short_name:
                return short_name
    except Exception as e:
        print(f"  Error fetching profile for {symbol}: {e}")
    
    return None


def parse_mcp_sql_result(output: str) -> list:
    """Parse the MCP SQL result output to extract JSON data"""
    import re
    try:
        # The MCP output is a JSON-encoded string containing the actual result
        # First, we need to extract the JSON string from the output
        # The output format is: 'Tool execution result:\n"<json_encoded_string>"'
        
        # Find the JSON string in the output (starts with "Below is...")
        if 'Tool execution result:' in output:
            # Extract everything after "Tool execution result:"
            result_start = output.find('Tool execution result:')
            result_part = output[result_start + len('Tool execution result:'):].strip()
            
            # The result is a JSON-encoded string, so decode it first
            if result_part.startswith('"'):
                # It's a JSON string, decode it
                decoded = json.loads(result_part)
            else:
                decoded = result_part
        else:
            decoded = output
        
        # Now find the JSON array in the decoded string
        match = re.search(r'\[.*\]', decoded, re.DOTALL)
        if match:
            json_str = match.group(0)
            return json.loads(json_str)
        
        # Check for empty array
        if '[]' in output:
            return []
            
    except Exception as e:
        print(f"Error parsing MCP result: {e}")
        print(f"Output sample: {output[:300]}...")
    
    return []


def update_asset_name(asset_id: int, name: str) -> bool:
    """Update asset name in Supabase database"""
    # Escape single quotes in name
    escaped_name = name.replace("'", "''")
    
    query = f"UPDATE assets SET name = '{escaped_name}' WHERE asset_id = {asset_id}"
    
    input_json = json.dumps({
        'project_id': 'wfogbaipiqootjrsprde',
        'query': query
    })
    
    result = subprocess.run(
        ['manus-mcp-cli', 'tool', 'call', 'execute_sql', '--server', 'supabase', '--input', input_json],
        capture_output=True,
        text=True
    )
    
    if 'error' in result.stdout.lower():
        print(f"  Error updating {asset_id}: {result.stdout}")
        return False
    
    return True


def get_equities_missing_names(limit: int = None) -> list:
    """Get list of equities with missing names"""
    query = """
        SELECT asset_id, symbol 
        FROM assets 
        WHERE asset_type = 'equity' 
        AND (name IS NULL OR name = symbol)
        ORDER BY symbol
    """
    if limit:
        query += f" LIMIT {limit}"
    
    input_json = json.dumps({
        'project_id': 'wfogbaipiqootjrsprde',
        'query': query
    })
    
    result = subprocess.run(
        ['manus-mcp-cli', 'tool', 'call', 'execute_sql', '--server', 'supabase', '--input', input_json],
        capture_output=True,
        text=True
    )
    
    return parse_mcp_sql_result(result.stdout)


def get_watchlist_equities_missing_names() -> list:
    """Get list of watchlist equities with missing names (priority)"""
    query = """
        SELECT a.asset_id, a.symbol 
        FROM assets a 
        JOIN watchlist w ON a.asset_id = w.asset_id 
        WHERE a.asset_type = 'equity' 
        AND (a.name IS NULL OR a.name = a.symbol)
        ORDER BY a.symbol
    """
    
    input_json = json.dumps({
        'project_id': 'wfogbaipiqootjrsprde',
        'query': query
    })
    
    result = subprocess.run(
        ['manus-mcp-cli', 'tool', 'call', 'execute_sql', '--server', 'supabase', '--input', input_json],
        capture_output=True,
        text=True
    )
    
    return parse_mcp_sql_result(result.stdout)


def main():
    print("=" * 60)
    print("Populating Missing Equity Company Names")
    print("=" * 60)
    
    # First, handle watchlist equities (priority)
    print("\n1. Processing watchlist equities (priority)...")
    watchlist_equities = get_watchlist_equities_missing_names()
    print(f"   Found {len(watchlist_equities)} watchlist equities with missing names")
    
    success_count = 0
    fail_count = 0
    
    for equity in watchlist_equities:
        asset_id = equity['asset_id']
        symbol = equity['symbol']
        
        print(f"\n   Processing {symbol} (ID: {asset_id})...")
        
        name = get_company_name(symbol)
        if name:
            print(f"   Found: {name}")
            if update_asset_name(asset_id, name):
                print(f"   ✓ Updated successfully")
                success_count += 1
            else:
                print(f"   ✗ Failed to update")
                fail_count += 1
        else:
            print(f"   ✗ Could not find company name")
            fail_count += 1
        
        time.sleep(0.5)  # Rate limiting
    
    print(f"\n   Watchlist results: {success_count} updated, {fail_count} failed")
    
    # Then process remaining equities in batches
    print("\n2. Processing remaining equities...")
    
    # Process in batches of 100
    batch_size = 100
    total_processed = 0
    total_success = success_count
    total_fail = fail_count
    
    while True:
        equities = get_equities_missing_names(limit=batch_size)
        
        if not equities:
            print("   No more equities to process")
            break
        
        print(f"\n   Processing batch of {len(equities)} equities...")
        
        for equity in equities:
            asset_id = equity['asset_id']
            symbol = equity['symbol']
            
            # Skip symbols that look like warrants, preferred shares, etc.
            if '-' in symbol or len(symbol) > 5:
                print(f"   Skipping {symbol} (special security)")
                continue
            
            name = get_company_name(symbol)
            if name:
                if update_asset_name(asset_id, name):
                    print(f"   ✓ {symbol}: {name}")
                    total_success += 1
                else:
                    print(f"   ✗ {symbol}: Failed to update")
                    total_fail += 1
            else:
                print(f"   ✗ {symbol}: Not found")
                total_fail += 1
            
            total_processed += 1
            time.sleep(0.3)  # Rate limiting
            
            # Progress update every 50
            if total_processed % 50 == 0:
                print(f"\n   Progress: {total_processed} processed, {total_success} success, {total_fail} failed\n")
        
        # Safety limit for testing
        if total_processed >= 500:
            print("\n   Reached batch limit (500). Run again to continue.")
            break
    
    print("\n" + "=" * 60)
    print(f"FINAL RESULTS: {total_success} updated, {total_fail} failed")
    print("=" * 60)


if __name__ == "__main__":
    main()
