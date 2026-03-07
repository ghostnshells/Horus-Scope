# Horus Scope SaaS Transformation Plan

## Context

Horus Scope is a vulnerability monitoring dashboard (React + Express) with 24 hardcoded assets cached globally. It needs to:
1. Fix performance gaps (missing cache ranges, no compression, no HTTP caching)
2. Add user authentication with email verification
3. Let users configure which assets they monitor from a large curated catalog

Architecture decisions: SQLite (file-based, zero setup), global cache of ALL assets (users get filtered views), JWT auth with httpOnly refresh cookies, curated expandable asset catalog.

---

## Part 1: Performance Fixes

### 1.1 Add missing time ranges to server cache
- **File:** `server/index.js` line 112
- Change `timeRanges = ['7d', '30d', '90d']` → `['7d', '30d', '24h', '90d', '119d']` (most-used first)

### 1.2 Add gzip compression
- **Install:** `compression`
- **File:** `server/index.js` — add `app.use(compression())` before CORS middleware

### 1.3 Add HTTP Cache-Control headers
- **File:** `server/index.js`
- Static assets: `express.static(distPath, { maxAge: '1y', immutable: true })`
- `/api/vulnerabilities`: `Cache-Control: public, max-age=300, stale-while-revalidate=3600`
- `/api/status`: `Cache-Control: no-cache`

### 1.4 PM2 clustering
- **File:** `ecosystem.config.cjs` — set `instances: 2, exec_mode: 'cluster'`
- **File:** `server/index.js` — only run cron on primary instance (`NODE_APP_INSTANCE === '0'`)

---

## Part 2: Authentication & User Management

### New dependencies
```
npm install better-sqlite3 bcryptjs jsonwebtoken nodemailer cookie-parser react-router-dom
```

### New env vars (add to `.env.example`)
```
JWT_SECRET=<random-64-char-hex>
JWT_REFRESH_SECRET=<different-random-64-char-hex>
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-email-password
APP_URL=https://yourdomain.com
```

### 2.1 SQLite database — `server/db/database.js`
- Create/connect to `server/db/horus-scope.db`
- Enable WAL mode for concurrent reads under PM2 clustering
- Schema:
  - `users` — id, email, password_hash, display_name, email_verified, verification_token, verification_expires, reset_token, reset_token_expires, created_at, updated_at
  - `user_assets` — user_id, asset_id (composite PK, FK to users)
  - Indexes on email, verification_token, reset_token, user_id
- Export `db` instance and `initDB()` function
- Add `server/db/*.db*` to `.gitignore`

### 2.2 Auth service — `server/services/authService.js`
- `hashPassword(password)` — bcrypt, 12 rounds
- `verifyPassword(password, hash)`
- `generateAccessToken(userId)` — JWT, 15 min expiry
- `generateRefreshToken(userId)` — JWT, 7 day expiry
- `verifyToken(token, secret)`
- `generateVerificationToken()` / `generateResetToken()` — crypto.randomBytes

### 2.3 Email service — `server/services/emailService.js`
- `sendVerificationEmail(email, token, baseUrl)` — HTML email with verification link
- `sendPasswordResetEmail(email, token, baseUrl)`
- Uses nodemailer with SMTP transport (Hostinger: smtp.hostinger.com:465)

### 2.4 Auth middleware — `server/middleware/auth.js`
- `requireAuth(req, res, next)` — verify JWT from Authorization header, attach `req.userId`
- `optionalAuth(req, res, next)` — same but doesn't reject unauthenticated requests

### 2.5 Auth routes — `server/routes/auth.js`
```
POST /api/auth/signup         — validate, hash password, create user, send verification email
POST /api/auth/login          — verify email_verified, check password, issue tokens
POST /api/auth/logout         — clear refresh cookie
POST /api/auth/refresh        — read refresh cookie, issue new access token
GET  /api/auth/verify-email   — ?token=xxx, set email_verified=1
POST /api/auth/forgot-password — send reset email
POST /api/auth/reset-password  — validate token, hash new password, update
GET  /api/auth/me             — return current user info (requires auth)
```

### 2.6 User routes — `server/routes/user.js`
```
GET    /api/user/profile      — user info
PUT    /api/user/profile      — update display_name
GET    /api/user/assets       — user's selected asset IDs
PUT    /api/user/assets       — replace all selections { assets: [...ids] }
```

### 2.7 Wire into server — `server/index.js`
- Import and call `initDB()` in `initialize()`
- Add `cookie-parser` middleware
- Mount auth routes (public) and user routes (requireAuth)
- Keep catch-all `app.get('*', ...)` LAST

---

## Part 3: User-Configurable Asset Selection

