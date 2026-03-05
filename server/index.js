// Heimdall Backend Server
// Express server with all API routes, enrichment pipeline, and scheduled cache refresh
// Designed for Railway persistent server deployment (replaces Vercel serverless functions)

import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';

// Database initialisation
import { initializeDatabase, cleanupExpiredCache, cleanupExpiredSessions } from './lib/db.js';

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
    getUser
} from './lib/auth.js';
import { verifyAccessToken } from './lib/auth.js';
import {
    getVulnStatus,
    setVulnStatus,
    getAuditTrail,
    getSLAConfig,
    setSLAConfig,
    setBulkStatus
} from './lib/lifecycleService.js';
import { fetchCloudStatus } from './lib/cloudStatusService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
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
    : '*';

app.use(cors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
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
// API Routes — Vulnerabilities
// ===================

app.get('/api/vulnerabilities', async (req, res) => {
    try {
        const timeRange = req.query.timeRange || '7d';
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
            message: error.message
        });
    }
});

// ===================
// API Routes — Auth
// ===================

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await validatePassword(email, password);
        const tokens = generateTokens(user.email);
        await storeRefreshToken(tokens.refreshToken, user.email);

        res.json({
            success: true,
            user,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
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
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const user = await createUser(email, password);
        const tokens = generateTokens(user.email);
        await storeRefreshToken(tokens.refreshToken, user.email);

        res.status(201).json({
            success: true,
            user,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
        });
    } catch (error) {
        if (error.message === 'User already exists') {
            return res.status(409).json({ error: 'User already exists' });
        }
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/logout
app.post('/api/auth/logout', async (req, res) => {
    try {
        const { refreshToken } = req.body || {};

        if (refreshToken) {
            await revokeRefreshToken(refreshToken);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/refresh
app.post('/api/auth/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body || {};

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

        res.json({
            success: true,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
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
// API Routes — Lifecycle
// ===================

// GET/PUT /api/lifecycle/status
app.get('/api/lifecycle/status', requireAuth, async (req, res) => {
    const { cveId } = req.query;

    if (!cveId) {
        return res.status(400).json({ error: 'cveId query parameter is required' });
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
        const config = req.body || {};
        const result = await setSLAConfig(req.user.email, config);
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

app.get('/api/cloud-status', async (req, res) => {
    try {
        const forceRefresh = req.query.refresh === 'true';

        // Try cache first
        if (!forceRefresh) {
            try {
                const cached = await cache.get(CLOUD_STATUS_CACHE_KEY);
                if (cached) {
                    return res.json({
                        success: true,
                        data: cached,
                        cached: true,
                    });
                }
            } catch (cacheErr) {
                console.warn('[CloudStatus] Cache read failed:', cacheErr.message);
            }
        }

        // Fetch fresh data
        const data = await fetchCloudStatus();

        // Store in cache
        try {
            await cache.set(CLOUD_STATUS_CACHE_KEY, data, { ex: CLOUD_STATUS_CACHE_TTL });
        } catch (cacheErr) {
            console.warn('[CloudStatus] Cache write failed:', cacheErr.message);
        }

        res.json({
            success: true,
            data,
            cached: false,
        });
    } catch (error) {
        console.error('[CloudStatus] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch cloud status',
            message: error.message,
        });
    }
});

// ===================
// API Routes — Health
// ===================

app.get('/api/health', async (req, res) => {
    const results = {
        timestamp: new Date().toISOString(),
        checks: {}
    };

    // Check environment variables
    results.checks.env = {
        DATABASE_URL: !!process.env.DATABASE_URL,
        NVD_API_KEY: !!process.env.NVD_API_KEY,
        JWT_SECRET: !!process.env.JWT_SECRET,
    };

    // Check database connection
    try {
        await cache.ping();
        results.checks.database = { success: true };
    } catch (error) {
        results.checks.database = { success: false, error: error.message };
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

app.get('/api/status', async (req, res) => {
    const metadata = await getCacheMetadata();
    res.json({
        status: 'online',
        isRefreshing,
        uptime: process.uptime(),
        lastUpdated: metadata.lastUpdated,
        lastRefreshResult
    });
});

app.post('/api/refresh', async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    const expectedKey = process.env.ADMIN_API_KEY;

    if (expectedKey && apiKey !== expectedKey) {
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

// Clean up expired cache entries and sessions every 6 hours
cron.schedule('0 */6 * * *', async () => {
    console.log('Running expired data cleanup...');
    try {
        await cleanupExpiredCache();
        await cleanupExpiredSessions();
    } catch (err) {
        console.error('Cleanup error:', err.message);
    }
});

// ===================
// Startup
// ===================

async function initialize() {
    console.log('Heimdall Backend Server starting...');
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Assets configured: ${ASSETS.length}`);

    // Initialise database schema (creates tables if they don't exist)
    try {
        await initializeDatabase();
    } catch (err) {
        console.error('FATAL: Database initialisation failed:', err.message);
        process.exit(1);
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
