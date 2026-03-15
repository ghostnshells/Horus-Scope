// Panoptes Backend Server
// Express server with all API routes, enrichment pipeline, and scheduled cache refresh
// Designed for Railway persistent server deployment (replaces Vercel serverless functions)

import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';

// Database initialisation
import { initializeDatabase, cleanupExpiredCache, cleanupExpiredSessions, cleanupExpiredTokens } from './lib/db.js';

// Shared library services (same code Vercel serverless functions used)
import { ASSETS } from './lib/assets.js';
import {
    fetchVulnerabilitiesForAsset,
    searchCISAForAsset,
    sortByMostRecentDate,
    getDateRange
} from './lib/nvdService.js';
import { enrichWithEPSS } from './lib/epssService.js';
import { enrichWithAttackTechniques } from './lib/attackMapping.js';
import { enrichWithThreatActors } from './lib/threatActorService.js';
import {
    cache,
    setAssetVulns,
    assembleFullCache,
    cascadeTimeRanges,
    getVulnData,
    getCacheMetadata,
    BATCH_SIZE,
    TOTAL_BATCHES
} from './lib/cache.js';
import {
    validatePassword,
    createUser,
    generateTokens,
    storeRefreshToken,
    verifyRefreshToken,
    isRefreshTokenValid,
    revokeRefreshToken,
    getUser,
    requestEmailVerification,
    verifyEmail,
    requestPasswordReset,
    resetPassword,
    verifyAccessToken,
    findOrCreateOAuthUser
} from './lib/auth.js';
import { getAuthorizationUrl, exchangeCodeForUser, getAvailableProviders } from './lib/oauthProviders.js';
import { getUserAssets, setUserAssets } from './lib/userAssetsService.js';
import { getUserCloudRegions, setUserCloudRegions } from './lib/userCloudRegionsService.js';
import {
    getVulnStatus,
    setVulnStatus,
    getAuditTrail,
    getSLAConfig,
    setSLAConfig,
    setBulkStatus
} from './lib/lifecycleService.js';
import { fetchCloudStatus, computeDailyStatus, computeOverallStatus } from './lib/cloudStatusService.js';
import { getKillChains } from './lib/killChainService.js';
import { validatePasswordStrength, validateCveId, validateTimeRange } from './lib/validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

const TIME_RANGES = ['24h', '7d', '30d', '90d', '119d'];

// Track refresh state
let isRefreshing = false;
let lastRefreshResult = null;

// ===================
// Middleware
// ===================

const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : process.env.NODE_ENV === 'production'
        ? (console.warn('WARNING: CORS_ORIGIN is not set. Denying all cross-origin requests in production.'), false)
        : 'http://localhost:5173';

app.use(cors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: [
                "'self'",
                "https://api.rss2json.com",
                "https://api.msrc.microsoft.com",
                "https://id.cisco.com",
                "https://apix.cisco.com",
                "https://www.mozilla.org",
                "https://api.github.com",
                "https://services.nvd.nist.gov",
                "https://www.cisa.gov",
                "https://accounts.google.com",
                "https://login.microsoftonline.com",
                "https://github.com",
            ],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'self'"],
            objectSrc: ["'none'"],
            scriptSrcAttr: ["'none'"],
            upgradeInsecureRequests: [],
        }
    }
}));
app.use(cookieParser());
app.use(express.json());

// Serve static files from the built frontend (production)
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// ===================
// Auth Middleware (Express-style)
// ===================

