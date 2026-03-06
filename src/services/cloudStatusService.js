// Cloud Status Frontend Service
// Fetches /api/cloud-status with memory + localStorage caching (3-min TTL)

const CACHE_KEY = 'heimdall_cloud_status_v1';
const CACHE_DURATION = 3 * 60 * 1000; // 3 minutes

const API_URL = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api/cloud-status`
    : '/api/cloud-status';

// In-memory cache
let memoryCache = null;

/**
 * Get cached data if valid
 */
function getCached() {
    // Check memory first
    if (memoryCache && Date.now() - memoryCache.timestamp < CACHE_DURATION) {
        return memoryCache.data;
    }

    // Check localStorage
    try {
        const stored = localStorage.getItem(CACHE_KEY);
        if (stored) {
            const { timestamp, data } = JSON.parse(stored);
            if (Date.now() - timestamp < CACHE_DURATION) {
                memoryCache = { timestamp, data };
                return data;
            }
            localStorage.removeItem(CACHE_KEY);
        }
    } catch {
        // Ignore localStorage errors
    }

    return null;
}

/**
 * Save data to cache
 */
function setCache(data) {
    const timestamp = Date.now();
    memoryCache = { timestamp, data };

    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp, data }));
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
    if (!forceRefresh && !regions) {
        const cached = getCached();
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

    setCache(result.data);
    return result.data;
}

/**
 * Clear cloud status cache
 */
export function clearCloudStatusCache() {
    memoryCache = null;
    try {
        localStorage.removeItem(CACHE_KEY);
    } catch {
        // Ignore
    }
}
