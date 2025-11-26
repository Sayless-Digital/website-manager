# Quick Start Guide

## 1. Install Dependencies

```bash
cd /home/mercury/Documents/Storage/Websites/website-manager
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 2. Setup Sudo Permissions

Run the setup script to configure sudo permissions (required for service management):

```bash
./setup-sudo.sh
```

This allows the manager to control Apache, MySQL, and Cloudflare services without prompting for a password.

## 3. Start the Manager

### Option A: Manual Start (for testing)

```bash
./start.sh
```

Then open: http://127.0.0.1:5000

### Option B: As a System Service (recommended)

```bash
# Copy service file
sudo cp website-manager.service /etc/systemd/system/

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable website-manager
sudo systemctl start website-manager

# Check status
sudo systemctl status website-manager
```

Then open: http://127.0.0.1:5000

## Features

- **Dashboard**: View all services (Apache, MySQL, Cloudflare) and their status
- **Website Management**: See all detected WordPress sites
- **Service Control**: Start, stop, restart, enable/disable services
- **Logs**: View Apache error/access logs and systemd service logs
- **Database Info**: View database details and create backups
- **Site Status**: Check local and public accessibility

## Troubleshooting

### "Permission denied" errors
- Make sure you ran `./setup-sudo.sh`
- Check sudoers file: `sudo visudo -c -f /etc/sudoers.d/website-manager`

### Sites not showing
- Verify sites are in `/home/mercury/Documents/Storage/Websites/`
- Each site should have `public_html/wp-config.php`

### Can't connect to database
- Ensure MySQL is running
- Check database credentials in wp-config.php

### Service won't start
- Check logs: `sudo journalctl -u website-manager -f`
- Verify virtual environment is set up correctly






