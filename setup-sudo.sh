#!/bin/bash
# Setup sudo permissions for Website Manager

echo "Setting up sudo permissions for Website Manager..."
echo "This will create a sudoers file that allows the website-manager to control services without a password."

# Create sudoers file
sudo tee /etc/sudoers.d/website-manager > /dev/null <<'EOF'
# Website Manager - Service Control
mercury ALL=(ALL) NOPASSWD: /bin/systemctl start apache2, /bin/systemctl stop apache2, /bin/systemctl restart apache2, /bin/systemctl enable apache2, /bin/systemctl disable apache2
mercury ALL=(ALL) NOPASSWD: /bin/systemctl start mysql, /bin/systemctl stop mysql, /bin/systemctl restart mysql, /bin/systemctl enable mysql, /bin/systemctl disable mysql
mercury ALL=(ALL) NOPASSWD: /bin/systemctl start cloudflared, /bin/systemctl stop cloudflared, /bin/systemctl restart cloudflared, /bin/systemctl enable cloudflared, /bin/systemctl disable cloudflared
mercury ALL=(ALL) NOPASSWD: /bin/systemctl status apache2, /bin/systemctl status mysql, /bin/systemctl status cloudflared
mercury ALL=(ALL) NOPASSWD: /bin/systemctl is-active apache2, /bin/systemctl is-active mysql, /bin/systemctl is-active cloudflared
mercury ALL=(ALL) NOPASSWD: /bin/systemctl is-enabled apache2, /bin/systemctl is-enabled mysql, /bin/systemctl is-enabled cloudflared
mercury ALL=(ALL) NOPASSWD: /usr/bin/journalctl -u apache2, /usr/bin/journalctl -u mysql, /usr/bin/journalctl -u cloudflared
mercury ALL=(ALL) NOPASSWD: /usr/bin/tail -n * /var/log/apache2/*
mercury ALL=(ALL) NOPASSWD: /usr/bin/mysqldump *
EOF

# Set proper permissions
sudo chmod 0440 /etc/sudoers.d/website-manager

echo "✓ Sudo permissions configured!"
echo ""
echo "Verifying sudoers file syntax..."
sudo visudo -c -f /etc/sudoers.d/website-manager

if [ $? -eq 0 ]; then
    echo "✓ Sudoers file is valid!"
else
    echo "✗ Error in sudoers file! Please check manually."
    exit 1
fi






