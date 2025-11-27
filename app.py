#!/usr/bin/env python3
"""
Local Website Manager - Flask Backend
A cPanel/hPanel-like interface for managing local WordPress sites
"""

import os
import json
import subprocess
import re
import shutil
import gzip
import psutil
import threading
from pathlib import Path
from flask import Flask, jsonify, request, send_file, Response
from flask_cors import CORS
import pymysql
from datetime import datetime, timedelta
import time
from werkzeug.utils import secure_filename
import mimetypes
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
try:
    import yaml
    YAML_AVAILABLE = True
except ImportError:
    YAML_AVAILABLE = False
try:
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    SMTP_AVAILABLE = True
except ImportError:
    SMTP_AVAILABLE = False

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]}})
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size

# Configuration
BASE_DIR = Path("/home/mercury/Documents/Storage/Websites")
APACHE_LOG_DIR = Path("/var/log/apache2")
APACHE_SITES_DIR = Path("/etc/apache2/sites-available")
APACHE_SITES_ENABLED = Path("/etc/apache2/sites-enabled")

# Backup status tracking (in-memory)
backup_status = {}
backup_lock = threading.Lock()

# Known services
SERVICES = {
    'apache2': 'Apache Web Server',
    'mysql': 'MySQL Database Server',
    'cloudflared': 'Cloudflare Tunnel',
    'postfix': 'Postfix Mail Server',
    'dovecot': 'Dovecot IMAP/POP3 Server'
}

# Cloudflare Tunnel config paths
CLOUDFLARE_TUNNEL_CONFIG = Path("/etc/cloudflared/config.yml")
CLOUDFLARE_TUNNEL_CONFIG_USER = Path.home() / ".cloudflared" / "config.yml"

# Cloudflare and Email config paths
CLOUDFLARE_CONFIG_FILE = BASE_DIR.parent / 'cloudflare_config.json'
EMAIL_CONFIG_FILE = BASE_DIR.parent / 'email_config.json'
POSTFIX_MAIN_CF = Path("/etc/postfix/main.cf")
POSTFIX_MASTER_CF = Path("/etc/postfix/master.cf")
DOVECOT_CONF = Path("/etc/dovecot/dovecot.conf")

# Site configuration (will be auto-detected)
SITES = []

def detect_sites():
    """Auto-detect all WordPress sites from directory structure"""
    sites = []
    if not BASE_DIR.exists():
        return sites
    
    for site_dir in BASE_DIR.iterdir():
        if site_dir.is_dir() and (site_dir / "public_html" / "wp-config.php").exists():
            domain = site_dir.name
            wp_config = site_dir / "public_html" / "wp-config.php"
            
            # Extract database info from wp-config.php
            db_info = extract_db_info(wp_config)
            
            # Check if Apache config exists
            apache_config = APACHE_SITES_DIR / f"{domain}.conf"
            # Check both with and without .com/.net/.org etc extension
            domain_without_tld = domain.rsplit('.', 1)[0]  # e.g., aplusacademytt from aplusacademytt.com
            apache_enabled = (
                (APACHE_SITES_ENABLED / f"{domain}.conf").exists() or 
                (APACHE_SITES_ENABLED / f"{domain_without_tld}.conf").exists()
            )
            
            # Get directory size
            site_size = get_directory_size(site_dir)
            
            sites.append({
                'domain': domain,
                'path': str(site_dir),
                'public_html': str(site_dir / "public_html"),
                'apache_config': str(apache_config) if apache_config.exists() else None,
                'apache_enabled': apache_enabled,
                'db_name': db_info.get('db_name'),
                'db_user': db_info.get('db_user'),
                'db_host': db_info.get('db_host', '127.0.0.1'),
                'error_log': str(APACHE_LOG_DIR / f"{domain}_error.log"),
                'access_log': str(APACHE_LOG_DIR / f"{domain}_access.log"),
                'size_mb': site_size,
            })
    
    return sorted(sites, key=lambda x: x['domain'])

def get_directory_size(path):
    """Get directory size in MB"""
    try:
        total = 0
        for dirpath, dirnames, filenames in os.walk(path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                if os.path.exists(fp):
                    total += os.path.getsize(fp)
        return round(total / (1024 * 1024), 2)
    except:
        return 0

def extract_db_info(wp_config_path):
    """Extract database information from wp-config.php"""
    db_info = {}
    try:
        with open(wp_config_path, 'r') as f:
            content = f.read()
            
        # Extract DB_NAME
        match = re.search(r"define\s*\(\s*['\"]DB_NAME['\"]\s*,\s*['\"]([^'\"]+)['\"]", content)
        if match:
            db_info['db_name'] = match.group(1)
        
        # Extract DB_USER
        match = re.search(r"define\s*\(\s*['\"]DB_USER['\"]\s*,\s*['\"]([^'\"]+)['\"]", content)
        if match:
            db_info['db_user'] = match.group(1)
        
        # Extract DB_PASSWORD
        match = re.search(r"define\s*\(\s*['\"]DB_PASSWORD['\"]\s*,\s*['\"]([^'\"]+)['\"]", content)
        if match:
            db_info['db_password'] = match.group(1)
        
        # Extract DB_HOST
        match = re.search(r"define\s*\(\s*['\"]DB_HOST['\"]\s*,\s*['\"]([^'\"]+)['\"]", content)
        if match:
            db_info['db_host'] = match.group(1)
        
    except Exception as e:
        print(f"Error reading wp-config.php: {e}")
    
    return db_info

def get_db_connection(domain):
    """Get database connection for a site"""
    site = next((s for s in SITES if s['domain'] == domain), None)
    if not site or not site.get('db_name'):
        return None
    
    wp_config = Path(site['public_html']) / 'wp-config.php'
    db_info = extract_db_info(wp_config)
    
    if not db_info.get('db_password'):
        return None
    
    try:
        return pymysql.connect(
            host=db_info.get('db_host', '127.0.0.1'),
            user=db_info['db_user'],
            password=db_info['db_password'],
            database=db_info['db_name'],
            cursorclass=pymysql.cursors.DictCursor
        )
    except:
        return None

def run_sudo_command(cmd, timeout=30):
    """Run a command with sudo"""
    try:
        # Use shell=True for complex commands with pipes, redirects, etc.
        if '&&' in cmd or '|' in cmd or '>' in cmd or '<' in cmd:
            result = subprocess.run(
                ['sudo', 'sh', '-c', cmd],
                capture_output=True,
                text=True,
                timeout=timeout
            )
        else:
            result = subprocess.run(
                ['sudo'] + cmd.split(),
                capture_output=True,
                text=True,
                timeout=timeout
            )
        return {
            'success': result.returncode == 0,
            'stdout': result.stdout,
            'stderr': result.stderr,
            'returncode': result.returncode
        }
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'stdout': '',
            'stderr': 'Command timed out',
            'returncode': -1
        }
    except Exception as e:
        return {
            'success': False,
            'stdout': '',
            'stderr': str(e),
            'returncode': -1
        }

def get_service_status(service_name):
    """Get systemd service status"""
    try:
        result = run_sudo_command(f'systemctl is-active {service_name}')
        stdout = result.get('stdout', '').strip() if result.get('success') else ''
        is_active = stdout == 'active'
        
        result = run_sudo_command(f'systemctl is-enabled {service_name}')
        stdout = result.get('stdout', '').strip() if result.get('success') else ''
        is_enabled = stdout == 'enabled'
        
        return {
            'active': is_active,
            'enabled': is_enabled,
            'status': 'running' if is_active else 'stopped'
        }
    except Exception as e:
        print(f"Error in get_service_status for {service_name}: {e}")
        import traceback
        traceback.print_exc()
        # Return default status on error
        return {
            'active': False,
            'enabled': False,
            'status': 'stopped'
    }

# ==================== ROUTES ====================

@app.route('/')
def index():
    """Main dashboard"""
    return render_template('index.html')

@app.route('/site/<domain>')
def site_page(domain):
    """Individual site management page"""
    return render_template('site.html', domain=domain)

@app.route('/api/sites')
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
                                    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
                                FROM information_schema.tables
                                WHERE table_schema = %s
                            """, (site['db_name'],))
                            size_result = cursor.fetchone()
                            db_size = size_result['size_mb'] if size_result else 0
                            
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
    
    return jsonify(enhanced_sites)

@app.route('/api/services')
def get_services():
    """Get status of all services"""
    services_status = {}
    try:
        for service, name in SERVICES.items():
            try:
                status = get_service_status(service)
                services_status[service] = {
                    'name': name,
                    **status
                }
            except Exception as e:
                # If status check fails, still include the service with error state
                print(f"Error getting status for {service}: {e}")
                services_status[service] = {
                    'name': name,
                    'active': False,
                    'enabled': False,
                    'status': 'stopped'
                }
    except Exception as e:
        print(f"Error in get_services endpoint: {e}")
        import traceback
        traceback.print_exc()
        # Return empty dict with 200 status rather than crashing
        return jsonify({})
    
    return jsonify(services_status)

@app.route('/api/service/<service_name>/<action>', methods=['POST'])
def control_service(service_name, action):
    """Control a service (start, stop, restart)"""
    if service_name not in SERVICES:
        return jsonify({'error': 'Unknown service'}), 400
    
    if action not in ['start', 'stop', 'restart', 'enable', 'disable']:
        return jsonify({'error': 'Invalid action'}), 400
    
    cmd = f'systemctl {action} {service_name}'
    result = run_sudo_command(cmd)
    
    if result['success']:
        return jsonify({
            'success': True,
            'message': f'Service {service_name} {action}ed successfully',
            'status': get_service_status(service_name)
        })
    else:
        return jsonify({
            'success': False,
            'error': result['stderr'] or result['stdout']
        }), 500

@app.route('/api/site/<domain>/status')
def get_site_status(domain):
    """Get status of a specific site"""
    site = next((s for s in SITES if s['domain'] == domain), None)
    if not site:
        return jsonify({'error': 'Site not found'}), 404
    
    apache_enabled = site.get('apache_enabled', False)
    
    local_accessible = False
    try:
        result = subprocess.run(
            ['curl', '-I', '-H', f'Host: {domain}', 'http://127.0.0.1/'],
            capture_output=True,
            timeout=5
        )
        local_accessible = result.returncode == 0 and ('200' in result.stdout.decode() or '301' in result.stdout.decode())
    except:
        pass
    
    public_accessible = False
    try:
        result = subprocess.run(
            ['curl', '-I', f'https://{domain}'],
            capture_output=True,
            timeout=10
        )
        public_accessible = result.returncode == 0 and ('200' in result.stdout.decode() or '301' in result.stdout.decode() or '302' in result.stdout.decode())
    except:
        pass
    
    return jsonify({
        'domain': domain,
        'apache_enabled': apache_enabled,
        'local_accessible': local_accessible,
        'public_accessible': public_accessible,
        'path': site['path']
    })

# ==================== FILE MANAGEMENT ====================

@app.route('/api/site/<domain>/files')
def list_files(domain):
    """List files in a directory"""
    site = next((s for s in SITES if s['domain'] == domain), None)
    if not site:
        return jsonify({'error': 'Site not found'}), 404
    
    path = request.args.get('path', site['public_html'])
    base_path = Path(site['public_html'])
    target_path = base_path / path.replace(site['public_html'], '').lstrip('/')
    
    # Security: ensure path is within site directory
    try:
        target_path = target_path.resolve()
        if not str(target_path).startswith(str(base_path.resolve())):
            return jsonify({'error': 'Access denied'}), 403
    except:
        return jsonify({'error': 'Invalid path'}), 400
    
    if not target_path.exists():
        return jsonify({'error': 'Path not found'}), 404
    
    files = []
    try:
        for item in target_path.iterdir():
            try:
                stat = item.stat()
                files.append({
                    'name': item.name,
                    'path': str(item.relative_to(base_path)),
                    'type': 'directory' if item.is_dir() else 'file',
                    'size': stat.st_size if item.is_file() else 0,
                    'size_human': format_size(stat.st_size) if item.is_file() else '-',
                    'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    'permissions': oct(stat.st_mode)[-3:]
                })
            except:
                pass
        
        files.sort(key=lambda x: (x['type'] == 'file', x['name'].lower()))
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
    return jsonify({
        'path': str(target_path.relative_to(base_path)),
        'files': files
    })

def format_size(size):
    """Format file size"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024.0:
            return f"{size:.2f} {unit}"
        size /= 1024.0
    return f"{size:.2f} TB"

