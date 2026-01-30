#!/usr/bin/env python3
"""
Calculate technical features for international stocks for the past year.
"""
import os
import sys
import subprocess
from datetime import datetime, timedelta

# Calculate dates for the past year
end_date = datetime.now()
start_date = end_date - timedelta(days=365)

# Get all trading days (approximate - every day for simplicity)
current_date = start_date
dates_to_process = []

while current_date <= end_date:
    # Skip weekends
    if current_date.weekday() < 5:  # Monday = 0, Friday = 4
        dates_to_process.append(current_date.strftime('%Y-%m-%d'))
    current_date += timedelta(days=1)

print(f"Processing {len(dates_to_process)} trading days from {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")

# Process each date
for i, date in enumerate(dates_to_process):
    print(f"\n[{i+1}/{len(dates_to_process)}] Processing {date}...")
    
    try:
        result = subprocess.run(
            ['python3', 'scripts/feature_calc_direct.py', 
             '--target-date', date, 
             '--asset-type', 'equity',
             '--workers', '4'],
            cwd='/home/ubuntu/stratos_brain',
            capture_output=True,
            text=True,
            timeout=300
        )
        
        # Print summary line from output
        for line in result.stdout.split('\n'):
            if 'Processed' in line or 'features' in line.lower():
                print(f"  {line}")
                
        if result.returncode != 0 and result.stderr:
            print(f"  Warning: {result.stderr[:200]}")
            
    except subprocess.TimeoutExpired:
        print(f"  Timeout on {date}, skipping...")
    except Exception as e:
        print(f"  Error: {e}")

print("\n" + "="*50)
print("Feature calculation complete!")
