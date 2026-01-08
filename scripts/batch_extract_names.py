#!/usr/bin/env python3
"""
Batch script to extract company names from equity_metadata.description
and update all assets in a single SQL statement.
"""

import sys
import json
import subprocess
import re

def parse_mcp_sql_result(output: str) -> list:
    """Parse the MCP SQL result output to extract JSON data"""
    try:
        if 'Tool execution result:' in output:
            result_start = output.find('Tool execution result:')
            result_part = output[result_start + len('Tool execution result:'):].strip()
            
            if result_part.startswith('"'):
                decoded = json.loads(result_part)
            else:
                decoded = result_part
        else:
            decoded = output
        
        match = re.search(r'\[.*\]', decoded, re.DOTALL)
        if match:
            json_str = match.group(0)
            return json.loads(json_str)
        
        if '[]' in output:
            return []
            
    except Exception as e:
        print(f"Error parsing MCP result: {e}")
    
    return []


def extract_company_name(description: str, symbol: str) -> str:
    """Extract company name from the description text."""
    if not description:
        return None
    
    patterns = [
        r'^(.+?(?:,?\s*(?:Inc\.|Corp\.|Corporation|Company|Ltd\.|LLC|LP|PLC|N\.V\.|S\.A\.|AG|SE|NV|plc)\.?))\s+(?:provides|is|designs|manufactures|develops|operates|engages|offers|focuses|specializes|delivers|serves|creates)',
        r'^(.+?)\s*\((?:Ticker:?\s*)?' + re.escape(symbol) + r'\)\s+(?:is|provides|designs)',
        r'^(.+?),?\s+headquartered',
        r'^(.+?),?\s+(?:a\s+)?(?:leading|premier|global|major|prominent)',
        r'^(.+?)\s+is\s+(?:a|an|the|one)',
        r'^(?:The\s+)?(.+?)\s+(?:provides|is|designs|manufactures|develops|operates|engages|offers|focuses)',
    ]
    
    for pattern in patterns:
        match = re.match(pattern, description, re.IGNORECASE)
        if match:
            name = match.group(1).strip()
            name = re.sub(r'\s+', ' ', name)
            name = name.strip('., ')
            if 3 < len(name) < 100:
                return name
    
    first_sentence = description.split('.')[0] if '.' in description else description
    verb_match = re.match(r'^(.+?)\s+(?:provides|is|designs|manufactures|develops|operates|engages|offers|focuses|specializes|delivers|serves|creates|holds|invests|seeks|manages|trades)', first_sentence, re.IGNORECASE)
    if verb_match:
        name = verb_match.group(1).strip()
        name = re.sub(r'\s+', ' ', name)
        name = name.strip('., ')
        if 3 < len(name) < 100:
            return name
    
    return None


def get_all_equities_with_descriptions() -> list:
    """Get all equities that have descriptions but no names - fetch all at once"""
    query = """
        SELECT a.asset_id, a.symbol, em.description 
        FROM assets a 
        JOIN equity_metadata em ON a.asset_id = em.asset_id 
        WHERE a.asset_type = 'equity' 
        AND (a.name IS NULL OR a.name = a.symbol)
        AND em.description IS NOT NULL 
        AND em.description != ''
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


def batch_update_names(updates: list) -> bool:
    """Update all names in a single SQL statement using CASE WHEN"""
    if not updates:
        return True
    
    # Build CASE WHEN statement
    case_parts = []
    asset_ids = []
    
    for asset_id, name in updates:
        escaped_name = name.replace("'", "''")
        case_parts.append(f"WHEN {asset_id} THEN '{escaped_name}'")
        asset_ids.append(str(asset_id))
    
    # Split into batches of 500 to avoid query size limits
    batch_size = 500
    total_batches = (len(updates) + batch_size - 1) // batch_size
    
    for batch_num in range(total_batches):
        start_idx = batch_num * batch_size
        end_idx = min((batch_num + 1) * batch_size, len(updates))
        
        batch_case_parts = case_parts[start_idx:end_idx]
        batch_asset_ids = asset_ids[start_idx:end_idx]
        
        query = f"""
            UPDATE assets 
            SET name = CASE asset_id 
                {' '.join(batch_case_parts)}
            END
            WHERE asset_id IN ({','.join(batch_asset_ids)})
        """
        
        input_json = json.dumps({
            'project_id': 'wfogbaipiqootjrsprde',
            'query': query
        })
        
        print(f"  Executing batch {batch_num + 1}/{total_batches} ({len(batch_case_parts)} updates)...")
        
        result = subprocess.run(
            ['manus-mcp-cli', 'tool', 'call', 'execute_sql', '--server', 'supabase', '--input', input_json],
            capture_output=True,
            text=True
        )
        
        if 'error' in result.stdout.lower() and 'throttler' not in result.stdout.lower():
            print(f"  Error in batch {batch_num + 1}: {result.stdout[:200]}")
            return False
    
    return True


def main():
    print("=" * 60)
    print("Batch Extracting Company Names from Descriptions")
    print("=" * 60)
    
    print("\n1. Fetching all equities with descriptions...")
    equities = get_all_equities_with_descriptions()
    print(f"   Found {len(equities)} equities to process")
    
    if not equities:
        print("No equities to process")
        return
    
    print("\n2. Extracting company names locally...")
    updates = []
    no_match = []
    
    for equity in equities:
        asset_id = equity['asset_id']
        symbol = equity['symbol']
        description = equity['description']
        
        name = extract_company_name(description, symbol)
        
        if name:
            updates.append((asset_id, name))
        else:
            no_match.append(symbol)
    
    print(f"   Extracted {len(updates)} names")
    print(f"   Could not extract {len(no_match)} names")
    
    if no_match and len(no_match) <= 20:
        print(f"   No match symbols: {', '.join(no_match)}")
    
    print("\n3. Batch updating database...")
    success = batch_update_names(updates)
    
    if success:
        print(f"\n✓ Successfully updated {len(updates)} equity names!")
    else:
        print("\n✗ Some updates failed")
    
    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()
