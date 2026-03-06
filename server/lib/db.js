// PostgreSQL database layer for Railway deployment

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost')
        ? false
        : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
    console.error('[DB] Unexpected pool error:', err.message);
});

// ── Schema initialisation ──────────────────────────────────────────

export async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS cache (
                key   TEXT PRIMARY KEY,
                value JSONB NOT NULL,
                expires_at TIMESTAMPTZ
            );

            CREATE TABLE IF NOT EXISTS users (
                email         TEXT PRIMARY KEY,
                password_hash TEXT NOT NULL,
                created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS sessions (
                refresh_token TEXT PRIMARY KEY,
                email         TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
                expires_at    TIMESTAMPTZ NOT NULL
            );

            CREATE TABLE IF NOT EXISTS vuln_status (
                user_id    TEXT NOT NULL,
                cve_id     TEXT NOT NULL,
                status     TEXT NOT NULL,
                notes      TEXT DEFAULT '',
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (user_id, cve_id)
            );

            CREATE TABLE IF NOT EXISTS audit_trail (
                id          SERIAL PRIMARY KEY,
                user_id     TEXT NOT NULL,
                cve_id      TEXT NOT NULL,
                from_status TEXT,
                to_status   TEXT NOT NULL,
                notes       TEXT DEFAULT '',
                timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS sla_config (
                user_id  TEXT PRIMARY KEY,
                critical INT NOT NULL DEFAULT 7,
                high     INT NOT NULL DEFAULT 30,
                medium   INT NOT NULL DEFAULT 90,
                low      INT NOT NULL DEFAULT 180
            );

            ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

            CREATE TABLE IF NOT EXISTS email_verification_tokens (
                token_hash TEXT PRIMARY KEY,
                email      TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                token_hash TEXT PRIMARY KEY,
                email      TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
                expires_at TIMESTAMPTZ NOT NULL,
                used       BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS user_assets (
                user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
                asset_id   TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (user_email, asset_id)
            );

            CREATE TABLE IF NOT EXISTS user_cloud_regions (
                user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
                provider   TEXT NOT NULL,
                region     TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (user_email, provider, region)
            );
        `);
        console.log('[DB] Schema initialised');
    } finally {
        client.release();
    }
}

// ── Generic cache helpers ──────────────────────────────────────────

export async function cacheGet(key) {
    const { rows } = await pool.query(
        `SELECT value FROM cache WHERE key = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
        [key]
    );
    return rows.length ? rows[0].value : null;
}

export async function cacheSet(key, value, ttlSeconds) {
    const expiresAt = ttlSeconds
        ? new Date(Date.now() + ttlSeconds * 1000)
        : null;
    await pool.query(
        `INSERT INTO cache (key, value, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET value = $2, expires_at = $3`,
        [key, JSON.stringify(value), expiresAt]
    );
}

export async function cacheDel(key) {
    await pool.query(`DELETE FROM cache WHERE key = $1`, [key]);
}

// ── Cleanup ────────────────────────────────────────────────────────

export async function cleanupExpiredCache() {
    const { rowCount } = await pool.query(
        `DELETE FROM cache WHERE expires_at IS NOT NULL AND expires_at <= NOW()`
    );
    if (rowCount > 0) console.log(`[DB] Cleaned up ${rowCount} expired cache entries`);
}

export async function cleanupExpiredSessions() {
    const { rowCount } = await pool.query(
        `DELETE FROM sessions WHERE expires_at <= NOW()`
    );
    if (rowCount > 0) console.log(`[DB] Cleaned up ${rowCount} expired sessions`);
}

export async function cleanupExpiredTokens() {
    const { rowCount: verif } = await pool.query(
        `DELETE FROM email_verification_tokens WHERE expires_at <= NOW()`
    );
    const { rowCount: reset } = await pool.query(
        `DELETE FROM password_reset_tokens WHERE expires_at <= NOW() OR used = TRUE`
    );
    const total = (verif || 0) + (reset || 0);
    if (total > 0) console.log(`[DB] Cleaned up ${total} expired tokens`);
}

// ── Health check ───────────────────────────────────────────────────

export async function pingDatabase() {
    const { rows } = await pool.query('SELECT 1');
    return rows.length === 1;
}

export default pool;
