// Cloud Status Frontend Service
// Fetches /api/cloud-status with memory + localStorage caching (3-min TTL)

const CACHE_KEY_PREFIX = 'horus_scope_cloud_status_v2';
const CACHE_DURATION = 3 * 60 * 1000; // 3 minutes

const API_URL = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api/cloud-status`
    : '/api/cloud-status';

// In-memory cache (keyed by regions string)
const memoryCache = {};

/**
 * Build a stable cache key suffix from regions
 */
function regionsCacheKey(regions) {
    if (!regions) return '_all';
    return '_' + Object.keys(regions).sort()
        .map(p => `${p}:${(regions[p] || []).slice().sort().join(',')}`)
        .join('|');
}

/**
 * Get cached data if valid
 */
function getCached(cacheKeySuffix) {
    const fullKey = CACHE_KEY_PREFIX + cacheKeySuffix;

    // Check memory first
    const mem = memoryCache[fullKey];
    if (mem && Date.now() - mem.timestamp < CACHE_DURATION) {
        return mem.data;
    }

    // Check localStorage
    try {
        const stored = localStorage.getItem(fullKey);
        if (stored) {
            const { timestamp, data } = JSON.parse(stored);
            if (Date.now() - timestamp < CACHE_DURATION) {
                memoryCache[fullKey] = { timestamp, data };
                return data;
            }
            localStorage.removeItem(fullKey);
        }
    } catch {
        // Ignore localStorage errors
    }

    return null;
}

/**
 * Save data to cache
 */
function setCache(cacheKeySuffix, data) {
    const fullKey = CACHE_KEY_PREFIX + cacheKeySuffix;
    const timestamp = Date.now();
    memoryCache[fullKey] = { timestamp, data };

    try {
        localStorage.setItem(fullKey, JSON.stringify({ timestamp, data }));
    } catch {
        // localStorage quota exceeded — memory cache still works
    }
}

/**
 * Build regions query param string from regions object
 * e.g. { aws: ['us-east-1', 'us-west-2'], gcp: ['us-central1'] } => "aws:us-east-1,us-west-2|gcp:us-central1"
 */
function buildRegionsParam(regions) {
    if (!regions) return '';
    return Object.entries(regions)
        .filter(([, ids]) => ids && ids.length > 0)
        .map(([provider, ids]) => `${provider}:${ids.join(',')}`)
        .join('|');
}

/**
 * Fetch cloud status data
 * @param {boolean} forceRefresh - Bypass cache
 * @param {Object} [regions] - Region filter per provider
 * @returns {Promise<Object>} Cloud status data
 */
export async function fetchCloudStatus(forceRefresh = false, regions = null) {
    const keySuffix = regionsCacheKey(regions);

    if (!forceRefresh) {
        const cached = getCached(keySuffix);
        if (cached) return cached;
    }

    const params = new URLSearchParams();
    if (forceRefresh) params.set('refresh', 'true');
    const regionsStr = buildRegionsParam(regions);
    if (regionsStr) params.set('regions', regionsStr);
    const qs = params.toString();
    const url = qs ? `${API_URL}?${qs}` : API_URL;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Cloud status API error: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.message || 'Failed to fetch cloud status');
    }

    setCache(keySuffix, result.data);
    return result.data;
}

/**
 * Clear cloud status cache (all region variants)
 */
export function clearCloudStatusCache() {
    for (const key of Object.keys(memoryCache)) {
        delete memoryCache[key];
    }
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith(CACHE_KEY_PREFIX)) {
                localStorage.removeItem(key);
            }
        }
    } catch {
        // Ignore
    }
}
