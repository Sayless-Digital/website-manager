# Local Website Manager

A web-based management interface (like cPanel) for managing your local WordPress websites, Apache, MySQL, and Cloudflare tunnels.

## Features

- **Service Management**: Start, stop, restart, enable/disable Apache, MySQL, and Cloudflare tunnel services
- **Website Overview**: View all detected WordPress sites with their status
- **Site Details**: View detailed information about each site including:
  - Apache configuration status
  - Local and public accessibility
  - Database information (name, size, table count)
  - File paths
- **Log Viewing**: View error and access logs for each site, plus systemd service logs
- **Database Management**: View database info and create backups
- **Auto-Detection**: Automatically detects all WordPress sites in the configured directory
- **Real-time Status**: Auto-refreshes every 30 seconds

## Installation

1. **Install Python dependencies**:
   ```bash
   cd /home/mercury/Documents/Storage/Websites/website-manager
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Configure sudo access** (for service management):
   
   The application needs sudo access to manage systemd services. Add this to `/etc/sudoers.d/website-manager`:
   ```
   mercury ALL=(ALL) NOPASSWD: /bin/systemctl start apache2, /bin/systemctl stop apache2, /bin/systemctl restart apache2, /bin/systemctl enable apache2, /bin/systemctl disable apache2
   mercury ALL=(ALL) NOPASSWD: /bin/systemctl start mysql, /bin/systemctl stop mysql, /bin/systemctl restart mysql, /bin/systemctl enable mysql, /bin/systemctl disable mysql
   mercury ALL=(ALL) NOPASSWD: /bin/systemctl start cloudflared, /bin/systemctl stop cloudflared, /bin/systemctl restart cloudflared, /bin/systemctl enable cloudflared, /bin/systemctl disable cloudflared
   mercury ALL=(ALL) NOPASSWD: /bin/systemctl status apache2, /bin/systemctl status mysql, /bin/systemctl status cloudflared
   mercury ALL=(ALL) NOPASSWD: /bin/systemctl is-active apache2, /bin/systemctl is-active mysql, /bin/systemctl is-active cloudflared
   mercury ALL=(ALL) NOPASSWD: /bin/systemctl is-enabled apache2, /bin/systemctl is-enabled mysql, /bin/systemctl is-enabled cloudflared
   mercury ALL=(ALL) NOPASSWD: /usr/bin/journalctl -u apache2, /usr/bin/journalctl -u mysql, /usr/bin/journalctl -u cloudflared
   mercury ALL=(ALL) NOPASSWD: /usr/bin/tail -n * /var/log/apache2/*
   mercury ALL=(ALL) NOPASSWD: /usr/bin/mysqldump *
   ```

   Or for easier setup, you can allow all systemctl commands:
   ```
   mercury ALL=(ALL) NOPASSWD: /bin/systemctl *
   mercury ALL=(ALL) NOPASSWD: /usr/bin/journalctl *
   mercury ALL=(ALL) NOPASSWD: /usr/bin/tail -n * /var/log/apache2/*
   mercury ALL=(ALL) NOPASSWD: /usr/bin/mysqldump *
   ```

## Usage

### Manual Start

Run the start script:
```bash
./start.sh
```

Or manually:
```bash
source venv/bin/activate
python3 app.py
```

Then open your browser to: http://127.0.0.1:5000

### As a System Service

1. **Copy the service file**:
   ```bash
   sudo cp website-manager.service /etc/systemd/system/
   ```

2. **Reload systemd**:
   ```bash
   sudo systemctl daemon-reload
   ```

3. **Enable and start the service**:
   ```bash
   sudo systemctl enable website-manager
   sudo systemctl start website-manager
   ```

4. **Check status**:
   ```bash
   sudo systemctl status website-manager
   ```

5. **View logs**:
   ```bash
   sudo journalctl -u website-manager -f
   ```

## Configuration

The application automatically detects sites from `/home/mercury/Documents/Storage/Websites/`. To change this, edit `BASE_DIR` in `app.py`.

## Security Note

This application runs on `127.0.0.1:5000` by default, making it only accessible locally. If you need remote access, consider:
- Using SSH port forwarding
- Setting up a reverse proxy with authentication
- Adding authentication to the Flask app

## Troubleshooting

### Services won't start/stop
- Check sudo permissions are configured correctly
- Verify the service names match your system (apache2, mysql, cloudflared)

### Sites not detected
- Ensure WordPress sites are in the correct directory structure: `BASE_DIR/domain.com/public_html/wp-config.php`
- Check file permissions

### Database connection fails
- Verify MySQL is running
- Check database credentials in wp-config.php
- Ensure PyMySQL can connect (may need to install: `pip install PyMySQL`)

### Logs not showing
- Check file permissions on log files
- Verify log file paths exist
- Check sudo permissions for tail command

## License

This is a local management tool for personal use.






