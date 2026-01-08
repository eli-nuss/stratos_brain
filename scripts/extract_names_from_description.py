#!/usr/bin/env python3
"""
Script to extract company names from equity_metadata.description
and update the assets.name field for equities.

The description field typically starts with the company name followed by
patterns like:
- "Company Name, Inc. provides..."
- "Company Name (Ticker: XYZ) is..."
- "Company Name is a..."
- "Company Name designs..."
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
    
    # Common patterns that indicate where the company name ends
    # The name typically appears at the start, followed by verbs or descriptors
    
    # Pattern 1: "Company Name, Inc." or "Company Name Inc." or "Company Name Corp."
    # followed by a verb or description
    patterns = [
        # Match: "Company Name, Inc. provides/is/designs/etc"
        r'^(.+?(?:,?\s*(?:Inc\.|Corp\.|Corporation|Company|Ltd\.|LLC|LP|PLC|N\.V\.|S\.A\.|AG|SE|NV|plc)\.?))\s+(?:provides|is|designs|manufactures|develops|operates|engages|offers|focuses|specializes|delivers|serves|creates)',
        
        # Match: "Company Name (Ticker: XYZ) is/provides"
        r'^(.+?)\s*\((?:Ticker:?\s*)?' + re.escape(symbol) + r'\)\s+(?:is|provides|designs)',
        
        # Match: "Company Name, headquartered in..."
        r'^(.+?),?\s+headquartered',
        
        # Match: "Company Name, a leading/premier/global..."
        r'^(.+?),?\s+(?:a\s+)?(?:leading|premier|global|major|prominent)',
        
        # Match: Simple "Company Name is a..."
        r'^(.+?)\s+is\s+(?:a|an|the|one)',
        
        # Match: "The Company Name" followed by verb
        r'^(?:The\s+)?(.+?)\s+(?:provides|is|designs|manufactures|develops|operates|engages|offers|focuses)',
    ]
    
    for pattern in patterns:
        match = re.match(pattern, description, re.IGNORECASE)
        if match:
            name = match.group(1).strip()
            # Clean up the name
            name = re.sub(r'\s+', ' ', name)  # Normalize whitespace
            name = name.strip('., ')
            
            # Validate: name should be reasonable length and not be the whole description
            if 3 < len(name) < 100:
                return name
    
    # Fallback: Try to extract first sentence and get the subject
    first_sentence = description.split('.')[0] if '.' in description else description
    
    # Try to find company name before common verbs
    verb_match = re.match(r'^(.+?)\s+(?:provides|is|designs|manufactures|develops|operates|engages|offers|focuses|specializes|delivers|serves|creates|holds|invests|seeks|manages|trades)', first_sentence, re.IGNORECASE)
    if verb_match:
        name = verb_match.group(1).strip()
        name = re.sub(r'\s+', ' ', name)
        name = name.strip('., ')
        if 3 < len(name) < 100:
            return name
    
    return None


def update_asset_name(asset_id: int, name: str) -> bool:
    """Update asset name in Supabase database"""
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
        return False
    
    return True


def get_equities_with_descriptions() -> list:
    """Get equities that have descriptions but no names"""
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


def main():
    print("=" * 60)
    print("Extracting Company Names from Descriptions")
    print("=" * 60)
    
    print("\nFetching equities with descriptions...")
    equities = get_equities_with_descriptions()
    print(f"Found {len(equities)} equities with descriptions but no names")
    
    if not equities:
        print("No equities to process")
        return
    
    success_count = 0
    fail_count = 0
    no_match_count = 0
    
    for equity in equities:
        asset_id = equity['asset_id']
        symbol = equity['symbol']
        description = equity['description']
        
        # Extract company name from description
        name = extract_company_name(description, symbol)
        
        if name:
            if update_asset_name(asset_id, name):
                print(f"✓ {symbol}: {name}")
                success_count += 1
            else:
                print(f"✗ {symbol}: Failed to update (name: {name})")
                fail_count += 1
        else:
            # Print first 80 chars of description for debugging
            desc_preview = description[:80] + "..." if len(description) > 80 else description
            print(f"? {symbol}: Could not extract name from: {desc_preview}")
            no_match_count += 1
    
    print("\n" + "=" * 60)
    print(f"RESULTS: {success_count} updated, {fail_count} failed, {no_match_count} no match")
    print("=" * 60)


if __name__ == "__main__":
    main()
