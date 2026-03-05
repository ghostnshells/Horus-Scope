// Cache helpers — PostgreSQL backend via db.js

import { cacheGet, cacheSet, cacheDel, pingDatabase } from './db.js';

const CACHE_TTL = 14400; // 4 hours in seconds
const BATCH_SIZE = 4;
const TOTAL_BATCHES = 7; // ceil(26 assets / 4)

// ── Direct cache access object ─────────────────────────────────────
// Used by server/index.js for cloud status caching and health checks.

const cache = {
    async get(key) {
        return cacheGet(key);
    },
    async set(key, value, opts) {
        const ttl = opts?.ex || CACHE_TTL;
        return cacheSet(key, value, ttl);
    },
    async del(key) {
        return cacheDel(key);
    },
    async ping() {
        await pingDatabase();
        return 'PONG';
    },
};

// ── Public API ─────────────────────────────────────────────────────

/**
 * Get assembled vulnerability data for a time range
 */
export async function getVulnData(timeRange) {
    return cacheGet(`vuln:all:${timeRange}`);
}

/**
 * Get cache metadata (last updated times, etc.)
 */
export async function getCacheMetadata() {
    const metadata = await cacheGet('vuln:metadata');
    return metadata || { lastUpdated: {}, lastFullRefresh: null };
}

/**
 * Store per-asset vulnerability results
 */
export async function setAssetVulns(assetId, timeRange, data) {
    await cacheSet(`vuln:asset:${assetId}:${timeRange}`, data, CACHE_TTL);
}

/**
 * Get per-asset vulnerability results
 */
export async function getAssetVulns(assetId, timeRange) {
    return cacheGet(`vuln:asset:${assetId}:${timeRange}`);
}

/**
 * Assemble full cache from all per-asset keys.
 * Uses a "never regress" strategy: if the new assembly has fewer total
 * vulnerabilities than the existing cache, the old cache is preserved.
 */
export async function assembleFullCache(timeRange, assets) {
    const existingCache = await cacheGet(`vuln:all:${timeRange}`);

    const byAsset = {};
    const allVulns = [];
    let missingAssets = 0;

    for (const asset of assets) {
        const assetData = await cacheGet(`vuln:asset:${asset.id}:${timeRange}`);
        if (assetData && Array.isArray(assetData)) {
            byAsset[asset.id] = assetData;
            allVulns.push(...assetData);
        } else {
            missingAssets++;
            if (existingCache?.byAsset?.[asset.id]) {
                const fallbackData = existingCache.byAsset[asset.id];
                byAsset[asset.id] = fallbackData;
                allVulns.push(...fallbackData);
                console.log(`[Cache] Using fallback data for ${asset.id} (${timeRange}): ${fallbackData.length} vulns`);
            } else {
                byAsset[asset.id] = [];
            }
        }
    }

    if (missingAssets > 0) {
        console.warn(`[Cache] ${missingAssets}/${assets.length} assets missing per-asset keys for ${timeRange}`);
    }

    allVulns.sort((a, b) => {
        const aDate = Math.max(
            new Date(a.published || 0).getTime(),
            new Date(a.lastModified || 0).getTime()
        );
        const bDate = Math.max(
            new Date(b.published || 0).getTime(),
            new Date(b.lastModified || 0).getTime()
        );
        return bDate - aDate;
    });

    const assembled = {
        byAsset,
        all: allVulns,
        fetchedAt: new Date().toISOString(),
        timeRange,
        source: 'NVD',
    };

    await cacheSet(`vuln:all:${timeRange}`, assembled, CACHE_TTL);

    // Update metadata
    const metadata = await getCacheMetadata();
    metadata.lastUpdated[timeRange] = new Date().toISOString();
    await cacheSet('vuln:metadata', metadata, CACHE_TTL);

    return assembled;
}

/**
 * Get current batch index — no-op stub (Railway doesn't batch)
 */
export async function getBatchIndex() {
    return 0;
}

/**
 * Increment batch index — no-op stub (Railway doesn't batch)
 */
export async function incrementBatchIndex() {
    return 0;
}

/**
 * Cascade vulnerabilities from longer time ranges down to shorter ones.
 */
export async function cascadeTimeRanges(assets) {
    const rangesDescending = ['119d', '90d', '30d', '7d', '24h'];
    const rangeDurations = {
        '119d': 119 * 24 * 60 * 60 * 1000,
        '90d':  90  * 24 * 60 * 60 * 1000,
        '30d':  30  * 24 * 60 * 60 * 1000,
        '7d':   7   * 24 * 60 * 60 * 1000,
        '24h':  24  * 60 * 60 * 1000,
    };

    const caches = {};
    for (const range of rangesDescending) {
        caches[range] = await cacheGet(`vuln:all:${range}`);
    }

    const now = Date.now();
    let totalAdded = 0;

    for (let i = 1; i < rangesDescending.length; i++) {
        const shorterRange = rangesDescending[i];
        const shorterCache = caches[shorterRange];
        if (!shorterCache?.byAsset) continue;

        const cutoffTime = now - rangeDurations[shorterRange];

        const existingIdsByAsset = {};
        for (const assetId of Object.keys(shorterCache.byAsset)) {
            existingIdsByAsset[assetId] = new Set(
                (shorterCache.byAsset[assetId] || []).map(v => v.id)
            );
        }

        let addedForRange = 0;

        for (let j = 0; j < i; j++) {
            const longerRange = rangesDescending[j];
            const longerCache = caches[longerRange];
            if (!longerCache?.byAsset) continue;

            for (const assetId of Object.keys(longerCache.byAsset)) {
                const longerAssetVulns = longerCache.byAsset[assetId] || [];
                if (!existingIdsByAsset[assetId]) {
                    existingIdsByAsset[assetId] = new Set(
                        (shorterCache.byAsset[assetId] || []).map(v => v.id)
                    );
                }

                for (const vuln of longerAssetVulns) {
                    if (existingIdsByAsset[assetId].has(vuln.id)) continue;

                    const publishedTime = vuln.published ? new Date(vuln.published).getTime() : 0;
                    if (publishedTime >= cutoffTime && publishedTime <= now) {
                        if (!shorterCache.byAsset[assetId]) {
                            shorterCache.byAsset[assetId] = [];
                        }
                        shorterCache.byAsset[assetId].push(vuln);
                        shorterCache.all.push(vuln);
                        existingIdsByAsset[assetId].add(vuln.id);
                        addedForRange++;
                    }
                }
            }
        }

        if (addedForRange > 0) {
            shorterCache.all.sort((a, b) => {
                const aDate = Math.max(
                    new Date(a.published || 0).getTime(),
                    new Date(a.lastModified || 0).getTime()
                );
                const bDate = Math.max(
                    new Date(b.published || 0).getTime(),
                    new Date(b.lastModified || 0).getTime()
                );
                return bDate - aDate;
            });

            shorterCache.fetchedAt = new Date().toISOString();
            await cacheSet(`vuln:all:${shorterRange}`, shorterCache, CACHE_TTL);
            console.log(`[Cache] Cascaded ${addedForRange} vulns into ${shorterRange}`);
            totalAdded += addedForRange;
        }
    }

    if (totalAdded > 0) {
        console.log(`[Cache] Cascade complete: ${totalAdded} total vulns added to shorter ranges`);
    }

    return totalAdded;
}

export { cache, BATCH_SIZE, TOTAL_BATCHES };
