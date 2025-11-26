#!/usr/bin/env python3
"""Verify database size is being retrieved correctly"""

import sys
sys.path.insert(0, '.')

from app import detect_sites, get_db_connection
import pymysql

sites = detect_sites()
print("Checking database sizes...\n")

for site in sites[:3]:  # Check first 3 sites
    if site.get('db_name'):
        print(f"Site: {site['domain']}")
        print(f"Database: {site['db_name']}")
        
        try:
            connection = get_db_connection(site['domain'])
            if connection:
                with connection:
                    with connection.cursor() as cursor:
                        # Run the fixed query
                        cursor.execute("""
                            SELECT 
                                COALESCE(ROUND(SUM(data_length + index_length) / 1024 / 1024, 2), 0) AS size_mb
                            FROM information_schema.tables 
                            WHERE table_schema = %s
                        """, (site['db_name'],))
                        size_result = cursor.fetchone()
                        db_size = size_result['size_mb'] if size_result and size_result['size_mb'] is not None else 0
                        
                        print(f"  ✓ Database size: {db_size} MB")
                        print(f"  Result type: {type(db_size)}")
                        print(f"  Result value is None: {db_size is None}")
                        print(f"  Result value == 0: {db_size == 0}")
            else:
                print(f"  ✗ Could not connect to database")
        except Exception as e:
            print(f"  ✗ Error: {e}")
        
        print()

print("Database size fix verification complete!")