#!/usr/bin/env python3
"""Test script to reproduce the /api/sites error"""

import sys
import traceback

# Add the current directory to the path
sys.path.insert(0, '.')

# Import the app
from app import app, detect_sites, get_db_connection, get_database_size_from_fs, SITES
from pathlib import Path
import re

def test_get_sites():
    """Test the get_sites endpoint logic"""
    print("Testing site detection...")
    
    try:
        # Detect sites
        sites = detect_sites()
        print(f"Detected {len(sites)} sites")
        
        enhanced_sites = []
        for i, site in enumerate(sites):
            print(f"\nProcessing site {i+1}/{len(sites)}: {site.get('domain', 'unknown')}")
            
            try:
                enhanced_site = site.copy()
                
                # Add status based on apache_enabled
                enhanced_site['status'] = 'active' if site.get('apache_enabled', False) else 'inactive'
                print(f"  Status: {enhanced_site['status']}")
                
                # Add disk_usage in bytes (convert from MB)
                enhanced_site['disk_usage'] = int(site.get('size_mb', 0) * 1024 * 1024)
                print(f"  Disk usage: {enhanced_site['disk_usage']} bytes")
                
                # Get database information
                databases = []
                if site.get('db_name'):
                    print(f"  Checking database: {site['db_name']}")
                    db_size = 0
                    table_count = 0

                    try:
                        connection = get_db_connection(site['domain'])
                        if connection:
                            with connection:
                                with connection.cursor() as cursor:
                                    cursor.execute("SHOW TABLES")
                                    tables = cursor.fetchall()
                                    table_count = len(tables)
                                    print(f"    Table count: {table_count}")

                                    cursor.execute("""
                                        SELECT
                                            COALESCE(ROUND(SUM(data_length + index_length) / 1024 / 1024, 2), 0) AS size_mb
                                        FROM information_schema.tables
                                        WHERE table_schema = %s
                                    """, (site['db_name'],))
                                    size_result = cursor.fetchone()
                                    db_size = size_result['size_mb'] if size_result and size_result['size_mb'] is not None else 0
                                    print(f"    DB size: {db_size} MB")
                    except Exception as e:
                        print(f"    Database connection error: {e}")

                    if not db_size:
                        try:
                            db_size = get_database_size_from_fs(site['db_name'])
                            print(f"    DB size from FS: {db_size} MB")
                        except Exception as e:
                            print(f"    Error getting DB size from FS: {e}")

                    databases.append({
                        'name': site['db_name'],
                        'size_mb': db_size,
                        'table_count': table_count
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
                                print(f"  WordPress version: {enhanced_site['wordpress_version']}")
                    except Exception as e:
                        print(f"  Error reading WordPress version: {e}")
                
                enhanced_sites.append(enhanced_site)
                print(f"  ✓ Successfully processed {site['domain']}")
                
            except Exception as e:
                print(f"  ✗ Error processing site: {e}")
                traceback.print_exc()
                continue
        
        print(f"\n✓ Successfully enhanced {len(enhanced_sites)} sites")
        return enhanced_sites
        
    except Exception as e:
        print(f"\n✗ Critical error: {e}")
        traceback.print_exc()
        return None

if __name__ == '__main__':
    result = test_get_sites()
    if result is not None:
        print(f"\n=== SUCCESS ===")
        print(f"Total sites: {len(result)}")
    else:
        print(f"\n=== FAILED ===")
        sys.exit(1)