#!/usr/bin/env python3
"""Fix database size queries to use COALESCE"""

import re

# Read the current file
with open('app.py', 'r') as f:
    content = f.read()

# Pattern 1: Find queries without COALESCE
pattern1 = r'ROUND\(SUM\(data_length \+ index_length\) / 1024 / 1024, 2\) AS size_mb'
replacement1 = r'COALESCE(ROUND(SUM(data_length + index_length) / 1024 / 1024, 2), 0) AS size_mb'

# Pattern 2: Fix the handling of the result
pattern2 = r"db_size = size_result\['size_mb'\] or 0 if size_result else 0"
replacement2 = r"db_size = size_result['size_mb'] if size_result and size_result['size_mb'] is not None else 0"

pattern3 = r"db_size = size_result\['size_mb'\] if size_result else 0"
replacement3 = r"db_size = size_result['size_mb'] if size_result and size_result['size_mb'] is not None else 0"

# Apply replacements
original_content = content
content = re.sub(pattern1, replacement1, content)
content = re.sub(pattern2, replacement2, content)
content = re.sub(pattern3, replacement3, content)

if content != original_content:
    # Write back
    with open('app.py', 'w') as f:
        f.write(content)
    
    print("✓ Successfully fixed database size queries in app.py")
    print(f"  - Added COALESCE to handle NULL values")
    print(f"  - Fixed result handling to check for None")
else:
    print("✗ No changes needed - queries may already be fixed")