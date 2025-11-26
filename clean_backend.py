#!/usr/bin/env python3
"""Script to remove UI routes from app.py and make it API-only"""

import re

# Read the original file
with open('app.py', 'r') as f:
    content = f.read()

# Remove render_template from imports
content = re.sub(
    r'from flask import Flask, render_template, jsonify, request, send_file, Response',
    'from flask import Flask, jsonify, request, send_file, Response',
    content
)

# Remove the UI route section (lines with @app.route('/') and @app.route('/site/<domain>'))
# Remove the index route
content = re.sub(
    r"@app\.route\('/'\)\ndef index\(\):\s+\"\"\"Main dashboard\"\"\"\s+return render_template\('index\.html'\)\n\n",
    '',
    content
)

# Remove the site_page route
content = re.sub(
    r"@app\.route\('/site/<domain>'\)\ndef site_page\(domain\):\s+\"\"\"Individual site management page\"\"\"\s+return render_template\('site\.html', domain=domain\)\n\n",
    '',
    content
)

# Update the comment from "ROUTES" to "API ROUTES"
content = re.sub(
    r'# ==================== ROUTES ====================',
    '# ==================== API ROUTES ====================',
    content
)

# Write the cleaned file
with open('app.py', 'w') as f:
    f.write(content)

print("Backend cleaned successfully! Removed UI routes and render_template import.")