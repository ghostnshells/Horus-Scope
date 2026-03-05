// Vulnerability Lifecycle Service — PostgreSQL-backed status tracking, audit trail, and SLA management

import pool from './db.js';

// Valid vulnerability lifecycle statuses
export const STATUSES = ['new', 'acknowledged', 'in_progress', 'patched', 'mitigated', 'accepted_risk', 'false_positive'];

// Default SLA configuration (days until breach per severity)
const DEFAULT_SLA = { critical: 7, high: 30, medium: 90, low: 180 };

/**
 * Get vulnerability status for a user
 */
export async function getVulnStatus(userId, cveId) {
    const { rows } = await pool.query(
        `SELECT status, notes, updated_at FROM vuln_status WHERE user_id = $1 AND cve_id = $2`,
        [userId, cveId]
    );
    if (rows.length === 0) {
        return { status: 'new', updatedAt: null, notes: '' };
    }
    return {
        status: rows[0].status,
        updatedAt: rows[0].updated_at.toISOString(),
        notes: rows[0].notes || ''
    };
}

/**
 * Set vulnerability status with audit trail
 */
export async function setVulnStatus(userId, cveId, status, notes = '') {
    if (!STATUSES.includes(status)) {
        throw new Error(`Invalid status: ${status}. Must be one of: ${STATUSES.join(', ')}`);
    }

    const now = new Date();
    const previous = await getVulnStatus(userId, cveId);

    // Upsert current status
    await pool.query(
        `INSERT INTO vuln_status (user_id, cve_id, status, notes, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, cve_id) DO UPDATE SET status = $3, notes = $4, updated_at = $5`,
        [userId, cveId, status, notes, now]
    );

    // Add audit trail entry
    await pool.query(
        `INSERT INTO audit_trail (user_id, cve_id, from_status, to_status, notes, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, cveId, previous.status, status, notes, now]
    );

    return { status, updatedAt: now.toISOString(), notes };
}

/**
 * Get audit trail for a vulnerability
 */
export async function getAuditTrail(userId, cveId) {
    const { rows } = await pool.query(
        `SELECT from_status, to_status, notes, timestamp
         FROM audit_trail
         WHERE user_id = $1 AND cve_id = $2
         ORDER BY timestamp ASC`,
        [userId, cveId]
    );
    return rows.map(r => ({
        from: r.from_status,
        to: r.to_status,
        notes: r.notes || '',
        timestamp: r.timestamp.toISOString()
    }));
}

/**
 * Get SLA configuration for a user
 */
export async function getSLAConfig(userId) {
    const { rows } = await pool.query(
        `SELECT critical, high, medium, low FROM sla_config WHERE user_id = $1`,
        [userId]
    );
    if (rows.length === 0) return { ...DEFAULT_SLA };
    return {
        critical: rows[0].critical,
        high: rows[0].high,
        medium: rows[0].medium,
        low: rows[0].low
    };
}

/**
 * Set SLA configuration for a user
 */
export async function setSLAConfig(userId, config) {
    const sla = {
        critical: config.critical ?? DEFAULT_SLA.critical,
        high: config.high ?? DEFAULT_SLA.high,
        medium: config.medium ?? DEFAULT_SLA.medium,
        low: config.low ?? DEFAULT_SLA.low
    };
    await pool.query(
        `INSERT INTO sla_config (user_id, critical, high, medium, low)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE SET critical = $2, high = $3, medium = $4, low = $5`,
        [userId, sla.critical, sla.high, sla.medium, sla.low]
    );
    return sla;
}

/**
 * Calculate SLA deadline based on severity and configuration
 */
export function calculateSLADeadline(publishedDate, severity, slaConfig) {
    const config = slaConfig || DEFAULT_SLA;
    const severityKey = severity?.toLowerCase() || 'medium';
    const days = config[severityKey] || config.medium;

    const deadline = new Date(publishedDate);
    deadline.setDate(deadline.getDate() + days);
    return deadline.toISOString();
}

/**
 * Check if SLA is breached
 */
export function isSLABreached(publishedDate, severity, status, slaConfig) {
    const terminalStatuses = ['patched', 'mitigated', 'accepted_risk', 'false_positive'];
    if (terminalStatuses.includes(status)) return false;

    const deadline = new Date(calculateSLADeadline(publishedDate, severity, slaConfig));
    return new Date() > deadline;
}

/**
 * Get days remaining until SLA breach
 */
export function getSLADaysRemaining(publishedDate, severity, slaConfig) {
    const deadline = new Date(calculateSLADeadline(publishedDate, severity, slaConfig));
    const now = new Date();
    return Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
}

/**
 * Bulk get statuses for multiple CVEs (single query)
 */
export async function getBulkStatuses(userId, cveIds) {
    const results = {};
    // Initialise all as 'new'
    for (const id of cveIds) {
        results[id] = { status: 'new', updatedAt: null, notes: '' };
    }

    if (cveIds.length === 0) return results;

    const { rows } = await pool.query(
        `SELECT cve_id, status, notes, updated_at
         FROM vuln_status
         WHERE user_id = $1 AND cve_id = ANY($2)`,
        [userId, cveIds]
    );

    for (const r of rows) {
        results[r.cve_id] = {
            status: r.status,
            updatedAt: r.updated_at.toISOString(),
            notes: r.notes || ''
        };
    }

    return results;
}

/**
 * Bulk set status for multiple CVEs
 */
export async function setBulkStatus(userId, cveIds, status, notes = '') {
    if (!STATUSES.includes(status)) {
        throw new Error(`Invalid status: ${status}`);
    }

    const results = [];
    for (const cveId of cveIds) {
        const result = await setVulnStatus(userId, cveId, status, notes);
        results.push({ cveId, ...result });
    }
    return results;
}
