// User cloud region preferences service

import pool from './db.js';
import { CLOUD_REGIONS, isValidRegion } from './cloudRegions.js';

const VALID_PROVIDERS = new Set(Object.keys(CLOUD_REGIONS));

/**
 * Get user's selected cloud regions, or null if no preferences set (= use defaults)
 * Returns: { aws: ['us-east-1', ...], gcp: [...], azure: [...] } | null
 */
export async function getUserCloudRegions(email) {
    const { rows } = await pool.query(
        `SELECT provider, region FROM user_cloud_regions WHERE user_email = $1 ORDER BY provider, created_at`,
        [email]
    );
    if (rows.length === 0) return null;

    const result = {};
    for (const row of rows) {
        if (!result[row.provider]) result[row.provider] = [];
        result[row.provider].push(row.region);
    }
    return result;
}

/**
 * Set user's selected cloud regions (replaces all previous selections)
 * @param {string} email
 * @param {{ [provider: string]: string[] }} regionsByProvider
 */
export async function setUserCloudRegions(email, regionsByProvider) {
    // Validate
    for (const [provider, regions] of Object.entries(regionsByProvider)) {
        if (!VALID_PROVIDERS.has(provider)) {
            throw new Error(`Invalid provider: ${provider}`);
        }
        if (!Array.isArray(regions)) {
            throw new Error(`Regions for ${provider} must be an array`);
        }
        for (const regionId of regions) {
            if (!isValidRegion(provider, regionId)) {
                throw new Error(`Invalid region ${regionId} for provider ${provider}`);
            }
        }
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM user_cloud_regions WHERE user_email = $1`, [email]);

        for (const [provider, regions] of Object.entries(regionsByProvider)) {
            if (regions.length > 0) {
                const values = regions.map((_, i) => `($1, $2, $${i + 3})`).join(', ');
                await client.query(
                    `INSERT INTO user_cloud_regions (user_email, provider, region) VALUES ${values}`,
                    [email, provider, ...regions]
                );
            }
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    return regionsByProvider;
}
