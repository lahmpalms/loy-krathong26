#!/usr/bin/env bash
# Run on the VPS as root (Debian/Ubuntu). Safe to re-run: pulls latest, rebuilds, restarts.
set -euo pipefail
APP=/var/www/loykrathong26
DOMAIN=loykrathong26.lahmpalms.me

if ! node -v 2>/dev/null | grep -qE '^v(2[2-9]|[3-9][0-9])'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
command -v nginx >/dev/null || apt-get install -y nginx
command -v git >/dev/null || apt-get install -y git

if [ -d "$APP/.git" ]; then git -C "$APP" pull --ff-only; else git clone https://github.com/lahmpalms/loy-krathong26.git "$APP"; fi
cd "$APP"
npm ci && npm run build

install -d -o www-data -g www-data /var/lib/loykrathong26
cp deploy/loykrathong26.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable loykrathong26
systemctl restart loykrathong26

cp deploy/nginx.conf /etc/nginx/sites-available/loykrathong26
ln -sf /etc/nginx/sites-available/loykrathong26 /etc/nginx/sites-enabled/loykrathong26
nginx -t && systemctl reload nginx

# HTTPS once DNS points here: certbot --nginx -d $DOMAIN
echo "OK: http://$DOMAIN"
