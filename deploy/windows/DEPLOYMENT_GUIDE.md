# Horus Scope On-Premises Deployment Guide
## Windows Server with IIS

This guide walks you through deploying Horus Scope on a Windows Server with IIS as a reverse proxy.

---

## Prerequisites

1. **Windows Server** (2016, 2019, or 2022)
2. **IIS** installed with the following features:
   - URL Rewrite Module
   - Application Request Routing (ARR)
3. **Node.js** (v18 or later) - Download from https://nodejs.org/
4. **NVD API Key** - Get one free at https://nvd.nist.gov/developers/request-an-api-key

---

## Step 1: Install Required IIS Modules

### Install URL Rewrite Module
Download and install from: https://www.iis.net/downloads/microsoft/url-rewrite

### Install Application Request Routing (ARR)
Download and install from: https://www.iis.net/downloads/microsoft/application-request-routing

### Enable ARR Proxy
1. Open IIS Manager
2. Click on your server name (root level)
3. Double-click "Application Request Routing Cache"
4. Click "Server Proxy Settings" in the right panel
5. Check "Enable proxy" and click Apply

---

## Step 2: Build the Application

Open PowerShell as Administrator and run:

```powershell
# Navigate to project directory
cd C:\path\to\Horus Scope

# Install dependencies
npm install

# Build the frontend for production
npm run build

# Install backend dependencies
cd server
npm install
cd ..
```

---

## Step 3: Configure Environment Variables

Create the environment file for the backend:

```powershell
# Create .env file in server directory
@"
NVD_API_KEY=your-nvd-api-key-here
PORT=3001
NODE_ENV=production
"@ | Out-File -FilePath "server\.env" -Encoding UTF8
```

**Important:** Replace `your-nvd-api-key-here` with your actual NVD API key.

---

## Step 4: Install PM2 for Process Management

PM2 keeps your Node.js backend running and auto-restarts on crashes:

```powershell
# Install PM2 globally
npm install -g pm2
npm install -g pm2-windows-startup

# Start the backend server
cd server
pm2 start index.js --name "horus-scope-api"

# Configure PM2 to start on Windows boot
pm2-startup install
pm2 save
```

---

## Step 5: Configure IIS

### Create the Website

1. Open IIS Manager
2. Right-click "Sites" → "Add Website"
3. Configure:
   - **Site name:** Horus Scope
   - **Physical path:** `C:\path\to\Horus Scope\dist` (the built frontend)
   - **Binding:**
     - Type: http (or https if you have SSL cert)
     - IP: All Unassigned (or specific IP)
     - Port: 80 (or 443 for HTTPS)
     - Host name: (optional) horus-scope.yourdomain.local

### Configure URL Rewrite Rules

1. Select your Horus Scope site in IIS Manager
2. Double-click "URL Rewrite"
3. Click "Add Rule(s)..." → "Blank rule"

#### Rule 1: API Proxy (Backend)
- **Name:** API Proxy
- **Match URL:**
  - Requested URL: Matches the Pattern
  - Using: Wildcards
  - Pattern: `api/*`
- **Action:**
  - Action type: Rewrite
  - Rewrite URL: `http://localhost:3001/{R:0}`

#### Rule 2: SPA Fallback (Frontend)
- **Name:** SPA Fallback
- **Match URL:**
  - Requested URL: Matches the Pattern
  - Using: Wildcards
  - Pattern: `*`
- **Conditions:** (Add condition)
  - Input: `{REQUEST_FILENAME}`
  - Type: Is Not a File
- **Action:**
  - Action type: Rewrite
  - Rewrite URL: `/index.html`

---

## Step 6: Firewall Configuration

Allow HTTP/HTTPS traffic through Windows Firewall:

```powershell
# Allow HTTP (port 80)
New-NetFirewallRule -DisplayName "Horus Scope HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow

# Allow HTTPS (port 443) - if using SSL
New-NetFirewallRule -DisplayName "Horus Scope HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

---

## Step 7: Test the Deployment

1. Open a browser on another machine on your network
2. Navigate to `http://your-server-ip/` or `http://horus-scope.yourdomain.local/`
3. You should see the Horus Scope dashboard

---

## Optional: SSL/TLS Configuration

For internal networks, you can:

### Option A: Self-Signed Certificate
```powershell
# Generate self-signed cert (PowerShell as Admin)
New-SelfSignedCertificate -DnsName "horus-scope.yourdomain.local" -CertStoreLocation "cert:\LocalMachine\My"
```

### Option B: Internal CA Certificate
Request a certificate from your organization's internal Certificate Authority.

Then in IIS:
1. Select your site → Bindings
2. Add → Type: https, select your certificate

---

## Maintenance Commands

```powershell
# Check backend status
pm2 status

# View backend logs
pm2 logs horus-scope-api

# Restart backend
pm2 restart horus-scope-api

# Update application
cd C:\path\to\Horus Scope
git pull
npm install
npm run build
pm2 restart horus-scope-api
```

---

## Troubleshooting

### Backend not responding
```powershell
pm2 logs horus-scope-api --lines 50
```

### IIS 500 errors
Check: `C:\inetpub\logs\LogFiles\W3SVC1\`

### API calls failing
Ensure ARR proxy is enabled and URL Rewrite rules are correct.

### Verify backend is running
```powershell
Invoke-WebRequest -Uri "http://localhost:3001/api/health" -UseBasicParsing
```
