#!/usr/bin/env python3
"""Test actual database connection and table access"""

import sys
sys.path.insert(0, '.')

from app import detect_sites, extract_db_info
from pathlib import Path
import pymysql

sites = detect_sites()
print("Testing database connections...\n")

for site in sites[:2]:
    if site.get('db_name'):
        print(f"Site: {site['domain']}")
        print(f"Database name from detect: {site['db_name']}")
        
        # Get fresh db info from wp-config
        wp_config = Path(site['public_html']) / 'wp-config.php'
        db_info = extract_db_info(wp_config)
        
        print(f"DB info from wp-config:")
        print(f"  db_name: {db_info.get('db_name')}")
        print(f"  db_user: {db_info.get('db_user')}")
        print(f"  db_host: {db_info.get('db_host')}")
        print(f"  db_password exists: {bool(db_info.get('db_password'))}")
        
        if not db_info.get('db_password'):
            print("  ✗ No password found!\n")
            continue
            
        # Try to connect
        try:
            connection = pymysql.connect(
                host=db_info.get('db_host', '127.0.0.1'),
                user=db_info['db_user'],
                password=db_info['db_password'],
                database=db_info['db_name'],
                cursorclass=pymysql.cursors.DictCursor
            )
            print("  ✓ Connection successful!")
            
            with connection:
                with connection.cursor() as cursor:
                    # Show tables
                    cursor.execute("SHOW TABLES")
                    tables = cursor.fetchall()
                    print(f"  Tables found: {len(tables)}")
                    if tables:
                        print(f"  First few tables: {[list(t.values())[0] for t in tables[:5]]}")
                    
                    # Get size
                    cursor.execute("""
                        SELECT 
                            table_schema,
                            ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb,
                            SUM(data_length + index_length) AS size_bytes
                        FROM information_schema.tables 
                        WHERE table_schema = %s
                        GROUP BY table_schema
                    """, (db_info['db_name'],))
                    result = cursor.fetchone()
                    print(f"  Size query result: {result}")
                    
        except pymysql.Error as e:
            print(f"  ✗ Connection error: {e}")
        except Exception as e:
            print(f"  ✗ Error: {e}")
            import traceback
            traceback.print_exc()
        
        print()