function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.slice(7);

    try {
        const decoded = verifyAccessToken(token);
        req.user = { email: decoded.email };
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// ===================
// Rate Limiters
// ===================

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: { error: 'Too many login attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const signupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: { error: 'Too many signup attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3,
    message: { error: 'Too many password reset requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const resendVerificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3,
    message: { error: 'Too many verification email requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const publicApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ===================
// Helpers
// ===================

function setRefreshTokenCookie(res, token) {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth',
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
}

function clearRefreshTokenCookie(res) {
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth'
    });
}

function timingSafeCompare(a, b) {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) {
        // Compare against self to keep constant time, but return false
        crypto.timingSafeEqual(bufA, bufA);
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

// ===================
// API Routes — Vulnerabilities
// ===================

app.get('/api/vulnerabilities', publicApiLimiter, async (req, res) => {
    try {
        const timeRange = req.query.timeRange || '7d';
        if (!validateTimeRange(timeRange)) {
            return res.status(400).json({ error: 'Invalid timeRange. Must be one of: 24h, 7d, 30d, 90d, 119d' });
        }
        const data = await getVulnData(timeRange);

        if (!data) {
            return res.status(503).json({
                error: 'Cache not ready',
                message: 'Vulnerability data is still being fetched. Please try again in a few minutes.',
                success: false
            });
        }

        const metadata = await getCacheMetadata();

        res.json({
            success: true,
            data,
            cacheInfo: {
                lastUpdated: metadata.lastUpdated[timeRange] || null,
                nextUpdate: null,
                timeRange
            }
        });
    } catch (error) {
        console.error('Error fetching vulnerabilities:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
});

// ===================
// API Routes — Kill Chains
// ===================

app.get('/api/kill-chains', publicApiLimiter, async (req, res) => {
    try {
        const timeRange = req.query.timeRange || '7d';
        if (!validateTimeRange(timeRange)) {
            return res.status(400).json({ error: 'Invalid timeRange. Must be one of: 24h, 7d, 30d, 90d, 119d' });
        }

        const data = await getKillChains(timeRange);

        if (!data) {
            return res.status(503).json({
                error: 'Cache not ready',
                message: 'Vulnerability data is still being fetched. Please try again in a few minutes.',
                success: false
            });
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error computing kill chains:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
});

// ===================
// API Routes — Auth
// ===================

// POST /api/auth/login
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await validatePassword(email, password);

        if (!user.emailVerified) {
            return res.status(403).json({ error: 'Please verify your email before logging in.', code: 'EMAIL_NOT_VERIFIED' });
        }

        const tokens = generateTokens(user.email);
        await storeRefreshToken(tokens.refreshToken, user.email);

        setRefreshTokenCookie(res, tokens.refreshToken);
        res.json({
            success: true,
            user,
            accessToken: tokens.accessToken
        });
    } catch (error) {
        if (error.message === 'Invalid credentials') {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/signup
app.post('/api/auth/signup', signupLimiter, async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const pwCheck = validatePasswordStrength(password);
        if (!pwCheck.valid) {
            return res.status(400).json({ error: pwCheck.error });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const user = await createUser(email, password);
        const tokens = generateTokens(user.email);
        await storeRefreshToken(tokens.refreshToken, user.email);

        // Send verification email (best effort)
        try {
            await requestEmailVerification(user.email);
        } catch (emailErr) {
            console.warn('Failed to send verification email:', emailErr.message);
        }

        setRefreshTokenCookie(res, tokens.refreshToken);
        res.status(201).json({
            success: true,
            user,
            accessToken: tokens.accessToken
        });
    } catch (error) {
        if (error.message === 'User already exists') {
            return res.status(400).json({ error: 'Could not create account. Please try again or use a different email.' });
        }
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/logout
app.post('/api/auth/logout', async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;

        if (refreshToken) {
            await revokeRefreshToken(refreshToken);
        }

        clearRefreshTokenCookie(res);
        res.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/refresh
app.post('/api/auth/refresh', async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token is required' });
        }

        // Verify the token signature
        const decoded = verifyRefreshToken(refreshToken);

        // Check if the token hasn't been revoked
        const storedEmail = await isRefreshTokenValid(refreshToken);
        if (!storedEmail) {
            return res.status(401).json({ error: 'Refresh token has been revoked' });
        }

        // Revoke the old refresh token (rotation)
        await revokeRefreshToken(refreshToken);

        // Generate new token pair
        const tokens = generateTokens(decoded.email);
        await storeRefreshToken(tokens.refreshToken, decoded.email);

        setRefreshTokenCookie(res, tokens.refreshToken);
        res.json({
            success: true,
            accessToken: tokens.accessToken
        });
    } catch (error) {
        if (error.message.includes('Invalid') || error.message.includes('expired')) {
            return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }
        console.error('Refresh error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
        const user = await getUser(req.user.email);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ success: true, user });
    } catch (error) {
        console.error('Me error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ===================
// API Routes — Email Verification & Password Reset
// ===================

// POST /api/auth/verify-email
app.post('/api/auth/verify-email', async (req, res) => {
    try {
        const { token } = req.body || {};
        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        const email = await verifyEmail(token);
        res.json({ success: true, email });
    } catch (error) {
        if (error.message.includes('Invalid') || error.message.includes('expired')) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Verify email error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/resend-verification
app.post('/api/auth/resend-verification', requireAuth, resendVerificationLimiter, async (req, res) => {
    try {
        await requestEmailVerification(req.user.email);
        res.json({ success: true });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/forgot-password
app.post('/api/auth/forgot-password', forgotPasswordLimiter, async (req, res) => {
    try {
        const { email } = req.body || {};
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        await requestPasswordReset(email);
        // Always return success to prevent email enumeration
        res.json({ success: true });
    } catch (error) {
        if (error.message.includes('Too many')) {
            return res.status(429).json({ error: error.message });
        }
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/reset-password
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body || {};
        if (!token || !password) {
            return res.status(400).json({ error: 'Token and password are required' });
        }
        const pwCheck = validatePasswordStrength(password);
        if (!pwCheck.valid) {
            return res.status(400).json({ error: pwCheck.error });
        }

        await resetPassword(token, password);
        res.json({ success: true });
    } catch (error) {
        if (error.message.includes('Invalid') || error.message.includes('expired')) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ===================
// API Routes — OAuth / SSO
// ===================

// Pending OAuth states (in-memory, short-lived)
const oauthStates = new Map();

// Cleanup stale OAuth states every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [state, data] of oauthStates) {
        if (now - data.createdAt > 10 * 60 * 1000) { // 10 minute expiry
            oauthStates.delete(state);
        }
    }
}, 5 * 60 * 1000);

// Resolve base URL for OAuth redirect URIs — prefer explicit env var over request headers
function getBaseUrl(req) {
    if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
    // Behind a reverse proxy, X-Forwarded-Proto is more reliable than req.protocol
    const proto = req.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.protocol;
    return `${proto}://${req.get('host')}`;
}

// GET /api/auth/oauth/providers — list configured providers
app.get('/api/auth/oauth/providers', (req, res) => {
    res.json({ providers: getAvailableProviders() });
});

// GET /api/auth/oauth/:provider — redirect to provider's consent screen
app.get('/api/auth/oauth/:provider', (req, res) => {
    try {
        const provider = req.params.provider;
        const available = getAvailableProviders();
        if (!available.includes(provider)) {
            return res.status(400).json({ error: `Provider "${provider}" is not available` });
        }

        const state = crypto.randomBytes(32).toString('hex');
        const origin = req.query.origin || req.headers.referer || '/';
        oauthStates.set(state, { provider, origin, createdAt: Date.now() });

        const redirectUri = `${getBaseUrl(req)}/api/auth/oauth/${provider}/callback`;

        const authUrl = getAuthorizationUrl(provider, redirectUri, state);
        res.redirect(authUrl);
    } catch (error) {
        console.error('OAuth redirect error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/auth/oauth/:provider/callback — handle provider callback
app.get('/api/auth/oauth/:provider/callback', async (req, res) => {
    const provider = req.params.provider;
    const { code, state, error: oauthError } = req.query;

    // Send the OAuth result back to the main window via localStorage.
    // A per-request nonce allows the inline script past the CSP policy.
    const sendResult = (params) => {
        const nonce = crypto.randomBytes(16).toString('base64');
        const payload = JSON.stringify(params);
        res.setHeader(
            'Content-Security-Policy',
            `default-src 'self'; script-src 'nonce-${nonce}'`
        );
        res.send(`
            <!DOCTYPE html>
            <html><head><title>Authenticating...</title></head>
            <body><script nonce="${nonce}">
                try {
                    localStorage.setItem('panoptes_oauth_result', ${JSON.stringify(payload)});
                } catch(e) {}
                window.close();
                setTimeout(function() { window.location.href = '/'; }, 500);
            </script><p>Signing you in...</p></body></html>
        `);
    };

    if (oauthError) {
        return sendResult({ error: oauthError });
    }

    if (!code || !state) {
        return sendResult({ error: 'Missing code or state parameter' });
    }

    // Validate state
    const stateData = oauthStates.get(state);
    if (!stateData || stateData.provider !== provider) {
        return sendResult({ error: 'Invalid OAuth state — possible CSRF' });
    }
    oauthStates.delete(state);

    try {
        const redirectUri = `${getBaseUrl(req)}/api/auth/oauth/${provider}/callback`;

        // Exchange code for user info
        const oauthUser = await exchangeCodeForUser(provider, code, redirectUri);

        // Find or create user in our database
        const user = await findOrCreateOAuthUser(
            provider,
            oauthUser.providerId,
            oauthUser.email,
            oauthUser.displayName,
            oauthUser.avatarUrl
        );

        // Generate JWT tokens (same as regular login)
        const tokens = generateTokens(user.email);
        await storeRefreshToken(tokens.refreshToken, user.email);

        // Set refresh token cookie
        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax', // lax needed for OAuth redirect flow
            path: '/api/auth',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        sendResult({ success: 'true', accessToken: tokens.accessToken, email: user.email });
    } catch (error) {
        console.error(`OAuth callback error (${provider}):`, error);
        sendResult({ error: error.message || 'OAuth authentication failed' });
    }
});

// ===================
// API Routes — User Profile & Assets
// ===================

// GET /api/user/profile
app.get('/api/user/profile', requireAuth, async (req, res) => {
    try {
        const user = await getUser(req.user.email);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ success: true, user });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/user/assets
app.get('/api/user/assets', requireAuth, async (req, res) => {
    try {
        const assets = await getUserAssets(req.user.email);
        res.json({ success: true, assets });
    } catch (error) {
        console.error('Get user assets error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/user/assets
app.put('/api/user/assets', requireAuth, async (req, res) => {
    try {
        const { assetIds } = req.body || {};
        if (!assetIds || !Array.isArray(assetIds)) {
            return res.status(400).json({ error: 'assetIds array is required' });
        }

        const result = await setUserAssets(req.user.email, assetIds);
        res.json({ success: true, assets: result });
    } catch (error) {
        if (error.message.includes('Invalid asset')) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Set user assets error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/user/cloud-regions
app.get('/api/user/cloud-regions', requireAuth, async (req, res) => {
    try {
        const regions = await getUserCloudRegions(req.user.email);
        res.json({ success: true, regions });
    } catch (error) {
        console.error('Get cloud regions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/user/cloud-regions
app.put('/api/user/cloud-regions', requireAuth, async (req, res) => {
    try {
        const { regions } = req.body || {};
        if (!regions || typeof regions !== 'object') {
            return res.status(400).json({ error: 'regions object is required' });
        }

        const result = await setUserCloudRegions(req.user.email, regions);
        res.json({ success: true, regions: result });
    } catch (error) {
        if (error.message.includes('Invalid')) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Set cloud regions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ===================
// API Routes — Lifecycle
// ===================

// GET/PUT /api/lifecycle/status
app.get('/api/lifecycle/status', requireAuth, async (req, res) => {
    const { cveId } = req.query;

    if (!cveId) {
        return res.status(400).json({ error: 'cveId query parameter is required' });
    }
    if (!validateCveId(cveId)) {
        return res.status(400).json({ error: 'Invalid CVE ID format. Expected format: CVE-YYYY-NNNNN' });
    }

    try {
        const status = await getVulnStatus(req.user.email, cveId);
        res.json({ success: true, data: status });
    } catch (error) {
        console.error('Get status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/lifecycle/status', requireAuth, async (req, res) => {
    const { cveId } = req.query;

    if (!cveId) {
        return res.status(400).json({ error: 'cveId query parameter is required' });
    }
    if (!validateCveId(cveId)) {
        return res.status(400).json({ error: 'Invalid CVE ID format. Expected format: CVE-YYYY-NNNNN' });
    }

    try {
        const { status, notes } = req.body || {};

        if (!status) {
            return res.status(400).json({ error: 'status is required' });
        }

        const result = await setVulnStatus(req.user.email, cveId, status, notes || '');
        res.json({ success: true, data: result });
    } catch (error) {
        if (error.message.includes('Invalid status')) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Set status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/lifecycle/audit
app.get('/api/lifecycle/audit', requireAuth, async (req, res) => {
    const { cveId } = req.query;

    if (!cveId) {
        return res.status(400).json({ error: 'cveId query parameter is required' });
    }
    if (!validateCveId(cveId)) {
        return res.status(400).json({ error: 'Invalid CVE ID format. Expected format: CVE-YYYY-NNNNN' });
    }

    try {
        const trail = await getAuditTrail(req.user.email, cveId);
        res.json({ success: true, data: trail });
    } catch (error) {
        console.error('Audit trail error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET/PUT /api/lifecycle/sla
app.get('/api/lifecycle/sla', requireAuth, async (req, res) => {
    try {
        const config = await getSLAConfig(req.user.email);
        res.json({ success: true, data: config });
    } catch (error) {
        console.error('Get SLA error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/lifecycle/sla', requireAuth, async (req, res) => {
    try {
        const { critical, high, medium, low } = req.body || {};
        const fields = { critical, high, medium, low };
        for (const [key, val] of Object.entries(fields)) {
            if (val !== undefined && (typeof val !== 'number' || val < 1 || val > 365)) {
                return res.status(400).json({ error: `${key} must be a number between 1 and 365` });
            }
        }
        const result = await setSLAConfig(req.user.email, fields);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Set SLA error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/lifecycle/bulk
app.post('/api/lifecycle/bulk', requireAuth, async (req, res) => {
    try {
        const { cveIds, status, notes } = req.body || {};

        if (!cveIds || !Array.isArray(cveIds) || cveIds.length === 0) {
            return res.status(400).json({ error: 'cveIds array is required' });
        }

        if (!status) {
            return res.status(400).json({ error: 'status is required' });
        }

        if (cveIds.length > 100) {
            return res.status(400).json({ error: 'Maximum 100 CVEs per bulk update' });
        }

        const invalidCve = cveIds.find(id => !validateCveId(id));
        if (invalidCve) {
            return res.status(400).json({ error: `Invalid CVE ID format: ${invalidCve}. Expected format: CVE-YYYY-NNNNN` });
        }

        const results = await setBulkStatus(req.user.email, cveIds, status, notes || '');
        res.json({ success: true, data: results, count: results.length });
    } catch (error) {
        if (error.message.includes('Invalid status')) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Bulk update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ===================
// API Routes — Cloud Status
// ===================

const CLOUD_STATUS_CACHE_KEY = 'cloud:status';
const CLOUD_STATUS_CACHE_TTL = 300; // 5 minutes

app.get('/api/cloud-status', publicApiLimiter, async (req, res) => {
    try {
        const forceRefresh = req.query.refresh === 'true';
        const regionsParam = req.query.regions; // e.g. "aws:us-east-1,us-west-2|gcp:us-central1"

        // M3: Guard against excessively long regions parameter
        if (regionsParam && regionsParam.length > 500) {
            return res.status(400).json({ error: 'regions parameter too long' });
        }

        let data;
        let wasCached = false;

        // Try cache first
        if (!forceRefresh) {
            try {
                const cached = await cache.get(CLOUD_STATUS_CACHE_KEY);
                if (cached) {
                    data = cached;
                    wasCached = true;
                }
            } catch (cacheErr) {
                console.warn('[CloudStatus] Cache read failed:', cacheErr.message);
            }
        }

        if (!data) {
            data = await fetchCloudStatus();

            // Store in cache (always cache the full unfiltered data)
            try {
                await cache.set(CLOUD_STATUS_CACHE_KEY, data, { ex: CLOUD_STATUS_CACHE_TTL });
            } catch (cacheErr) {
                console.warn('[CloudStatus] Cache write failed:', cacheErr.message);
            }
        }

        // Apply region filtering if requested
        if (regionsParam) {
            const regionFilter = {};
            for (const segment of regionsParam.split('|')) {
                const [provider, ...regionParts] = segment.split(':');
                if (provider && regionParts.length > 0) {
                    regionFilter[provider] = regionParts.join(':').split(',');
                }
            }

            const filteredProviders = {};
            for (const [providerId, providerData] of Object.entries(data.providers)) {
                const allowedRegions = regionFilter[providerId];
                if (!allowedRegions) {
                    // No filter for this provider — include all
                    filteredProviders[providerId] = providerData;
                    continue;
                }

                const allowedSet = new Set(allowedRegions);
                const filtered = providerData.incidents.filter(inc => {
                    if (!inc.regions) return true;
                    // Include if incident is global or matches any allowed region
                    return inc.regions.includes('global') || inc.regions.some(r => allowedSet.has(r));
                });

                const dailyStatus = computeDailyStatus(filtered);
                const overallStatus = computeOverallStatus(dailyStatus, filtered);

                filteredProviders[providerId] = {
                    ...providerData,
                    incidents: filtered.sort((a, b) => new Date(b.created) - new Date(a.created)),
                    dailyStatus,
                    overallStatus,
                };
            }

            data = { ...data, providers: filteredProviders };
        }

        res.json({
            success: true,
            data,
            cached: wasCached,
        });
    } catch (error) {
        console.error('[CloudStatus] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch cloud status',
        });
    }
});

// ===================
// API Routes — Health
// ===================

app.get('/api/health', publicApiLimiter, async (req, res) => {
    const results = {
        timestamp: new Date().toISOString(),
        checks: {}
    };

    // Check environment variables (only in development)
    if (process.env.NODE_ENV === 'development') {
        results.checks.env = {
            DATABASE_URL: !!process.env.DATABASE_URL,
            NVD_API_KEY: !!process.env.NVD_API_KEY,
            JWT_SECRET: !!process.env.JWT_SECRET,
        };
    }

    // Check database connection
    try {
        await cache.ping();
        results.checks.database = { success: true };
    } catch (error) {
        results.checks.database = { success: false, error: 'Database connection failed' };
    }

    // Check assets
    results.checks.assets = {
        success: true,
        count: ASSETS.length
    };

    // Refresh status
    results.checks.refresh = {
        isRefreshing,
        lastResult: lastRefreshResult
    };

    // Uptime
    results.uptime = process.uptime();

    // Overall status
    const allChecks = Object.values(results.checks);
    const failedChecks = allChecks.filter(check =>
        typeof check === 'object' && check.success === false
    );

    results.status = failedChecks.length === 0 ? 'healthy' : 'unhealthy';
    results.failedCount = failedChecks.length;
    results.totalChecks = allChecks.length;

    res.status(results.status === 'healthy' ? 200 : 500).json(results);
});

// ===================
// API Routes — Cache Status & Manual Refresh
// ===================

app.get('/api/status', publicApiLimiter, async (req, res) => {
    const metadata = await getCacheMetadata();
    res.json({
        status: 'online',
        lastUpdated: metadata.lastUpdated,
    });
});

app.post('/api/refresh', async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    const expectedKey = process.env.ADMIN_API_KEY;

    if (!expectedKey || !apiKey || !timingSafeCompare(expectedKey, apiKey)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (isRefreshing) {
        return res.status(409).json({ error: 'Refresh already in progress' });
    }

    // Start refresh in background so we can respond immediately
    refreshCache().catch(err => {
        console.error('Background refresh failed:', err);
    });

    res.json({ success: true, message: 'Cache refresh started' });
});

// ===================
// Cache Refresh Logic (Full Enrichment Pipeline)
// ===================

async function refreshCache() {
    if (isRefreshing) {
        console.log('[Refresh] Already in progress, skipping');
        return;
    }

    isRefreshing = true;
    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] Starting full cache refresh for ${ASSETS.length} assets...`);

    let assetsProcessed = 0;
    let totalVulns = 0;
    let errors = 0;

    try {
        // Process ALL assets sequentially (no batching needed — no timeout constraint)
        for (const asset of ASSETS) {
            for (const timeRange of TIME_RANGES) {
                try {
                    const { startDate, endDate } = getDateRange(timeRange);

                    // 1. Fetch from NVD
                    const nvdVulns = await fetchVulnerabilitiesForAsset(asset, startDate, endDate);

                    // 2. Fetch from CISA
                    let cisaVulns = [];
                    try {
                        cisaVulns = await searchCISAForAsset(asset, startDate, endDate);
                    } catch (e) {
                        console.warn(`[Refresh] CISA failed for ${asset.name}: ${e.message}`);
                    }

                    // 3. Merge NVD + CISA
                    const cisaVulnMap = new Map(cisaVulns.map(v => [v.id, v]));
                    const merged = nvdVulns.map(vuln => {
                        const cisaVuln = cisaVulnMap.get(vuln.id);
                        return {
                            ...vuln,
                            activelyExploited: cisaVuln ? true : vuln.activelyExploited,
                            cisaData: cisaVuln?.cisaData || vuln.cisaData
                        };
                    });

                    // Add CISA-only vulnerabilities
                    const nvdIds = new Set(nvdVulns.map(v => v.id));
                    const cisaOnly = cisaVulns.filter(v => !nvdIds.has(v.id));
                    merged.push(...cisaOnly);

                    // 4. Sort by date
                    const sorted = sortByMostRecentDate(merged);

                    // 5. Enrich with ATT&CK technique mappings (synchronous)
                    const withAttack = enrichWithAttackTechniques(sorted);

                    // 6. Enrich with EPSS scores (async API call)
                    const enriched = await enrichWithEPSS(withAttack);

                    // 7. Enrich with threat actors (synchronous)
                    const withThreatActors = enrichWithThreatActors(enriched);

                    // 8. Store per-asset results in cache
                    await setAssetVulns(asset.id, timeRange, withThreatActors);

                    totalVulns += withThreatActors.length;
                    console.log(`[Refresh] ${asset.name} (${timeRange}): ${withThreatActors.length} vulnerabilities`);
                } catch (error) {
                    errors++;
                    console.error(`[Refresh] Error for ${asset.name} (${timeRange}):`, error.message);
                    // Do NOT overwrite existing cached data on error
                }
            }
            assetsProcessed++;
        }

        // Reassemble full cache for all time ranges
        for (const timeRange of TIME_RANGES) {
            await assembleFullCache(timeRange, ASSETS);
        }

        // Cascade: ensure vulns in longer ranges appear in all applicable shorter ranges
        await cascadeTimeRanges(ASSETS);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        lastRefreshResult = {
            success: true,
            timestamp: new Date().toISOString(),
            assetsProcessed,
            totalVulns,
            errors,
            elapsedSeconds: parseFloat(elapsed)
        };
        console.log(`[${new Date().toISOString()}] Cache refresh complete: ${assetsProcessed} assets, ${totalVulns} vulns, ${errors} errors, ${elapsed}s`);
    } catch (error) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        lastRefreshResult = {
            success: false,
            timestamp: new Date().toISOString(),
            error: error.message,
            assetsProcessed,
            errors,
            elapsedSeconds: parseFloat(elapsed)
        };
        console.error(`[${new Date().toISOString()}] Cache refresh failed after ${elapsed}s:`, error);
    } finally {
        isRefreshing = false;
    }
}

// ===================
// SPA Fallback — serve frontend for all non-API routes
// ===================

app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

// ===================
// Scheduled Jobs
// ===================

// Refresh cache every hour
cron.schedule('0 * * * *', async () => {
    console.log('Hourly cache refresh triggered');
    await refreshCache();
});

// Clean up expired cache entries, sessions, and tokens every 6 hours
cron.schedule('0 */6 * * *', async () => {
    console.log('Running expired data cleanup...');
    try {
        await cleanupExpiredCache();
        await cleanupExpiredSessions();
        await cleanupExpiredTokens();
    } catch (err) {
        console.error('Cleanup error:', err.message);
    }
});

// ===================
// Startup
// ===================

async function initialize() {
    console.log('Panoptes Backend Server starting...');
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Assets configured: ${ASSETS.length}`);

    // Initialise database schema (creates tables if they don't exist)
    try {
        await initializeDatabase();
    } catch (err) {
        if (process.env.NODE_ENV === 'production') {
            console.error('FATAL: Database initialisation failed:', err.message);
            process.exit(1);
        }
        console.warn('WARNING: Database initialisation failed:', err.message);
        console.warn('Some features (kill chain, auth, lifecycle) require a database.');
        console.warn('Cloud status (Pulse) and direct NVD proxy will still work.');
    }

    // Check if cache needs refresh
    try {
        const metadata = await getCacheMetadata();
        const lastUpdated = metadata.lastUpdated?.['7d'];
        const oneHourAgo = Date.now() - (60 * 60 * 1000);

        if (!lastUpdated || new Date(lastUpdated).getTime() < oneHourAgo) {
            console.log('Cache is stale or empty, starting background refresh...');
            // Run in background so the server starts accepting requests immediately
            refreshCache().catch(err => {
                console.error('Startup refresh failed:', err);
            });
        } else {
            console.log(`Cache is fresh (last updated: ${lastUpdated})`);
        }
    } catch (error) {
        console.error('Error checking cache freshness:', error.message);
        // Still try to refresh
        refreshCache().catch(err => {
            console.error('Startup refresh failed:', err);
        });
    }
}

// ===================
// Start Server
// ===================

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await initialize();
});

export default app;
