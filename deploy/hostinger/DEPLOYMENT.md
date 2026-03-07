# Horus Scope - Hostinger VPS Deployment Guide

## Prerequisites

- Hostinger VPS with Node.js (v18+) access
- SSH access to your VPS
- Domain configured in Hostinger DNS panel

## 1. Connect to Your VPS

```bash
ssh root@your-vps-ip
```

## 2. Install Node.js (if not already installed)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v  # Should be v18+
```

## 3. Install PM2 (Process Manager)

```bash
npm install -g pm2
```

## 4. Clone and Set Up the Project

```bash
cd /var/www
git clone <your-repo-url> horus-scope
cd horus-scope
npm install
```

## 5. Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

Set the following values:

```env
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
NVD_API_KEY=your-nvd-api-key
ADMIN_API_KEY=a-secure-random-string
```

Get an NVD API key at: https://nvd.nist.gov/developers/request-an-api-key

## 6. Build the Frontend

```bash
npm run build
```

## 7. Start with PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # Follow the output to enable auto-start on reboot
```

## 8. Set Up Nginx Reverse Proxy

Install Nginx if not present:

```bash
apt-get install -y nginx
```

Create `/etc/nginx/sites-available/horus-scope`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
ln -s /etc/nginx/sites-available/horus-scope /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

## 9. Enable SSL (HTTPS)

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

Certbot will auto-configure Nginx for HTTPS. After this, update your `.env`:

```env
CORS_ORIGIN=https://yourdomain.com
```

## 10. Verify Deployment

- Visit `https://yourdomain.com` — the dashboard should load
- Check `https://yourdomain.com/api/status` — should return server status JSON
- The first cache build takes a few minutes; vulnerabilities will appear shortly

## Useful PM2 Commands

```bash
pm2 status              # Check app status
pm2 logs horus-scope       # View live logs
pm2 restart horus-scope    # Restart the app
pm2 stop horus-scope       # Stop the app
pm2 monit               # Real-time monitoring
```

## Updating the Application

```bash
cd /var/www/horus-scope
git pull
npm install
npm run build
pm2 restart horus-scope
```

## Troubleshooting

- **502 Bad Gateway**: Check `pm2 logs horus-scope` — the Node process may have crashed
- **Assets not loading**: Ensure `npm run build` completed and `dist/` directory exists
- **No vulnerability data**: Check NVD_API_KEY is set; first fetch takes a few minutes
- **Port conflicts**: Change PORT in `.env` if 3001 is in use
