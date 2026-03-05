// Vercel Serverless Function — serves cloud provider status data
// Caches in Redis with 5-min TTL, falls back to fresh fetch

import { fetchCloudStatus } from '../server/lib/cloudStatusService.js';

// Optional Redis import — cloud status works without Redis (no hard dependency)
let redis = null;
try {
    const redisModule = await import('../server/lib/redis.js');
    redis = redisModule.redis;
} catch {
    // Redis not configured — will always fetch fresh
}

const CACHE_KEY = 'cloud:status';
const CACHE_TTL = 300; // 5 minutes

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const forceRefresh = req.query.refresh === 'true';

        // Try cache first
        if (!forceRefresh && redis) {
            try {
                const cached = await redis.get(CACHE_KEY);
                if (cached) {
                    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
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

        // Cache result
        if (redis) {
            try {
                await redis.set(CACHE_KEY, data, { ex: CACHE_TTL });
            } catch (cacheErr) {
                console.warn('[CloudStatus] Cache write failed:', cacheErr.message);
            }
        }

        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
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
}