@app.route('/api/site/<domain>/files/read')
def read_file(domain):
    """Read file contents"""
    site = next((s for s in SITES if s['domain'] == domain), None)
    if not site:
        return jsonify({'error': 'Site not found'}), 404
    
    file_path = request.args.get('path')
    if not file_path:
        return jsonify({'error': 'Path required'}), 400
    
    base_path = Path(site['public_html'])
    target_path = base_path / file_path.lstrip('/')
    
    # Security check
    try:
        target_path = target_path.resolve()
        if not str(target_path).startswith(str(base_path.resolve())):
            return jsonify({'error': 'Access denied'}), 403
    except:
        return jsonify({'error': 'Invalid path'}), 400
    
    if not target_path.exists() or not target_path.is_file():
        return jsonify({'error': 'File not found'}), 404
    
    # Check file size (max 5MB for text files)
    if target_path.stat().st_size > 5 * 1024 * 1024:
        return jsonify({'error': 'File too large'}), 400
    
    try:
        with open(target_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        return jsonify({
            'path': file_path,
            'content': content,
            'size': target_path.stat().st_size
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/site/<domain>/files/write', methods=['POST'])
def write_file(domain):
    """Write file contents"""
    site = next((s for s in SITES if s['domain'] == domain), None)
    if not site:
        return jsonify({'error': 'Site not found'}), 404
    
    data = request.json
    file_path = data.get('path')
    content = data.get('content')
    
    if not file_path:
        return jsonify({'error': 'Path required'}), 400
    
    base_path = Path(site['public_html'])
    target_path = base_path / file_path.lstrip('/')
    
    # Security check
    try:
        target_path = target_path.resolve()
        if not str(target_path).startswith(str(base_path.resolve())):
            return jsonify({'error': 'Access denied'}), 403
    except:
        return jsonify({'error': 'Invalid path'}), 400
    
    try:
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with open(target_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return jsonify({'success': True, 'message': 'File saved'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/site/<domain>/files/upload', methods=['POST'])
def upload_file(domain):
    """Upload a file"""
    site = next((s for s in SITES if s['domain'] == domain), None)
    if not site:
        return jsonify({'error': 'Site not found'}), 404
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    path = request.form.get('path', '')
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    base_path = Path(site['public_html'])
    target_path = base_path / path.lstrip('/') / secure_filename(file.filename)
    
    # Security check
    try:
        target_path = target_path.resolve()
        if not str(target_path).startswith(str(base_path.resolve())):
            return jsonify({'error': 'Access denied'}), 403
    except:
        return jsonify({'error': 'Invalid path'}), 400
    
    try:
        target_path.parent.mkdir(parents=True, exist_ok=True)
        file.save(str(target_path))
        return jsonify({'success': True, 'message': 'File uploaded', 'path': str(target_path.relative_to(base_path))})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/site/<domain>/files/delete', methods=['POST'])
def delete_file(domain):
    """Delete a file or directory"""
    site = next((s for s in SITES if s['domain'] == domain), None)
    if not site:
        return jsonify({'error': 'Site not found'}), 404
    
    data = request.json
    file_path = data.get('path')
    
    if not file_path:
        return jsonify({'error': 'Path required'}), 400
    
    base_path = Path(site['public_html'])
    target_path = base_path / file_path.lstrip('/')
    
    # Security check
    try:
        target_path = target_path.resolve()
        if not str(target_path).startswith(str(base_path.resolve())):
            return jsonify({'error': 'Access denied'}), 403
    except:
        return jsonify({'error': 'Invalid path'}), 400
    
    if not target_path.exists():
        return jsonify({'error': 'Path not found'}), 404
    
    try:
        if target_path.is_dir():
            shutil.rmtree(target_path)
        else:
            target_path.unlink()
        return jsonify({'success': True, 'message': 'Deleted'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/site/<domain>/files/download')
def download_file(domain):
    """Download a file"""
    site = next((s for s in SITES if s['domain'] == domain), None)
    if not site:
        return jsonify({'error': 'Site not found'}), 404
    
    file_path = request.args.get('path')
    if not file_path:
        return jsonify({'error': 'Path required'}), 400
    
    base_path = Path(site['public_html'])
    target_path = base_path / file_path.lstrip('/')
    
    # Security check
    try:
        target_path = target_path.resolve()
        if not str(target_path).startswith(str(base_path.resolve())):
            return jsonify({'error': 'Access denied'}), 403
    except:
        return jsonify({'error': 'Invalid path'}), 400
    
    if not target_path.exists() or not target_path.is_file():
        return jsonify({'error': 'File not found'}), 404
    
    return send_file(str(target_path), as_attachment=True)

# ==================== DATABASE MANAGEMENT ====================

@app.route('/api/site/<domain>/database/info')
def get_database_info(domain):
    """Get database information for a site"""
    site = next((s for s in SITES if s['domain'] == domain), None)
    if not site:
        return jsonify({'error': 'Site not found'}), 404
    
    if not site.get('db_name'):
        return jsonify({'error': 'Database information not found'}), 404
    
    wp_config = Path(site['public_html']) / 'wp-config.php'
    db_info = extract_db_info(wp_config)
    
    if not db_info.get('db_password'):
        return jsonify({'error': 'Could not extract database password'}), 500
    
    try:
        connection = get_db_connection(domain)
        if not connection:
            return jsonify({'error': 'Could not connect to database'}), 500
        
        with connection:
            with connection.cursor() as cursor:
                cursor.execute("SHOW TABLES")
                tables = cursor.fetchall()
                table_count = len(tables)
                
                cursor.execute("""
                    SELECT 
                        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
                    FROM information_schema.tables 
                    WHERE table_schema = %s
                """, (db_info['db_name'],))
                size_result = cursor.fetchone()
                db_size = size_result['size_mb'] if size_result else 0
                
                return jsonify({
                    'db_name': db_info['db_name'],
                    'db_user': db_info['db_user'],
                    'db_host': db_info.get('db_host', '127.0.0.1'),
                    'table_count': table_count,
                    'size_mb': db_size,
                    'connected': True
                })
    
    except Exception as e:
        return jsonify({
            'error': str(e),
            'connected': False
        }), 500

@app.route('/api/site/<domain>/database/tables')
def get_database_tables(domain):
    """Get list of database tables"""
    connection = get_db_connection(domain)
    if not connection:
        return jsonify({'error': 'Could not connect to database'}), 500
    
    try:
        with connection:
            with connection.cursor() as cursor:
                cursor.execute("SHOW TABLE STATUS")
                tables = cursor.fetchall()
                
                table_list = []
                for table in tables:
                    table_list.append({
                        'name': table['Name'],
                        'rows': table['Rows'],
                        'data_length': table['Data_length'],
                        'index_length': table['Index_length'],
                        'size_mb': round((table['Data_length'] + table['Index_length']) / 1024 / 1024, 2),
                        'engine': table['Engine'],
                        'collation': table['Collation']
                    })
                
                return jsonify({'tables': table_list})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/site/<domain>/database/table/<table_name>')
def get_table_data(domain, table_name):
    """Get table data"""
    connection = get_db_connection(domain)
    if not connection:
        return jsonify({'error': 'Could not connect to database'}), 500
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    offset = (page - 1) * per_page
    
    try:
        with connection:
            with connection.cursor() as cursor:
                # Get total count
                cursor.execute(f"SELECT COUNT(*) as count FROM `{table_name}`")
                total = cursor.fetchone()['count']
                
                # Get data
                cursor.execute(f"SELECT * FROM `{table_name}` LIMIT {per_page} OFFSET {offset}")
                rows = cursor.fetchall()
                
                # Get columns
                cursor.execute(f"DESCRIBE `{table_name}`")
                columns = cursor.fetchall()
                
                return jsonify({
                    'table': table_name,
                    'columns': [col['Field'] for col in columns],
                    'rows': rows,
                    'total': total,
                    'page': page,
                    'per_page': per_page,
                    'pages': (total + per_page - 1) // per_page
                })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/site/<domain>/database/query', methods=['POST'])
def execute_query(domain):
    """Execute SQL query"""
    connection = get_db_connection(domain)
    if not connection:
        return jsonify({'error': 'Could not connect to database'}), 500
    
    data = request.json
    query = data.get('query', '').strip()
    
    if not query:
        return jsonify({'error': 'Query required'}), 400
    
    # Security: only allow SELECT, SHOW, DESCRIBE, EXPLAIN
    # Remove comments and whitespace to check the first command
    query_upper = query.upper()
    # Remove single-line comments (-- comment)
    query_upper = '\n'.join([line.split('--')[0] for line in query_upper.split('\n')])
    # Remove multi-line comments (/* comment */)
    import re
    query_upper = re.sub(r'/\*.*?\*/', '', query_upper, flags=re.DOTALL)
    query_upper = query_upper.strip()
    
    # Check if query starts with allowed commands
    allowed_commands = ['SELECT', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN']
    if not any(query_upper.startswith(cmd) for cmd in allowed_commands):
        return jsonify({'error': 'Only SELECT, SHOW, DESCRIBE, and EXPLAIN queries are allowed'}), 400
    
    try:
        with connection:
            with connection.cursor() as cursor:
                cursor.execute(query)
                if query_upper.startswith('SELECT') or query_upper.startswith('SHOW') or query_upper.startswith('DESCRIBE') or query_upper.startswith('DESC') or query_upper.startswith('EXPLAIN'):
                    results = cursor.fetchall()
                    return jsonify({
                        'success': True,
                        'results': results,
                        'row_count': len(results)
                    })
                else:
                    connection.commit()
                    return jsonify({
                        'success': True,
                        'message': 'Query executed successfully',
                        'affected_rows': cursor.rowcount
                    })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def create_backup_async(domain, backup_type, backup_id, include_db=True, include_files=True):
    """Create backup in background thread"""
    try:
        with backup_lock:
            backup_status[backup_id] = {
                'status': 'running',
                'progress': 0,
                'message': 'Starting backup...',
                'type': backup_type,
                'domain': domain
            }
        
        site = next((s for s in SITES if s['domain'] == domain), None)
        if not site:
            with backup_lock:
                backup_status[backup_id] = {'status': 'error', 'message': 'Site not found'}
            return
        
        # Create backups folder with date/time
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_folder = BASE_DIR / domain / 'backups' / timestamp
        backup_folder.mkdir(parents=True, exist_ok=True)
        
        files_created = []
        
        # Database backup
        if include_db and site.get('db_name'):
            with backup_lock:
                backup_status[backup_id]['progress'] = 10
                backup_status[backup_id]['message'] = 'Backing up database...'
            
            wp_config = Path(site['public_html']) / 'wp-config.php'
            db_info = extract_db_info(wp_config)
            
            if db_info.get('db_password'):
                backup_file = backup_folder / f"{db_info['db_name']}.sql.gz"
                # Use a temporary config file for mysqldump to avoid password in command line
                import tempfile
                import os
                
                # Create temporary config file
                with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.cnf') as config_file:
                    config_file.write(f"""[client]
user={db_info['db_user']}
password={db_info['db_password']}
host={db_info.get('db_host', '127.0.0.1')}
""")
                    config_path = config_file.name
                
                try:
                    # Use --defaults-file option with mysqldump
                    # Add --no-tablespaces to avoid PROCESS privilege requirement
                    # Use shell=True to properly handle the pipe
                    cmd = f"mysqldump --defaults-file={config_path} --no-tablespaces {db_info['db_name']} | gzip > {backup_file}"
                    try:
                        process_result = subprocess.run(
                            ['sudo', 'sh', '-c', cmd],
                            capture_output=True,
                            text=True,
                            timeout=1800  # 30 minute timeout for large databases
                        )
                        result = {
                            'success': process_result.returncode == 0,
                            'stdout': process_result.stdout,
                            'stderr': process_result.stderr,
                            'returncode': process_result.returncode
                        }
                    except subprocess.TimeoutExpired:
                        result = {
                            'success': False,
                            'stdout': '',
                            'stderr': 'Database backup timed out after 30 minutes',
                            'returncode': -1
                        }
                finally:
                    # Clean up config file
                    try:
                        os.unlink(config_path)
                    except:
                        pass
                
                if result['success']:
                    files_created.append(str(backup_file))
                    with backup_lock:
                        if include_files:
                            backup_status[backup_id]['progress'] = 50
                            backup_status[backup_id]['message'] = 'Database backup completed'
                        else:
                            # If only database backup, mark as completed
                            backup_status[backup_id] = {
                                'status': 'completed',
                                'progress': 100,
                                'message': 'Backup completed successfully',
                                'backup_folder': str(backup_folder),
                                'files': files_created
                            }
                            return
                else:
                    with backup_lock:
                        backup_status[backup_id] = {'status': 'error', 'message': f"Database backup failed: {result.get('stderr', 'Unknown error')}"}
                    return
        
        # Files backup
        if include_files:
            with backup_lock:
                if include_db:
                    backup_status[backup_id]['progress'] = 60
                else:
                    backup_status[backup_id]['progress'] = 10
                backup_status[backup_id]['message'] = 'Backing up files...'
            
            public_html = Path(site['public_html'])
            if public_html.exists():
                files_backup = backup_folder / 'files.tar.gz'
                # Use absolute path for tar command
                cmd = f"tar -czf {files_backup} -C {public_html.parent.absolute()} {public_html.name}"
                
                # Increase timeout for file backups (large sites can take a while)
                try:
                    result = subprocess.run(
                        ['sudo', 'sh', '-c', cmd],
                        capture_output=True,
                        text=True,
                        timeout=3600  # 1 hour timeout for large file backups
                    )
                    result = {
                        'success': result.returncode == 0,
                        'stdout': result.stdout,
                        'stderr': result.stderr,
                        'returncode': result.returncode
                    }
                except subprocess.TimeoutExpired:
                    result = {
                        'success': False,
                        'stdout': '',
                        'stderr': 'Files backup timed out after 1 hour',
                        'returncode': -1
                    }
                
                if result['success']:
                    files_created.append(str(files_backup))
                    # Success - mark as completed
                    with backup_lock:
                        backup_status[backup_id] = {
                            'status': 'completed',
                            'progress': 100,
                            'message': 'Backup completed successfully',
                            'backup_folder': str(backup_folder),
                            'files': files_created
                        }
                    return
                else:
                    with backup_lock:
                        backup_status[backup_id] = {'status': 'error', 'message': f"Files backup failed: {result.get('stderr', 'Unknown error')}"}
                    return
            else:
                with backup_lock:
                    backup_status[backup_id] = {'status': 'error', 'message': f"Public HTML directory not found: {public_html}"}
                return
    except Exception as e:
        with backup_lock:
            backup_status[backup_id] = {'status': 'error', 'message': str(e)}

@app.route('/api/site/<domain>/backup', methods=['POST'])
def create_backup(domain):
    """Create a backup (database, files, or both)"""
    site = next((s for s in SITES if s['domain'] == domain), None)
    if not site:
        return jsonify({'error': 'Site not found'}), 404
    
    data = request.json or {}
    backup_type = data.get('type', 'both')  # 'database', 'files', or 'both'
    include_db = backup_type in ['database', 'both']
    include_files = backup_type in ['files', 'both']
    
    # Generate backup ID
    backup_id = f"{domain}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    # Start backup in background
    thread = threading.Thread(target=create_backup_async, args=(domain, backup_type, backup_id, include_db, include_files))
    thread.daemon = True
    thread.start()
    
    return jsonify({
        'success': True,
        'backup_id': backup_id,
        'message': 'Backup started in background'
    })

@app.route('/api/site/<domain>/backup/<backup_id>/status', methods=['GET'])
def get_backup_status(domain, backup_id):
    """Get backup status"""
    with backup_lock:
        status = backup_status.get(backup_id, {'status': 'not_found', 'message': 'Backup not found'})
    return jsonify(status)

@app.route('/api/site/<domain>/backups/active', methods=['GET'])
def get_active_backups(domain):
    """Get all active/running backups for a domain"""
    active_backups = []
    with backup_lock:
        for backup_id, status in backup_status.items():
            # Check if this backup belongs to this domain
            if backup_id.startswith(f"{domain}_") and status.get('status') == 'running':
                active_backups.append({
                    'backup_id': backup_id,
                    'status': status.get('status'),
                    'message': status.get('message', ''),
                    'progress': status.get('progress', 0),
                    'type': status.get('type', 'both'),
                    'backup_folder': status.get('backup_folder')
                })
    return jsonify(active_backups)

@app.route('/api/site/<domain>/database/backup', methods=['POST'])
def backup_database(domain):
    """Create a database backup (legacy endpoint - redirects to new system)"""
    data = request.json or {}
    data['type'] = 'database'
    request.json = data
    return create_backup(domain)

@app.route('/api/site/<domain>/files/backup', methods=['POST'])
def backup_files(domain):
    """Create a file backup (legacy endpoint - redirects to new system)"""
    data = request.json or {}
    data['type'] = 'files'
    request.json = data
    return create_backup(domain)

@app.route('/api/site/<domain>/backups', methods=['GET'])
def list_backups(domain):
    """List all backups for a domain"""
    site = next((s for s in SITES if s['domain'] == domain), None)
    if not site:
        return jsonify({'error': 'Site not found'}), 404
    
    backups_dir = BASE_DIR / domain / 'backups'
    backups = []
    
    if backups_dir.exists():
        for backup_folder in sorted(backups_dir.iterdir(), reverse=True):
            if backup_folder.is_dir():
                folder_name = backup_folder.name
                # Parse timestamp from folder name (YYYYMMDD_HHMMSS)
                try:
                    folder_date = datetime.strptime(folder_name, '%Y%m%d_%H%M%S')
                except:
                    continue
                
                # Check what files are in this backup
                db_file = None
                files_backup = None
                
                for file in backup_folder.iterdir():
                    if file.suffix == '.gz':
                        if file.name.endswith('.sql.gz'):
                            db_file = file
                        elif file.name == 'files.tar.gz':
                            files_backup = file
                
                # Create backup entries
                if db_file:
                    backups.append({
                        'name': f"{folder_name}/database",
                        'date': folder_date.isoformat(),
                        'size': db_file.stat().st_size,
                        'path': str(db_file),
                        'type': 'database',
                        'folder': folder_name
                    })
                
                if files_backup:
                    backups.append({
                        'name': f"{folder_name}/files",
                        'date': folder_date.isoformat(),
                        'size': files_backup.stat().st_size,
                        'path': str(files_backup),
                        'type': 'files',
                        'folder': folder_name
                    })
                
                # If both exist, also add a combined entry
                if db_file and files_backup:
                    backups.append({
                        'name': folder_name,
                        'date': folder_date.isoformat(),
                        'size': db_file.stat().st_size + files_backup.stat().st_size,
                        'path': str(backup_folder),
                        'type': 'both',
                        'folder': folder_name
                    })
    
    return jsonify(backups)

@app.route('/api/site/<domain>/database/backups', methods=['GET'])
def list_database_backups(domain):
    """List database backups (legacy endpoint)"""
    backups = json.loads(list_backups(domain).get_data(as_text=True))
    db_backups = [b for b in backups if b.get('type') == 'database']
    return jsonify(db_backups)

@app.route('/api/site/<domain>/files/backups', methods=['GET'])
def list_file_backups(domain):
    """List file backups (legacy endpoint)"""
    backups = json.loads(list_backups(domain).get_data(as_text=True))
    file_backups = [b for b in backups if b.get('type') == 'files']
    return jsonify(file_backups)

@app.route('/api/site/<domain>/backups/<backup_folder>', methods=['DELETE'])
def delete_backup(domain, backup_folder):
    """Delete a backup folder"""
    site = next((s for s in SITES if s['domain'] == domain), None)
    if not site:
        return jsonify({'error': 'Site not found'}), 404
    
    backups_dir = BASE_DIR / domain / 'backups' / backup_folder
    
    if not backups_dir.exists() or not backups_dir.is_dir():
        return jsonify({'error': 'Backup not found'}), 404
    
    try:
        import shutil
        shutil.rmtree(backups_dir)
        return jsonify({'success': True, 'message': 'Backup deleted'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/site/<domain>/backups/settings', methods=['GET', 'POST'])
def backup_settings(domain):
    """Get or update backup settings"""
    site = next((s for s in SITES if s['domain'] == domain), None)
    if not site:
        return jsonify({'error': 'Site not found'}), 404
    
    settings_file = BASE_DIR / domain / 'backups' / '.settings.json'
    
    if request.method == 'GET':
        # Return default settings if file doesn't exist
        if settings_file.exists():
            try:
                with open(settings_file, 'r') as f:
                    settings = json.load(f)
                return jsonify(settings)
            except:
                pass
        
        # Default settings
        return jsonify({
            'enabled': False,
            'frequency': 'daily',
            'time': '00:00',
            'retention': 5,
            'include_files': True,
            'include_db': True
        })
    
    else:  # POST
        data = request.json
        try:
            settings_file.parent.mkdir(parents=True, exist_ok=True)
            with open(settings_file, 'w') as f:
                json.dump(data, f, indent=2)
            return jsonify({'success': True, 'message': 'Settings saved'})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

def check_and_run_auto_backups():
    """Check all sites for scheduled backups and run them if needed"""
    print("Auto-backup scheduler thread started")
    while True:
        try:
            # Detect sites fresh each time (in case new sites are added)
            sites = detect_sites()
            
            current_time = datetime.now()
            current_hour = current_time.hour
            current_minute = current_time.minute
            
            # Check each site
            for site in sites:
                domain = site['domain']
                settings_file = BASE_DIR / domain / 'backups' / '.settings.json'
                
                if not settings_file.exists():
                    continue
                
                try:
                    with open(settings_file, 'r') as f:
                        settings = json.load(f)
                except Exception as e:
                    print(f"Error reading backup settings for {domain}: {e}")
                    continue
                
                if not settings.get('enabled', False):
                    continue
                
                # Parse scheduled time
                backup_time = settings.get('time', '00:00')
                try:
                    hour, minute = map(int, backup_time.split(':'))
                except Exception as e:
                    print(f"Error parsing backup time for {domain}: {e}")
                    continue
                
                # Check if it's time to run backup
                should_run = False
                frequency = settings.get('frequency', 'daily')
                
                # Calculate scheduled time for today
                scheduled_datetime = current_time.replace(hour=hour, minute=minute, second=0, microsecond=0)
                
                # Check if we're past the scheduled time today (within 1 hour window to catch missed checks)
                time_diff_minutes = (current_time - scheduled_datetime).total_seconds() / 60
                is_within_window = 0 <= time_diff_minutes <= 60  # 1 hour window
                
                if frequency == 'daily':
                    # Run if we're within 1 hour after scheduled time
                    should_run = is_within_window
                elif frequency == 'weekly':
                    # Run on Monday if we're within window
                    should_run = is_within_window and current_time.weekday() == 0
                elif frequency == 'monthly':
                    # Run on 1st of month if we're within window
                    should_run = is_within_window and current_time.day == 1
                
                if should_run:
                    # Check if backup already ran for this scheduled time today
                    last_backup_file = BASE_DIR / domain / 'backups' / '.last_auto_backup'
                    backup_already_ran = False
                    
                    if last_backup_file.exists():
                        try:
                            last_backup_time = datetime.fromisoformat(last_backup_file.read_text().strip())
                            # Check if backup ran after today's scheduled time
                            if last_backup_time.date() == current_time.date():
                                # If last backup was after the scheduled time today, skip
                                if last_backup_time >= scheduled_datetime:
                                    backup_already_ran = True
                        except:
                            pass
                    
                    if backup_already_ran:
                        continue
                    
                    # Determine backup type
                    include_db = settings.get('include_db', True)
                    include_files = settings.get('include_files', True)
                    
                    if include_db and include_files:
                        backup_type = 'both'
                    elif include_db:
                        backup_type = 'database'
                    else:
                        backup_type = 'files'
                    
                    # Trigger backup with same format as manual backups
                    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                    backup_id = f"{domain}_{timestamp}"
                    
                    print(f"Triggering auto-backup for {domain}: type={backup_type}, id={backup_id}")
                    
                    thread = threading.Thread(
                        target=create_backup_async,
                        args=(domain, backup_type, backup_id, include_db, include_files)
                    )
                    thread.daemon = True
                    thread.start()
                    
                    # Mark that backup was triggered
                    last_backup_file.parent.mkdir(parents=True, exist_ok=True)
                    last_backup_file.write_text(current_time.isoformat())
                    
                    # Clean up old backups based on retention
                    retention = settings.get('retention', 5)
                    cleanup_old_backups(domain, retention)
                
        except Exception as e:
            print(f"Error in auto-backup scheduler: {e}")
            import traceback
            traceback.print_exc()
        
        # Check every 30 seconds for more accurate timing
        time.sleep(30)

def cleanup_old_backups(domain, retention):
    """Delete old backups beyond retention limit"""
    try:
        backups_dir = BASE_DIR / domain / 'backups'
        if not backups_dir.exists():
            return
        
        # Get all backup folders
        backup_folders = []
        for folder in backups_dir.iterdir():
            if folder.is_dir():
                try:
                    folder_date = datetime.strptime(folder.name, '%Y%m%d_%H%M%S')
                    backup_folders.append((folder_date, folder))
                except:
                    continue
        
        # Sort by date (newest first)
        backup_folders.sort(reverse=True)
        
        # Delete folders beyond retention limit
        if len(backup_folders) > retention:
            for _, folder in backup_folders[retention:]:
                try:
                    shutil.rmtree(folder)
                except:
                    pass
    except Exception as e:
        print(f"Error cleaning up backups for {domain}: {e}")

# Start auto-backup scheduler in background thread
backup_scheduler_thread = threading.Thread(target=check_and_run_auto_backups)
backup_scheduler_thread.daemon = True
backup_scheduler_thread.start()

# ==================== RESOURCE MONITORING ====================

@app.route('/api/system/resources')
def get_system_resources():
    """Get system resource usage"""
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Get network stats
        net_io = psutil.net_io_counters()
        
        # Get process count
        process_count = len(psutil.pids())
        
        return jsonify({
            'cpu': {
                'percent': cpu_percent,
                'count': psutil.cpu_count()
            },
            'memory': {
                'total': memory.total,
                'available': memory.available,
                'used': memory.used,
                'percent': memory.percent,
                'total_gb': round(memory.total / (1024**3), 2),
                'used_gb': round(memory.used / (1024**3), 2),
                'available_gb': round(memory.available / (1024**3), 2)
            },
            'disk': {
                'total': disk.total,
                'used': disk.used,
                'free': disk.free,
                'percent': disk.percent,
                'total_gb': round(disk.total / (1024**3), 2),
                'used_gb': round(disk.used / (1024**3), 2),
                'free_gb': round(disk.free / (1024**3), 2)
            },
            'network': {
                'bytes_sent': net_io.bytes_sent,
                'bytes_recv': net_io.bytes_recv,
                'packets_sent': net_io.packets_sent,
                'packets_recv': net_io.packets_recv
            },
            'processes': process_count
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/system/info')
def get_system_info():
    """Get system information"""
    info = {}
    
    # Get disk usage
    result = run_sudo_command(f'df -h {BASE_DIR}')
    if result['success']:
        info['disk_usage'] = result['stdout']
    
    # Get uptime
    result = subprocess.run(['uptime'], capture_output=True, text=True)
    if result.returncode == 0:
        info['uptime'] = result.stdout.strip()
    
    # Get load average
    try:
        load_avg = os.getloadavg()
        info['load_average'] = {
            '1min': load_avg[0],
            '5min': load_avg[1],
            '15min': load_avg[2]
        }
    except:
        pass
    
    return jsonify(info)

# ==================== WORDPRESS MANAGEMENT ====================

@app.route('/api/site/<domain>/wordpress/info')
def get_wordpress_info(domain):
    """Get WordPress information"""
    site = next((s for s in SITES if s['domain'] == domain), None)
    if not site:
        return jsonify({'error': 'Site not found'}), 404
    
    wp_config = Path(site['public_html']) / 'wp-config.php'
    version_file = Path(site['public_html']) / 'wp-includes' / 'version.php'
    
    wp_info = {}
    
    # Get WordPress version
    if version_file.exists():
        try:
            with open(version_file, 'r') as f:
                content = f.read()
                match = re.search(r"\$wp_version\s*=\s*['\"]([^'\"]+)['\"]", content)
                if match:
                    wp_info['version'] = match.group(1)
        except:
            pass
    
    # Get site URL from wp-config
    try:
        with open(wp_config, 'r') as f:
            content = f.read()
            match = re.search(r"define\s*\(\s*['\"]WP_HOME['\"]\s*,\s*['\"]([^'\"]+)['\"]", content)
            if match:
                wp_info['home_url'] = match.group(1)
            
            match = re.search(r"define\s*\(\s*['\"]WP_SITEURL['\"]\s*,\s*['\"]([^'\"]+)['\"]", content)
            if match:
                wp_info['site_url'] = match.group(1)
    except:
        pass
    
    # Get plugin count
    plugins_dir = Path(site['public_html']) / 'wp-content' / 'plugins'
    if plugins_dir.exists():
        wp_info['plugin_count'] = len([d for d in plugins_dir.iterdir() if d.is_dir() and not d.name.startswith('.')])
    
    # Get theme count
    themes_dir = Path(site['public_html']) / 'wp-content' / 'themes'
    if themes_dir.exists():
        wp_info['theme_count'] = len([d for d in themes_dir.iterdir() if d.is_dir() and not d.name.startswith('.')])
    
    return jsonify(wp_info)

def parse_plugin_header(plugin_file):
    """Parse WordPress plugin header from PHP file"""
    try:
        with open(plugin_file, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read(8192)  # Read first 8KB
        
        # Extract plugin header information
        plugin_data = {
            'name': '',
            'title': '',
            'version': '',
            'author': '',
            'status': 'inactive',
            'update': 'none'
        }
        
        # Extract plugin name from directory
        plugin_dir = plugin_file.parent.name
        plugin_data['name'] = plugin_dir
        
        # Parse header comments
        import re
        patterns = {
            'title': r'Plugin Name:\s*(.+)',
            'version': r'Version:\s*(.+)',
            'author': r'Author:\s*(.+)',
        }
        
        for key, pattern in patterns.items():
            match = re.search(pattern, content, re.IGNORECASE | re.MULTILINE)
            if match:
                plugin_data[key] = match.group(1).strip()
        
        # If no title found, use directory name
        if not plugin_data['title']:
            plugin_data['title'] = plugin_dir.replace('-', ' ').replace('_', ' ').title()
        
        return plugin_data
    except Exception as e:
        print(f"Error parsing plugin {plugin_file}: {e}")
        return None

def php_serialize_array(items):
    """Serialize a list of strings to PHP array format"""
    if not items:
        return 'a:0:{}'
    
    result = f'a:{len(items)}:{{'
    for i, item in enumerate(items):
        result += f'i:{i};s:{len(item)}:"{item}";'
    result += '}'
    return result

def php_unserialize_array(serialized):
    """Unserialize a PHP array of strings"""
    if not serialized or serialized == '':
        return []
    
    try:
        # Match PHP serialized array format: a:N:{i:0;s:L:"string";...}
        # Extract all strings
        matches = re.findall(r's:\d+:"([^"]+)"', serialized)
        return matches
    except:
        return []

def get_active_plugins(wp_path):
    """Get list of active plugins from WordPress database"""
    try:
        connection = get_db_connection_from_config(wp_path)
        if not connection:
            return []
        
        try:
            with connection:
                with connection.cursor() as cursor:
                    # Get table prefix
                    wp_config = wp_path / 'wp-config.php'
                    table_prefix = 'wp_'
                    if wp_config.exists():
                        with open(wp_config, 'r', encoding='utf-8', errors='ignore') as f:
                            config_content = f.read()
                            prefix_match = re.search(r"\$table_prefix\s*=\s*['\"]([^'\"]+)['\"]", config_content)
                            if prefix_match:
                                table_prefix = prefix_match.group(1)
                    
                    # Get active plugins from options table
                    cursor.execute(f"SELECT option_value FROM {table_prefix}options WHERE option_name = 'active_plugins' LIMIT 1")
                    result = cursor.fetchone()
                    if result:
                        active_plugins_serialized = result.get('option_value', '')
                        return php_unserialize_array(active_plugins_serialized)
        except Exception as e:
            print(f"Error reading active plugins: {e}")
            return []
        
        return []
    except Exception as e:
        print(f"Error getting active plugins: {e}")
        return []

def get_db_connection_from_config(wp_path):
    """Get database connection from wp-config.php"""
    try:
        wp_config = wp_path / 'wp-config.php'
        if not wp_config.exists():
            return None
        
        with open(wp_config, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        # Extract database credentials
        db_name_match = re.search(r"define\s*\(\s*['\"]DB_NAME['\"]\s*,\s*['\"]([^'\"]+)['\"]", content)
        db_user_match = re.search(r"define\s*\(\s*['\"]DB_USER['\"]\s*,\s*['\"]([^'\"]+)['\"]", content)
        db_pass_match = re.search(r"define\s*\(\s*['\"]DB_PASSWORD['\"]\s*,\s*['\"]([^'\"]+)['\"]", content)
        db_host_match = re.search(r"define\s*\(\s*['\"]DB_HOST['\"]\s*,\s*['\"]([^'\"]+)['\"]", content)
        
        if not all([db_name_match, db_user_match, db_pass_match, db_host_match]):
            return None
        
        db_info = {
            'db_name': db_name_match.group(1),
            'db_user': db_user_match.group(1),
            'db_password': db_pass_match.group(1),
            'db_host': db_host_match.group(1)
        }
        
        return get_db_connection_from_info(db_info)
    except:
        return None

def get_db_connection_from_info(db_info):
    """Create database connection from info dict"""
    try:
        return pymysql.connect(
            host=db_info['db_host'],
            user=db_info['db_user'],
            password=db_info['db_password'],
            database=db_info['db_name'],
            cursorclass=pymysql.cursors.DictCursor
        )
    except:
        return None

@app.route('/api/site/<domain>/wordpress/plugins', methods=['GET'])
def get_wordpress_plugins(domain):
    """Get list of WordPress plugins"""
    site = next((s for s in SITES if s['domain'] == domain), None)
    if not site:
        return jsonify({'error': 'Site not found'}), 404
    
    wp_path = Path(site['public_html'])
    if not (wp_path / 'wp-config.php').exists():
        return jsonify({'error': 'WordPress not found'}), 404
    
    try:
        # Read plugins directly from filesystem
        plugins_dir = wp_path / 'wp-content' / 'plugins'
        if not plugins_dir.exists():
            return jsonify([])
        
        active_plugins = get_active_plugins(wp_path)
        plugins = []
        
        for plugin_dir in plugins_dir.iterdir():
            if not plugin_dir.is_dir() or plugin_dir.name.startswith('.'):
                continue
            
            # Find main plugin file
            plugin_file = None
            for file in plugin_dir.iterdir():
                if file.is_file() and file.suffix == '.php':
                    # Check if it has plugin header
                    try:
                        with open(file, 'r', encoding='utf-8', errors='ignore') as f:
                            first_lines = f.read(50)
                            if 'Plugin Name:' in first_lines:
                                plugin_file = file
                                break
                    except:
                        continue
            
            if not plugin_file:
                # Use first PHP file as fallback
                php_files = list(plugin_dir.glob('*.php'))
                if php_files:
                    plugin_file = php_files[0]
                else:
                    continue
            
            plugin_data = parse_plugin_header(plugin_file)
            if plugin_data:
                # Check if plugin is active
                plugin_slug = plugin_dir.name
                if plugin_slug in active_plugins or f"{plugin_slug}/{plugin_file.name}" in active_plugins:
                    plugin_data['status'] = 'active'
                plugins.append(plugin_data)
        
        return jsonify(plugins)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

def parse_theme_header(style_file):
    """Parse WordPress theme header from style.css"""
    try:
        with open(style_file, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read(8192)  # Read first 8KB
        
        theme_data = {
            'name': '',
            'title': '',
            'version': '',
            'author': '',
            'status': 'inactive',
            'update': 'none'
        }
        
        # Extract theme name from directory
        theme_dir = style_file.parent.name
        theme_data['name'] = theme_dir
        
        # Parse header comments
        patterns = {
            'title': r'Theme Name:\s*(.+)',
            'version': r'Version:\s*(.+)',
            'author': r'Author:\s*(.+)',
        }
        
        for key, pattern in patterns.items():
            match = re.search(pattern, content, re.IGNORECASE | re.MULTILINE)
            if match:
                theme_data[key] = match.group(1).strip()
        
        # If no title found, use directory name
        if not theme_data['title']:
            theme_data['title'] = theme_dir.replace('-', ' ').replace('_', ' ').title()
        
        return theme_data
    except Exception as e:
        print(f"Error parsing theme {style_file}: {e}")
        return None

def get_active_theme(wp_path):
    """Get active theme from WordPress database"""
    try:
        connection = get_db_connection_from_config(wp_path)
        if not connection:
            return None
        
        # Get table prefix
        wp_config = wp_path / 'wp-config.php'
        table_prefix = 'wp_'
        if wp_config.exists():
            with open(wp_config, 'r', encoding='utf-8', errors='ignore') as f:
                config_content = f.read()
                prefix_match = re.search(r"\$table_prefix\s*=\s*['\"]([^'\"]+)['\"]", config_content)
                if prefix_match:
                    table_prefix = prefix_match.group(1)
        
        try:
            with connection:
                with connection.cursor() as cursor:
                    # Get active theme from options table
                    cursor.execute(f"SELECT option_value FROM {table_prefix}options WHERE option_name = 'stylesheet' LIMIT 1")
                    result = cursor.fetchone()
                    if result:
                        return result.get('option_value')
        except:
            pass
        
        return None
    except:
        return None

def find_plugin_main_file(wp_path, plugin_slug):
    """Find the main plugin file for a given plugin slug"""
    plugins_dir = wp_path / 'wp-content' / 'plugins' / plugin_slug
    if not plugins_dir.exists():
        return None
    
    # Common main plugin file names
    common_names = [f'{plugin_slug}.php', 'index.php', 'plugin.php', 'main.php']
    
    # First, try to find file with Plugin Name header
    for file in plugins_dir.iterdir():
        if file.is_file() and file.suffix == '.php':
            try:
                with open(file, 'r', encoding='utf-8', errors='ignore') as f:
                    first_lines = f.read(200)
                    if 'Plugin Name:' in first_lines:
                        return file.name
            except:
                continue
    
    # Fallback to common names
    for name in common_names:
        if (plugins_dir / name).exists():
            return name
    
    # Last resort: first PHP file
    php_files = list(plugins_dir.glob('*.php'))
    if php_files:
        return php_files[0].name
    
    return None

@app.route('/api/site/<domain>/wordpress/plugins/<plugin>/<action>', methods=['POST'])
def manage_wordpress_plugin(domain, plugin, action):
    """Enable, disable, or activate a WordPress plugin"""
    site = next((s for s in SITES if s['domain'] == domain), None)
    if not site:
        return jsonify({'error': 'Site not found'}), 404
    
    if action not in ['activate', 'deactivate', 'enable', 'disable']:
        return jsonify({'error': 'Invalid action'}), 400
    
    wp_path = Path(site['public_html'])
    if not (wp_path / 'wp-config.php').exists():
        return jsonify({'error': 'WordPress not found'}), 404
    
    try:
        connection = get_db_connection_from_config(wp_path)
        if not connection:
            return jsonify({'error': 'Could not connect to database'}), 500
        
        # Get table prefix
        wp_config = wp_path / 'wp-config.php'
        table_prefix = 'wp_'
        if wp_config.exists():
            with open(wp_config, 'r', encoding='utf-8', errors='ignore') as f:
                config_content = f.read()
                prefix_match = re.search(r"\$table_prefix\s*=\s*['\"]([^'\"]+)['\"]", config_content)
                if prefix_match:
                    table_prefix = prefix_match.group(1)
        
        # Find plugin main file
        plugin_main_file = find_plugin_main_file(wp_path, plugin)
        if not plugin_main_file:
            return jsonify({'error': f'Plugin {plugin} not found or invalid'}), 404
        
        plugin_path = f'{plugin}/{plugin_main_file}'
        
        with connection:
            with connection.cursor() as cursor:
                # Get current active plugins
                cursor.execute(f"SELECT option_value FROM {table_prefix}options WHERE option_name = 'active_plugins' LIMIT 1")
                result = cursor.fetchone()
                active_plugins = []
                if result:
                    active_plugins = php_unserialize_array(result.get('option_value', ''))
                
                # Update active plugins list
                if action == 'activate' or action == 'enable':
                    if plugin_path not in active_plugins:
                        active_plugins.append(plugin_path)
                else:  # deactivate or disable
                    if plugin_path in active_plugins:
                        active_plugins.remove(plugin_path)
                
                # Serialize and update database
                serialized = php_serialize_array(active_plugins)
                cursor.execute(
                    f"UPDATE {table_prefix}options SET option_value = %s WHERE option_name = 'active_plugins'",
                    (serialized,)
                )
                connection.commit()
        
        return jsonify({'success': True, 'message': f'Plugin {plugin} {action}d successfully'})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/site/<domain>/wordpress/themes', methods=['GET'])
def get_wordpress_themes(domain):
    """Get list of WordPress themes"""
    site = next((s for s in SITES if s['domain'] == domain), None)
    if not site:
        return jsonify({'error': 'Site not found'}), 404
    
    wp_path = Path(site['public_html'])
    if not (wp_path / 'wp-config.php').exists():
        return jsonify({'error': 'WordPress not found'}), 404
    
    try:
        # Read themes directly from filesystem
        themes_dir = wp_path / 'wp-content' / 'themes'
        if not themes_dir.exists():
            return jsonify([])
        
        active_theme = get_active_theme(wp_path)
        themes = []
        
        for theme_dir in themes_dir.iterdir():
            if not theme_dir.is_dir() or theme_dir.name.startswith('.'):
                continue
            
            # Find style.css
            style_file = theme_dir / 'style.css'
            if not style_file.exists():
                continue
            
            theme_data = parse_theme_header(style_file)
            if theme_data:
                # Check if theme is active
                if theme_dir.name == active_theme:
                    theme_data['status'] = 'active'
                themes.append(theme_data)
        
        return jsonify(themes)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/site/<domain>/wordpress/themes/<theme>/activate', methods=['POST'])
def activate_wordpress_theme(domain, theme):
    """Activate a WordPress theme"""
    site = next((s for s in SITES if s['domain'] == domain), None)
    if not site:
        return jsonify({'error': 'Site not found'}), 404
    
    wp_path = Path(site['public_html'])
    if not (wp_path / 'wp-config.php').exists():
        return jsonify({'error': 'WordPress not found'}), 404
    
    # Verify theme exists
    theme_dir = wp_path / 'wp-content' / 'themes' / theme
    if not theme_dir.exists() or not (theme_dir / 'style.css').exists():
        return jsonify({'error': f'Theme {theme} not found'}), 404
    
    try:
        connection = get_db_connection_from_config(wp_path)
        if not connection:
            return jsonify({'error': 'Could not connect to database'}), 500
        
        # Get table prefix
        wp_config = wp_path / 'wp-config.php'
        table_prefix = 'wp_'
        if wp_config.exists():
            with open(wp_config, 'r', encoding='utf-8', errors='ignore') as f:
                config_content = f.read()
                prefix_match = re.search(r"\$table_prefix\s*=\s*['\"]([^'\"]+)['\"]", config_content)
                if prefix_match:
                    table_prefix = prefix_match.group(1)
        
        with connection:
            with connection.cursor() as cursor:
                # Update both 'stylesheet' and 'template' options
                cursor.execute(
                    f"UPDATE {table_prefix}options SET option_value = %s WHERE option_name = 'stylesheet'",
                    (theme,)
                )
                cursor.execute(
                    f"UPDATE {table_prefix}options SET option_value = %s WHERE option_name = 'template'",
                    (theme,)
                )
                connection.commit()
        
        return jsonify({'success': True, 'message': f'Theme {theme} activated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/site/<domain>/wordpress/themes/<theme>/enable', methods=['POST'])
def enable_wordpress_theme(domain, theme):
    """Enable a WordPress theme (same as activate)"""
    return activate_wordpress_theme(domain, theme)

@app.route('/api/site/<domain>/wordpress/themes/<theme>/disable', methods=['POST'])
def disable_wordpress_theme(domain, theme):
    """Disable a WordPress theme (switch to default theme first)"""
    site = next((s for s in SITES if s['domain'] == domain), None)
    if not site:
        return jsonify({'error': 'Site not found'}), 404
    
    wp_path = Path(site['public_html'])
    if not (wp_path / 'wp-config.php').exists():
        return jsonify({'error': 'WordPress not found'}), 404
    
    try:
        # Find a default WordPress theme (usually twentytwentyfour, twentytwentythree, etc.)
        themes_dir = wp_path / 'wp-content' / 'themes'
        if not themes_dir.exists():
            return jsonify({'error': 'Themes directory not found'}), 404
        
        default_theme = None
        # Look for default WordPress themes
        for theme_dir in themes_dir.iterdir():
            if theme_dir.is_dir() and not theme_dir.name.startswith('.'):
                theme_name = theme_dir.name
                # Skip the theme we're disabling
                if theme_name == theme:
                    continue
                # Prefer default WordPress themes
                if 'twenty' in theme_name.lower():
                    default_theme = theme_name
                    break
        
        # If no default theme found, use first available theme
        if not default_theme:
            for theme_dir in themes_dir.iterdir():
                if theme_dir.is_dir() and not theme_dir.name.startswith('.') and theme_dir.name != theme:
                    if (theme_dir / 'style.css').exists():
                        default_theme = theme_dir.name
                        break
        
        if not default_theme:
            return jsonify({'error': 'No alternative theme available'}), 400
        
        # Activate the default theme
        connection = get_db_connection_from_config(wp_path)
        if not connection:
            return jsonify({'error': 'Could not connect to database'}), 500
        
        # Get table prefix
        wp_config = wp_path / 'wp-config.php'
        table_prefix = 'wp_'
        if wp_config.exists():
            with open(wp_config, 'r', encoding='utf-8', errors='ignore') as f:
                config_content = f.read()
                prefix_match = re.search(r"\$table_prefix\s*=\s*['\"]([^'\"]+)['\"]", config_content)
                if prefix_match:
                    table_prefix = prefix_match.group(1)
        
        with connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"UPDATE {table_prefix}options SET option_value = %s WHERE option_name = 'stylesheet'",
                    (default_theme,)
                )
                cursor.execute(
                    f"UPDATE {table_prefix}options SET option_value = %s WHERE option_name = 'template'",
                    (default_theme,)
                )
                connection.commit()
        
        return jsonify({'success': True, 'message': f'Theme switched to {default_theme}'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== LOGS ====================

@app.route('/api/site/<domain>/logs/<log_type>')
def get_site_logs(domain, log_type):
    """Get logs for a site"""
    site = next((s for s in SITES if s['domain'] == domain), None)
    if not site:
        return jsonify({'error': 'Site not found'}), 404
    
    if log_type not in ['error', 'access']:
        return jsonify({'error': 'Invalid log type'}), 400
    
    log_file = Path(site.get(f'{log_type}_log', ''))
    if not log_file.exists():
        return jsonify({'error': 'Log file not found'}), 404
    
    lines = request.args.get('lines', 100, type=int)
    
    try:
        result = run_sudo_command(f'tail -n {lines} {log_file}')
        if result['success']:
            return jsonify({
                'log_type': log_type,
                'lines': result['stdout'].split('\n')
            })
        else:
            return jsonify({'error': result['stderr']}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/service/<service_name>/logs')
def get_service_logs(service_name):
    """Get systemd journal logs for a service"""
    if service_name not in SERVICES:
        return jsonify({'error': 'Unknown service'}), 400
    
    lines = request.args.get('lines', 100, type=int)
    
    result = run_sudo_command(f'journalctl -u {service_name} -n {lines} --no-pager')
    if result['success']:
        return jsonify({
            'service': service_name,
            'lines': result['stdout'].split('\n')
        })
    else:
        return jsonify({'error': result['stderr']}), 500

# ==================== CRON JOBS ====================

@app.route('/api/cron/list')
def list_cron_jobs():
    """List cron jobs for current user"""
    try:
        result = subprocess.run(['crontab', '-l'], capture_output=True, text=True)
        if result.returncode == 0:
            jobs = []
            for line in result.stdout.split('\n'):
                line = line.strip()
                if line and not line.startswith('#'):
                    jobs.append(line)
            return jsonify({'jobs': jobs})
        else:
            return jsonify({'jobs': [], 'message': 'No crontab or error reading'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== CLOUDFLARE MANAGEMENT ====================

CLOUDFLARE_CONFIG_FILE = BASE_DIR.parent / 'cloudflare_config.json'
EMAIL_CONFIG_FILE = BASE_DIR.parent / 'email_config.json'
POSTFIX_MAIN_CF = Path("/etc/postfix/main.cf")
DOVECOT_CONF = Path("/etc/dovecot/dovecot.conf")

def load_cloudflare_config():
    """Load Cloudflare API credentials"""
    if CLOUDFLARE_CONFIG_FILE.exists():
        try:
            with open(CLOUDFLARE_CONFIG_FILE, 'r') as f:
                return json.load(f)
        except:
            return None
    return None

def save_cloudflare_config(config):
    """Save Cloudflare API credentials"""
    try:
        CLOUDFLARE_CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(CLOUDFLARE_CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving Cloudflare config: {e}")
        return False

def get_cloudflare_headers():
    """Get Cloudflare API headers - prefer API keys for email routing, fallback to token"""
    config = load_cloudflare_config()
    if not config:
        return None
    
    if config.get('global_api_key') and config.get('email'):
        return {
            'X-Auth-Email': config['email'],
            'X-Auth-Key': config['global_api_key'],
            'Content-Type': 'application/json'
        }
    elif config.get('api_token'):
        return {
            'Authorization': f"Bearer {config['api_token']}",
            'Content-Type': 'application/json'
        }
    return None

@app.route('/api/cloudflare/config', methods=['GET'])
def get_cloudflare_config():
    """Get Cloudflare API configuration status"""
    config = load_cloudflare_config()
    if config and (config.get('api_token') or (config.get('global_api_key') and config.get('email'))):
        return jsonify({
            'configured': True,
            'email': config.get('email', ''),
            'has_token': bool(config.get('api_token')),
            'has_api_key': bool(config.get('global_api_key') and config.get('email'))
        })
    return jsonify({'configured': False})

@app.route('/api/cloudflare/config', methods=['POST'])
def set_cloudflare_config():
    """Set Cloudflare API credentials"""
    data = request.json
    api_token = data.get('api_token', '').strip()
    global_api_key = data.get('global_api_key', '').strip()
    email = data.get('email', '').strip()
    
    if not api_token and not (global_api_key and email):
        return jsonify({'error': 'Either API token OR (Global API Key + Email) is required'}), 400
    
    config = {
        'api_token': api_token if api_token else None,
        'global_api_key': global_api_key if global_api_key else None,
        'email': email,
        'updated_at': datetime.now().isoformat()
    }
    
    if save_cloudflare_config(config):
        return jsonify({'success': True, 'message': 'Cloudflare API credentials saved'})
    else:
        return jsonify({'error': 'Failed to save configuration'}), 500

@app.route('/api/cloudflare/zones', methods=['GET'])
def list_cloudflare_zones():
    """List all Cloudflare zones"""
    headers = get_cloudflare_headers()
    if not headers:
        return jsonify({'error': 'Cloudflare API not configured'}), 400
    
    try:
        if not REQUESTS_AVAILABLE:
            return jsonify({'error': 'requests library not installed'}), 500
        
        response = requests.get('https://api.cloudflare.com/client/v4/zones', headers=headers)
        response.raise_for_status()
        result = response.json()
        
        zones_list = []
        if result.get('success') and result.get('result'):
            for zone in result['result']:
                zones_list.append({
                    'id': zone.get('id', ''),
                    'name': zone.get('name', ''),
                    'status': zone.get('status', ''),
                    'plan': zone.get('plan', {}).get('name', 'Free') if isinstance(zone.get('plan'), dict) else 'Free',
                    'development_mode': zone.get('development_mode', 0),
                    'name_servers': zone.get('name_servers', []),
                    'created_on': str(zone.get('created_on', '')),
                    'modified_on': str(zone.get('modified_on', ''))
                })
        return jsonify(zones_list)
    except Exception as e:
        print(f"Error listing zones: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/cloudflare/zones/create', methods=['POST'])
def create_cloudflare_zone():
    """Create a new Cloudflare zone"""
    headers = get_cloudflare_headers()
    if not headers:
        return jsonify({'error': 'Cloudflare API not configured'}), 400
    
    data = request.json
    zone_name = data.get('name', '').strip()
    
    if not zone_name:
        return jsonify({'error': 'Zone name is required'}), 400
    
    try:
        if not REQUESTS_AVAILABLE:
            return jsonify({'error': 'requests library not installed'}), 500
        
        response = requests.post(
            'https://api.cloudflare.com/client/v4/zones',
            headers=headers,
            json={'name': zone_name, 'type': data.get('type', 'full')}
        )
        response.raise_for_status()
        result = response.json()
        
        if result.get('success') and result.get('result'):
            zone = result['result']
            return jsonify({
                'id': zone.get('id', ''),
                'name': zone.get('name', ''),
                'status': zone.get('status', ''),
                'plan': zone.get('plan', {}).get('name', 'Free') if isinstance(zone.get('plan'), dict) else 'Free',
                'name_servers': zone.get('name_servers', []),
            })
        return jsonify({'error': 'Failed to create zone'}), 500
    except Exception as e:
        print(f"Error creating zone: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/cloudflare/zones/<zone_id>/dns', methods=['GET'])
def list_cloudflare_dns_records(zone_id):
    """List DNS records for a zone"""
    headers = get_cloudflare_headers()
    if not headers:
        return jsonify({'error': 'Cloudflare API not configured'}), 400
    
    try:
        if not REQUESTS_AVAILABLE:
            return jsonify({'error': 'requests library not installed'}), 500
        
        response = requests.get(f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records", headers=headers)
        response.raise_for_status()
        result = response.json()
        
        records = []
        if result.get('success') and result.get('result'):
            for record in result['result']:
                records.append({
                    'id': record.get('id', ''),
                    'type': record.get('type', ''),
                    'name': record.get('name', ''),
                    'content': record.get('content', ''),
                    'ttl': record.get('ttl', 1),
                    'proxied': record.get('proxied', False),
                    'priority': record.get('priority'),
                    'comment': record.get('comment', ''),
                    'created_on': record.get('created_on', ''),
                    'modified_on': record.get('modified_on', '')
                })
        return jsonify(records)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cloudflare/zones/<zone_id>/dns', methods=['POST'])
def create_cloudflare_dns_record(zone_id):
    """Create a DNS record"""
    headers = get_cloudflare_headers()
    if not headers:
        return jsonify({'error': 'Cloudflare API not configured'}), 400
    
    data = request.json
    try:
        if not REQUESTS_AVAILABLE:
            return jsonify({'error': 'requests library not installed'}), 500
        
        response = requests.post(f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records", headers=headers, json=data)
        response.raise_for_status()
        return jsonify(response.json().get('result', {}))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cloudflare/zones/<zone_id>/dns/<record_id>', methods=['PUT'])
def update_cloudflare_dns_record(zone_id, record_id):
    """Update a DNS record"""
    headers = get_cloudflare_headers()
    if not headers:
        return jsonify({'error': 'Cloudflare API not configured'}), 400
    
    data = request.json
    try:
        if not REQUESTS_AVAILABLE:
            return jsonify({'error': 'requests library not installed'}), 500
        
        response = requests.put(f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records/{record_id}", headers=headers, json=data)
        response.raise_for_status()
        return jsonify(response.json().get('result', {}))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cloudflare/zones/<zone_id>/dns/<record_id>', methods=['DELETE'])
def delete_cloudflare_dns_record(zone_id, record_id):
    """Delete a DNS record"""
    headers = get_cloudflare_headers()
    if not headers:
        return jsonify({'error': 'Cloudflare API not configured'}), 400
    
    try:
        if not REQUESTS_AVAILABLE:
            return jsonify({'error': 'requests library not installed'}), 500
        
        response = requests.delete(f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records/{record_id}", headers=headers)
        response.raise_for_status()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cloudflare/zones/<zone_id>/email/routing', methods=['GET'])
def get_email_routing_status(zone_id):
    """Get email routing status"""
    headers = get_cloudflare_headers()
    if not headers:
        return jsonify({'error': 'Cloudflare API not configured'}), 400
    
    try:
        if not REQUESTS_AVAILABLE:
            return jsonify({'error': 'requests library not installed'}), 500
        
        dns_response = requests.get(f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records?type=MX", headers=headers)
        if dns_response.status_code == 200:
            dns_result = dns_response.json()
            if dns_result.get('success'):
                mx_records = dns_result.get('result', [])
                has_email_routing = any('route' in r.get('content', '').lower() or 'cloudflare' in r.get('content', '').lower() for r in mx_records)
                if has_email_routing:
                    return jsonify({'enabled': True, 'status': 'active'})
        return jsonify({'enabled': False, 'status': 'not_enabled'})
    except:
        return jsonify({'enabled': False, 'status': 'not_enabled'})

@app.route('/api/cloudflare/zones/<zone_id>/email/routing', methods=['POST'])
def enable_email_routing(zone_id):
    """Enable email routing"""
    headers = get_cloudflare_headers()
    if not headers:
        return jsonify({'error': 'Cloudflare API not configured'}), 400
    
    try:
        if not REQUESTS_AVAILABLE:
            return jsonify({'error': 'requests library not installed'}), 500
        
        response = requests.put(f"https://api.cloudflare.com/client/v4/zones/{zone_id}/email/routing/settings", headers=headers, json={'enabled': True})
        if response.status_code in [200, 201]:
            return jsonify({'enabled': True, 'status': 'active'})
        if response.status_code == 405:
            return jsonify({'error': 'API endpoint not available with current authentication method'}), 405
        return jsonify({'error': 'Failed to enable'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cloudflare/zones/<zone_id>/email/addresses', methods=['GET'])
def list_email_addresses(zone_id):
    """List email addresses"""
    headers = get_cloudflare_headers()
    if not headers:
        return jsonify({'error': 'Cloudflare API not configured'}), 400
    
    try:
        if not REQUESTS_AVAILABLE:
            return jsonify({'error': 'requests library not installed'}), 500
        
        response = requests.get(f"https://api.cloudflare.com/client/v4/zones/{zone_id}/email/routing/addresses", headers=headers)
        if response.status_code == 404:
            return jsonify([])
        response.raise_for_status()
        result = response.json()
        
        addresses = []
        if result.get('success') and result.get('result'):
            for addr in result['result']:
                destination = None
                try:
                    rules_response = requests.get(f"https://api.cloudflare.com/client/v4/zones/{zone_id}/email/routing/rules", headers=headers)
                    if rules_response.status_code == 200:
                        rules_result = rules_response.json()
                        if rules_result.get('success'):
                            for rule in rules_result.get('result', []):
                                for matcher in rule.get('matchers', []):
                                    if matcher.get('value') == addr.get('email'):
                                        for action in rule.get('actions', []):
                                            if action.get('type') == 'forward':
                                                forward_values = action.get('value', [])
                                                if forward_values:
                                                    destination = forward_values[0]
                                                break
                except:
                    pass
                
                addresses.append({
                    'tag': addr.get('tag', ''),
                    'email': addr.get('email', ''),
                    'verified': addr.get('verified', False),
                    'created': str(addr.get('created', '')),
                    'modified': str(addr.get('modified', '')),
                    'destination': destination
                })
        return jsonify(addresses)
    except:
        return jsonify([])

@app.route('/api/cloudflare/zones/<zone_id>/email/addresses', methods=['POST'])
def create_email_address(zone_id):
    """Create email address"""
    headers = get_cloudflare_headers()
    if not headers:
        return jsonify({'error': 'Cloudflare API not configured'}), 400
    
    data = request.json
    email = data.get('email', '').strip()
    destination = data.get('destination', '').strip()
    
    if not email or not destination:
        return jsonify({'error': 'Email and destination required'}), 400
    
    try:
        if not REQUESTS_AVAILABLE:
            return jsonify({'error': 'requests library not installed'}), 500
        
        response = requests.post(f"https://api.cloudflare.com/client/v4/zones/{zone_id}/email/routing/addresses", headers=headers, json={'email': email})
        response.raise_for_status()
        result = response.json()
        
        if result.get('success') and result.get('result'):
            tag = result['result'].get('tag', '')
            if tag:
                try:
                    requests.post(f"https://api.cloudflare.com/client/v4/zones/{zone_id}/email/routing/rules", headers=headers, json={
                        'name': email, 'enabled': True,
                        'matchers': [{'type': 'literal', 'field': 'to', 'value': email}],
                        'actions': [{'type': 'forward', 'value': [destination]}]
                    })
                except:
                    pass
            
            return jsonify({'success': True, 'tag': tag, 'email': email, 'destination': destination})
        return jsonify({'error': 'Failed to create'}), 500
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 405:
            return jsonify({'error': 'POST method not allowed for API token. Use API keys for full access.'}), 405
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cloudflare/zones/<zone_id>/email/addresses/<address_tag>', methods=['PUT'])
def update_email_address(zone_id, address_tag):
    """Update email address"""
    headers = get_cloudflare_headers()
    if not headers:
        return jsonify({'error': 'Cloudflare API not configured'}), 400
    
    data = request.json
    destination = data.get('destination', '').strip()
    
    if not destination:
        return jsonify({'error': 'Destination required'}), 400
    
    try:
        if not REQUESTS_AVAILABLE:
            return jsonify({'error': 'requests library not installed'}), 500
        
        addr_response = requests.get(f"https://api.cloudflare.com/client/v4/zones/{zone_id}/email/routing/addresses/{address_tag}", headers=headers)
        addr_email = addr_response.json().get('result', {}).get('email') if addr_response.status_code == 200 else None
        
        rules_response = requests.get(f"https://api.cloudflare.com/client/v4/zones/{zone_id}/email/routing/rules", headers=headers)
        rule_tag = None
        if rules_response.status_code == 200:
            for rule in rules_response.json().get('result', []):
                for matcher in rule.get('matchers', []):
                    if matcher.get('value') == addr_email:
                        rule_tag = rule.get('tag')
                        break
        
        if rule_tag:
            requests.put(f"https://api.cloudflare.com/client/v4/zones/{zone_id}/email/routing/rules/{rule_tag}", headers=headers, json={'actions': [{'type': 'forward', 'value': [destination]}]})
        else:
            requests.post(f"https://api.cloudflare.com/client/v4/zones/{zone_id}/email/routing/rules", headers=headers, json={
                'name': addr_email, 'enabled': True,
                'matchers': [{'type': 'literal', 'field': 'to', 'value': addr_email}],
                'actions': [{'type': 'forward', 'value': [destination]}]
            })
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cloudflare/zones/<zone_id>/email/addresses/<address_tag>', methods=['DELETE'])
def delete_email_address(zone_id, address_tag):
    """Delete email address"""
    headers = get_cloudflare_headers()
    if not headers:
        return jsonify({'error': 'Cloudflare API not configured'}), 400
    
    try:
        if not REQUESTS_AVAILABLE:
            return jsonify({'error': 'requests library not installed'}), 500
        
        requests.delete(f"https://api.cloudflare.com/client/v4/zones/{zone_id}/email/routing/addresses/{address_tag}", headers=headers)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== EMAIL SERVER MANAGEMENT ====================

def load_email_config():
    """Load email server configuration"""
    if EMAIL_CONFIG_FILE.exists():
        try:
            with open(EMAIL_CONFIG_FILE, 'r') as f:
                return json.load(f)
        except:
            return None
    return None

def save_email_config(config):
    """Save email server configuration"""
    try:
        EMAIL_CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(EMAIL_CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving email config: {e}")
        return False

@app.route('/api/email/config', methods=['GET'])
def get_email_config():
    """Get email server configuration"""
    config = load_email_config()
    postfix_status = get_service_status('postfix')
    dovecot_status = get_service_status('dovecot')
    return jsonify({
        'configured': bool(config),
        'hostname': config.get('myhostname') if config else None,
        'domain': config.get('mydomain') if config else None,
        'relayhost': config.get('relayhost') if config else None,
        'postfix_running': postfix_status.get('active', False) if isinstance(postfix_status, dict) else False,
        'dovecot_running': dovecot_status.get('active', False) if isinstance(dovecot_status, dict) else False
    })

@app.route('/api/email/config', methods=['POST'])
def set_email_config():
    """Configure email server"""
    data = request.json
    myhostname = data.get('hostname', '').strip()
    mydomain = data.get('domain', '').strip()
    relayhost = data.get('relay_host', '').strip()
    
    if not myhostname or not mydomain:
        return jsonify({'error': 'Hostname and domain required'}), 400
    
    config = {
        'myhostname': myhostname,
        'mydomain': mydomain,
        'relayhost': relayhost if relayhost else None,
        'updated_at': datetime.now().isoformat()
    }
    
    try:
        if POSTFIX_MAIN_CF.exists():
            result = run_sudo_command(f'cp {POSTFIX_MAIN_CF} {POSTFIX_MAIN_CF}.backup')
        
        main_cf_content = ''
        if POSTFIX_MAIN_CF.exists():
            result = run_sudo_command(f'cat {POSTFIX_MAIN_CF}')
            if result['success']:
                main_cf_content = result['stdout']
        
        lines = main_cf_content.split('\n') if main_cf_content else []
        updated_lines = []
        myhostname_set = False
        mydomain_set = False
        
        for line in lines:
            if line.strip().startswith('myhostname'):
                updated_lines.append(f'myhostname = {myhostname}')
                myhostname_set = True
            elif line.strip().startswith('mydomain'):
                updated_lines.append(f'mydomain = {mydomain}')
                mydomain_set = True
            else:
                updated_lines.append(line)
        
        if not myhostname_set:
            updated_lines.append(f'myhostname = {myhostname}')
        if not mydomain_set:
            updated_lines.append(f'mydomain = {mydomain}')
        
        essential_settings = {
            'inet_interfaces': 'all',
            'inet_protocols': 'ipv4',
            'mydestination': f'$myhostname, localhost.$mydomain, localhost, $mydomain',
            'smtp_tls_security_level': 'may',
        }
        
        if relayhost:
            essential_settings['relayhost'] = relayhost
        
        for key, value in essential_settings.items():
            key_set = False
            for i, line in enumerate(updated_lines):
                if line.strip().startswith(key):
                    updated_lines[i] = f'{key} = {value}'
                    key_set = True
                    break
            if not key_set:
                updated_lines.append(f'{key} = {value}')
        
        new_config = '\n'.join(updated_lines)
        temp_file = Path('/tmp/postfix_main.cf')
        with open(temp_file, 'w') as f:
            f.write(new_config)
        
        result = run_sudo_command(f'cp {temp_file} {POSTFIX_MAIN_CF}')
        if not result['success']:
            return jsonify({'error': f'Failed to update Postfix: {result["stderr"]}'}), 500
        
        run_sudo_command('systemctl reload postfix')
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
    if save_email_config(config):
        return jsonify({'success': True, 'message': 'Email server configured'})
    else:
        return jsonify({'error': 'Failed to save config'}), 500

@app.route('/api/email/send', methods=['POST'])
def send_email():
    """Send email via Postfix"""
    if not SMTP_AVAILABLE:
        return jsonify({'error': 'SMTP not available'}), 500
    
    data = request.json
    to_email = data.get('to', '').strip()
    from_email = data.get('from', '').strip()
    from_name = data.get('from_name', '').strip()
    subject = data.get('subject', '').strip()
    body = data.get('body', '').strip()
    html_body = data.get('html_body', '').strip()
    
    if not all([to_email, from_email, subject, body]):
        return jsonify({'error': 'To, from, subject, and body required'}), 400
    
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = f'{from_name} <{from_email}>' if from_name else from_email
        msg['To'] = to_email
        msg['Subject'] = subject
        
        msg.attach(MIMEText(body, 'plain'))
        if html_body:
            msg.attach(MIMEText(html_body, 'html'))
        
        with smtplib.SMTP('localhost', 25) as server:
            server.send_message(msg)
        
        return jsonify({'success': True, 'message': 'Email sent'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/email/users', methods=['GET'])
def list_email_users():
    """List email users"""
    try:
        result = subprocess.run(['getent', 'passwd'], capture_output=True, text=True, timeout=10)
        users = []
        if result.returncode == 0:
            for line in result.stdout.split('\n'):
                if line.strip():
                    parts = line.split(':')
                    if len(parts) >= 7:
                        username = parts[0]
                        home = parts[5]
                        if Path(home) / 'Maildir' in [Path(home) / 'Maildir']:
                            users.append({
                                'username': username,
                                'domain': 'localhost',
                                'full_email': f'{username}@localhost'
                            })
        return jsonify(users)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/email/users', methods=['POST'])
def create_email_user():
    """Create email user"""
    data = request.json
    username = data.get('username', '').strip()
    domain = data.get('domain', '').strip()
    password = data.get('password', '').strip()
    
    if not all([username, domain, password]):
        return jsonify({'error': 'Username, domain, and password required'}), 400
    
    try:
        import crypt
        result = run_sudo_command(['useradd', '-m', '-s', '/bin/bash', username])
        if not result['success']:
            if 'already exists' in result['stderr'].lower():
                return jsonify({'error': 'User exists'}), 400
            return jsonify({'error': result['stderr']}), 500
        
        password_hash = crypt.crypt(password, crypt.mksalt(crypt.METHOD_SHA512))
        run_sudo_command(['usermod', '-p', password_hash, username])
        
        mail_dir = Path(f'/home/{username}/Maildir')
        run_sudo_command(['mkdir', '-p', str(mail_dir)])
        run_sudo_command(['chown', '-R', f'{username}:{username}', str(mail_dir)])
        
        return jsonify({'success': True, 'username': username, 'domain': domain, 'full_email': f'{username}@{domain}'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Detect sites on startup
    SITES = detect_sites()
    print(f"Detected {len(SITES)} sites")
    
    debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(host='127.0.0.1', port=5000, debug=debug_mode)
