#!/usr/bin/env python3
"""Fix Decimal to float conversion for database sizes"""

import re

# Read the current file
with open('app.py', 'r') as f:
    content = f.read()

# Pattern: db_size = size_result['size_mb'] if size_result and size_result['size_mb'] is not None else 0
# Replace with: db_size = float(size_result['size_mb']) if size_result and size_result['size_mb'] is not None else 0

pattern1 = r"db_size = size_result\['size_mb'\] if size_result and size_result\['size_mb'\] is not None else 0"
replacement1 = r"db_size = float(size_result['size_mb']) if size_result and size_result['size_mb'] is not None else 0"

original_content = content
content = re.sub(pattern1, replacement1, content)

if content != original_content:
    # Write back
    with open('app.py', 'w') as f:
        f.write(content)
    
    print("✓ Successfully fixed Decimal to float conversion in app.py")
    print(f"  - Converted db_size results to float")
else:
    print("✗ No changes needed - conversions may already be fixed")