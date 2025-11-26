#!/usr/bin/env python3
"""Fix Apache site detection to handle both domain.conf and domain formats"""

import re

# Read the file
with open('app.py', 'r') as f:
    content = f.read()

# Find the detect_sites function and fix the apache_enabled check
old_code = '''            # Check if Apache config exists
            apache_config = APACHE_SITES_DIR / f"{domain}.conf"
            apache_enabled = (APACHE_SITES_ENABLED / f"{domain}.conf").exists()'''

new_code = '''            # Check if Apache config exists
            apache_config = APACHE_SITES_DIR / f"{domain}.conf"
            # Check both with and without .com/.net/.org etc extension
            domain_without_tld = domain.rsplit('.', 1)[0]  # e.g., aplusacademytt from aplusacademytt.com
            apache_enabled = (
                (APACHE_SITES_ENABLED / f"{domain}.conf").exists() or 
                (APACHE_SITES_ENABLED / f"{domain_without_tld}.conf").exists()
            )'''

if old_code in content:
    content = content.replace(old_code, new_code)
    with open('app.py', 'w') as f:
        f.write(content)
    print("✓ Successfully fixed Apache site detection")
else:
    print("✗ Could not find the code to replace. The function may have been modified.")