### 3.1 Expand asset catalog — `server/services/assets.js`
- Add `category` field to all existing assets
- Expand from 24 to 100+ assets across categories:
  - **Network:** Palo Alto, Fortinet, Juniper, Aruba, F5, Ubiquiti
  - **Cloud:** AWS, GCP, Salesforce, ServiceNow
  - **OS:** Ubuntu, RHEL, Debian, SUSE, macOS, iOS
  - **Database:** MySQL, PostgreSQL, MongoDB, Redis, Elasticsearch
  - **Security:** CrowdStrike, SentinelOne, Sophos, Trend Micro, Splunk, Qualys
  - **Collaboration:** Slack, Atlassian (Jira/Confluence), Citrix
  - **DevOps:** Jenkins, GitLab, Docker, Kubernetes, Terraform, Apache
  - **Backup/DR:** Commvault, Veritas, Acronis, Rubrik, Cohesity
  - **Virtualization:** VMware, Nutanix, Proxmox
  - **IoT/OT:** Siemens, Schneider Electric, Honeywell, Rockwell
- Each asset: `{ id, name, vendor, category, cpeVendor, cpeProducts, keywords }`

### 3.2 Add product validators — `server/services/nvdService.js`
- Add `PRODUCT_VALIDATORS` entries for each new asset to filter false positives

### 3.3 Catalog API — `server/routes/catalog.js`
```
GET /api/catalog            — full catalog (id, name, vendor, category, description) — public
GET /api/catalog/categories — category list with counts
```

### 3.4 Filter vulnerability API — `server/index.js`
- `/api/vulnerabilities` now requires auth
- Fetches user's selected asset IDs from database
- Filters global cache `byAsset` to only include user's assets
- Response shape stays the same (frontend doesn't change)

### 3.5 Frontend auth context — `src/context/AuthContext.jsx`
- `AuthProvider` wrapping the app
- `useAuth()` hook → `{ user, isAuthenticated, isLoading, login, logout, signup }`
- On mount: call `/api/auth/refresh` to restore session from refresh cookie
- Auto-refresh access token on a 14-minute timer

### 3.6 Frontend API wrapper — `src/services/api.js`
- `apiFetch(url, options)` — auto-attaches `Authorization: Bearer <token>` header

### 3.7 Auth pages (new components)
- `src/components/Auth/Login.jsx` — email + password form, links to signup/forgot-password
- `src/components/Auth/Signup.jsx` — email, password, confirm, display name
- `src/components/Auth/VerifyEmail.jsx` — reads ?token, calls API, shows result
- `src/components/Auth/ForgotPassword.jsx` — email input form
- `src/components/Auth/ResetPassword.jsx` — new password form, reads ?token
- All styled with existing CSS variables (dark theme, glass effects, card pattern)

### 3.8 Asset selector — `src/components/Profile/AssetSelector.jsx`
- Fetches catalog from `/api/catalog`
- Search/filter bar
- Category accordion sections with "Select All" per category
- Checkbox per asset (name + vendor)
- Counter: "X assets selected"
- Save calls `PUT /api/user/assets`
- Used in two contexts: onboarding (full page) and profile settings (embedded)

### 3.9 Profile settings — `src/components/Profile/ProfileSettings.jsx`
- User info display (email, display name)
- Embedded `<AssetSelector />`
- Change password form
- Logout button

### 3.10 App routing — `src/App.jsx` + `src/main.jsx`
- Wrap app in `<BrowserRouter>` and `<AuthProvider>`
- Extract current dashboard layout into `<DashboardLayout>` component
- Routes:
  - `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password` — public
  - `/onboarding` — protected, shown on first login (0 assets selected)
  - `/dashboard` — protected, main app (current layout)
  - `/profile` — protected, settings page
  - `/` → redirect to `/dashboard`
- `<ProtectedRoute>` wrapper: redirect to `/login` if unauthenticated

### 3.11 Update vulnerability service — `src/services/vulnerabilityService.js`
- Replace raw `fetch` with `apiFetch` in `fetchFromBackend()`
- Server now returns filtered data, so no frontend filtering needed

### 3.12 Update frontend assets reference — `src/data/assets.js`
- Keep as static display reference (category, vendorGroup, subProducts, icon mappings)
- Dashboard uses this for rendering but fetches actual vuln data from authenticated API

---

## Execution Order

```
Part 1 (all can be done in parallel):
  1.1 Add missing time ranges
  1.2 Add gzip compression
  1.3 Add Cache-Control headers
  1.4 PM2 clustering (depends on 1.1)

Part 2 (sequential):
  2.1 Database module → 2.2 Auth service + 2.3 Email service → 2.4 Auth middleware
  → 2.5 Auth routes → 2.6 User routes → 2.7 Wire into server

Part 3 (depends on Part 2):
  3.1 Expand catalog + 3.2 Validators → 3.3 Catalog API → 3.4 Filtered vuln API
  3.5 Auth context + 3.6 API wrapper → 3.7 Auth pages → 3.8 Asset selector
  → 3.9 Profile settings → 3.10 App routing → 3.11 Update vuln service
```

---

## Verification Checklist

- [ ] `curl -I /api/vulnerabilities?timeRange=24h` returns `Cache-Control` + `Content-Encoding: gzip`
- [ ] `pm2 status` shows 2 instances running
- [ ] Signup → receive verification email → click link → login works
- [ ] New user sees onboarding page to select assets
- [ ] Dashboard shows only the user's selected assets
- [ ] Profile page allows changing asset selections
- [ ] Sidebar filtering, alerts panel, news feed, charts all work as before
- [ ] `curl /api/status` shows all 5 time ranges cached
- [ ] Forgot password → reset email → new password works
