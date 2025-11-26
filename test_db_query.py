#!/usr/bin/env python3
"""Test database size query to see actual values"""

import sys
sys.path.insert(0, '.')

from app import detect_sites, get_db_connection
import pymysql

sites = detect_sites()
print("Testing database size queries...\n")

for site in sites[:2]:  # Check first 2 sites
    if site.get('db_name'):
        print(f"Site: {site['domain']}")
        print(f"Database: {site['db_name']}")
        
        try:
            connection = get_db_connection(site['domain'])
            if connection:
                with connection:
                    with connection.cursor() as cursor:
                        # Check if tables exist
                        cursor.execute("SHOW TABLES")
                        tables = cursor.fetchall()
                        print(f"  Tables found: {len(tables)}")
                        
                        # Run query WITHOUT COALESCE to see raw result
                        cursor.execute("""
                            SELECT 
                                ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb,
                                SUM(data_length + index_length) AS size_bytes
                            FROM information_schema.tables 
                            WHERE table_schema = %s
                        """, (site['db_name'],))
                        result = cursor.fetchone()
                        print(f"  Raw SQL result: {result}")
                        print(f"  size_mb value: {result['size_mb']}")
                        print(f"  size_bytes value: {result['size_bytes']}")
                        
                        # Check size in KB
                        if result['size_bytes']:
                            kb_size = round(result['size_bytes'] / 1024, 2)
                            print(f"  Size in KB: {kb_size}")
                        
                        # Now with COALESCE
                        cursor.execute("""
                            SELECT 
                                COALESCE(ROUND(SUM(data_length + index_length) / 1024 / 1024, 2), 0) AS size_mb
                            FROM information_schema.tables 
                            WHERE table_schema = %s
                        """, (site['db_name'],))
                        result2 = cursor.fetchone()
                        print(f"  With COALESCE: {result2['size_mb']} MB")
            else:
                print(f"  ✗ Could not connect to database")
        except Exception as e:
            print(f"  ✗ Error: {e}")
            import traceback
            traceback.print_exc()
        
        print()

print("Test complete!")