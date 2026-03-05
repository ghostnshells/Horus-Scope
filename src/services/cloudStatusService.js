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
 * Fetch cloud status data
 * @param {boolean} forceRefresh - Bypass cache
 * @returns {Promise<Object>} Cloud status data
 */
export async function fetchCloudStatus(forceRefresh = false) {
    if (!forceRefresh) {
        const cached = getCached();
        if (cached) return cached;
    }

    const url = forceRefresh ? `${API_URL}?refresh=true` : API_URL;
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
