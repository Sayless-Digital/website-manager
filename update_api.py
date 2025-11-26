#!/usr/bin/env python3
"""Script to update the /api/sites endpoint"""

import re

# Read the current file
with open('app.py', 'r') as f:
    content = f.read()

# Find and replace the get_sites function
old_function = '''@app.route('/api/sites')
def get_sites():
    """Get all detected sites"""
    global SITES
    SITES = detect_sites()
    return jsonify(SITES)'''

new_function = '''@app.route('/api/sites')
def get_sites():
    """Get all detected sites with enhanced information"""
    global SITES
    SITES = detect_sites()
    
    # Enhance each site with additional information
    enhanced_sites = []
    for site in SITES:
        enhanced_site = site.copy()
        
        # Add status based on apache_enabled
        enhanced_site['status'] = 'active' if site.get('apache_enabled', False) else 'inactive'
        
        # Add disk_usage in bytes (convert from MB)
        enhanced_site['disk_usage'] = int(site.get('size_mb', 0) * 1024 * 1024)
        
        # Get database information
        databases = []
        if site.get('db_name'):
            try:
                connection = get_db_connection(site['domain'])
                if connection:
                    with connection:
                        with connection.cursor() as cursor:
                            cursor.execute("SHOW TABLES")
                            tables = cursor.fetchall()
                            
                            cursor.execute("""
                                SELECT
                                    COALESCE(ROUND(SUM(data_length + index_length) / 1024 / 1024, 2), 0) AS size_mb
                                FROM information_schema.tables
                                WHERE table_schema = %s
                            """, (site['db_name'],))
                            size_result = cursor.fetchone()
                            db_size = size_result['size_mb'] if size_result and size_result['size_mb'] is not None else 0
                            
                            databases.append({
                                'name': site['db_name'],
                                'size_mb': db_size,
                                'table_count': len(tables)
                            })
            except:
                # If connection fails, still add database info but mark as unavailable
                databases.append({
                    'name': site['db_name'],
                    'size_mb': 0,
                    'table_count': 0
                })
        
        enhanced_site['databases'] = databases
        
        # Check for WordPress installation
        wp_config = Path(site['public_html']) / 'wp-config.php'
        version_file = Path(site['public_html']) / 'wp-includes' / 'version.php'
        
        enhanced_site['wordpress_detected'] = wp_config.exists()
        enhanced_site['wordpress_version'] = None
        
        if version_file.exists():
            try:
                with open(version_file, 'r') as f:
                    content = f.read()
                    match = re.search(r"\$wp_version\s*=\s*['\"]([^'\"]+)['\"]", content)
                    if match:
                        enhanced_site['wordpress_version'] = match.group(1)
            except:
                pass
        
        enhanced_sites.append(enhanced_site)
    
    return jsonify(enhanced_sites)'''

# Replace the function
if old_function in content:
    content = content.replace(old_function, new_function)
    
    # Write back
    with open('app.py', 'w') as f:
        f.write(content)
    
    print("✓ Successfully updated /api/sites endpoint")
else:
    print("✗ Could not find the target function to replace")
    print("The function may have already been updated or the file structure has changed")