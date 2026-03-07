// Cloud Status Service — fetches AWS, GCP, Azure status feeds
// Normalizes into a unified data model with daily status and incidents

import { XMLParser } from 'fast-xml-parser';
import { matchRegions } from './cloudRegions.js';

const FEEDS = {
    aws: {
        id: 'aws',
        name: 'Amazon Web Services',
        url: 'https://status.aws.amazon.com/',
        feedUrl: 'https://status.aws.amazon.com/rss/all.rss',
        type: 'rss',
    },
    gcp: {
        id: 'gcp',
        name: 'Google Cloud Platform',
        url: 'https://status.cloud.google.com/',
        feedUrl: 'https://status.cloud.google.com/incidents.json',
        type: 'json',
    },
    azure: {
        id: 'azure',
        name: 'Microsoft Azure',
        url: 'https://status.azure.com/',
        feedUrl: 'https://azure.status.microsoft.com/en-us/status/feed/',
        type: 'rss',
    },
    m365: {
        id: 'm365',
        name: 'Microsoft 365',
        url: 'https://status.cloud.microsoft/m365',
        feedUrl: 'https://status.cloud.microsoft/api/posts/m365Consumer',
        type: 'm365json',
    },
};

const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
});

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Fetch and parse a single feed with timeout
 */
async function fetchFeed(url, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'HorusScope/1.0' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        return text;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Determine severity from title/description text
 */
function inferSeverity(text) {
    const lower = (text || '').toLowerCase();
    if (lower.includes('outage') || lower.includes('disruption') || lower.includes('unavailable')) return 'major';
    if (lower.includes('degraded') || lower.includes('elevated') || lower.includes('errors') || lower.includes('latency')) return 'minor';
    return 'info';
}

/**
 * Determine incident status from text
 */
function inferStatus(text) {
    const lower = (text || '').toLowerCase();
    if (lower.includes('resolved') || lower.includes('restored') || lower.includes('[resolved]')) return 'resolved';
    if (lower.includes('monitoring') || lower.includes('[monitoring]')) return 'monitoring';
    if (lower.includes('investigating') || lower.includes('[investigating]')) return 'investigating';
    if (lower.includes('identified') || lower.includes('[identified]')) return 'identified';
    return 'investigating';
}

/**
 * Extract affected services from text
 */
function extractServices(title, description) {
    const services = [];
    // Try to get service from common patterns like "Service Name - issue description"
    const dashMatch = (title || '').match(/^([^-–]+)[–-]/);
    if (dashMatch) {
        services.push(dashMatch[1].trim());
    }
    return services;
}

// ============ AWS ============

function parseAWSFeed(xmlText) {
    const parsed = xmlParser.parse(xmlText);
    const channel = parsed?.rss?.channel;
    if (!channel) return [];

    const items = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];
    const cutoff = Date.now() - FOURTEEN_DAYS_MS;

    return items
        .map(item => {
            const pubDate = new Date(item.pubDate || item.pubdate);
            if (isNaN(pubDate.getTime())) return null;
            if (pubDate.getTime() < cutoff) return null;

            const title = item.title || '';
            const description = item.description || '';
            const status = inferStatus(title + ' ' + description);

            const regions = matchRegions('aws', title + ' ' + description);

            return {
                id: `aws-${pubDate.getTime()}-${title.slice(0, 20).replace(/\W/g, '')}`,
                title: title,
                description: description.replace(/<[^>]*>/g, '').trim(),
                status,
                severity: inferSeverity(title + ' ' + description),
                created: pubDate.toISOString(),
                resolved: status === 'resolved' ? pubDate.toISOString() : null,
                affectedServices: extractServices(title, description),
                regions: regions.length > 0 ? regions : ['global'],
                updates: [{
                    timestamp: pubDate.toISOString(),
                    message: description.replace(/<[^>]*>/g, '').trim(),
                }],
            };
        })
        .filter(Boolean);
}

// ============ GCP ============

function parseGCPFeed(jsonText) {
    let data;
    try {
        data = JSON.parse(jsonText);
    } catch {
        return [];
    }

    const incidents = Array.isArray(data) ? data : [];
    const cutoff = Date.now() - FOURTEEN_DAYS_MS;

    return incidents
        .map(inc => {
            const created = new Date(inc.begin || inc.created);
            if (isNaN(created.getTime())) return null;
            if (created.getTime() < cutoff) return null;

            const updates = (inc.updates || []).map(u => ({
                timestamp: new Date(u.when || u.created).toISOString(),
                message: (u.text || u.update || '').replace(/<[^>]*>/g, '').trim(),
            }));

            const latestUpdate = updates[0]?.message || '';
            const severity = inc.severity === 'high' ? 'major' : inc.severity === 'medium' ? 'minor' : 'info';
            const isResolved = inc.end || inc.status_impact === 'SERVICE_DISRUPTION_GONE';

            const affectedProducts = (inc.affected_products || []).map(p => p.title || p);
            const regionText = affectedProducts.join(' ') + ' ' + (inc.external_desc || '');
            const regions = matchRegions('gcp', regionText);

            return {
                id: `gcp-${inc.id || inc.number || created.getTime()}`,
                title: inc.external_desc || inc.service_name || 'GCP Incident',
                description: inc.external_desc || latestUpdate,
                status: isResolved ? 'resolved' : inferStatus(latestUpdate),
                severity: severity,
                created: created.toISOString(),
                resolved: inc.end ? new Date(inc.end).toISOString() : null,
                affectedServices: affectedProducts,
                regions: regions.length > 0 ? regions : ['global'],
                updates,
            };
        })
        .filter(Boolean);
}

// ============ Azure ============

function parseAzureFeed(xmlText) {
    const parsed = xmlParser.parse(xmlText);

    // Azure uses Atom feed format
    const feed = parsed?.feed || parsed?.rss?.channel;
    if (!feed) return [];

    let entries = feed.entry || feed.item;
    if (!entries) return [];
    entries = Array.isArray(entries) ? entries : [entries];

    const cutoff = Date.now() - FOURTEEN_DAYS_MS;

    return entries
        .map(entry => {
            const published = new Date(entry.published || entry.updated || entry.pubDate || entry.pubdate);
            if (isNaN(published.getTime())) return null;
            if (published.getTime() < cutoff) return null;

            const title = (typeof entry.title === 'object' ? entry.title['#text'] : entry.title) || '';
            const content = (typeof entry.content === 'object' ? entry.content['#text'] : entry.content) || entry.description || '';
            const cleanContent = content.replace(/<[^>]*>/g, '').trim();
            const status = inferStatus(title + ' ' + cleanContent);

            const regions = matchRegions('azure', title + ' ' + cleanContent);

            return {
                id: `azure-${entry.id || published.getTime()}-${title.slice(0, 20).replace(/\W/g, '')}`,
                title,
                description: cleanContent.slice(0, 500),
                status,
                severity: inferSeverity(title + ' ' + cleanContent),
                created: published.toISOString(),
                resolved: status === 'resolved' ? published.toISOString() : null,
                affectedServices: extractServices(title, cleanContent),
                regions: regions.length > 0 ? regions : ['global'],
                updates: [{
                    timestamp: published.toISOString(),
                    message: cleanContent.slice(0, 500),
                }],
            };
        })
        .filter(Boolean);
}

// ============ Microsoft 365 ============

function parseM365Feed(jsonText) {
    let services;
    try {
        services = JSON.parse(jsonText);
    } catch {
        return [];
    }

    if (!Array.isArray(services)) return [];

    const now = new Date();
    const incidents = [];

    for (const svc of services) {
        const status = (svc.Status || '').toLowerCase();
        // Only create incidents for non-operational services
        if (status === 'operational' || status === 'available') continue;

        const updated = new Date(svc.LastUpdatedTime || svc.InternalDateTime);
        if (isNaN(updated.getTime())) continue;

        const title = svc.Title
            ? `${svc.ServiceDisplayName} - ${svc.Title}`
            : `${svc.ServiceDisplayName} - ${svc.Status}`;
        const message = (svc.Message || '').replace(/<[^>]*>/g, '').trim();

        let severity = 'info';
        const statusLower = status;
        if (statusLower.includes('disruption') || statusLower.includes('outage') || statusLower.includes('down')) {
            severity = 'major';
        } else if (statusLower.includes('degraded') || statusLower.includes('advisory') || statusLower.includes('investigating')) {
            severity = 'minor';
        }

        incidents.push({
            id: `m365-${svc.Id || svc.ServiceWorkloadName}-${updated.getTime()}`,
            title,
            description: message || `${svc.ServiceDisplayName} is currently reporting: ${svc.Status}`,
            status: statusLower.includes('resolved') || statusLower.includes('restored') ? 'resolved' : 'investigating',
            severity,
            created: (svc.AuthoredDateTime && svc.AuthoredDateTime !== '0001-01-01T00:00:00+00:00')
                ? new Date(svc.AuthoredDateTime).toISOString()
                : updated.toISOString(),
            resolved: null,
            affectedServices: [svc.ServiceDisplayName],
            regions: ['global'],
            updates: message ? [{
                timestamp: updated.toISOString(),
                message,
            }] : [],
        });
    }

    return incidents;
}

// ============ Daily Status Computation ============

/**
 * Build a 14-day daily status array from incidents
 */
export function computeDailyStatus(incidents) {
    const days = [];
    const now = new Date();

    for (let i = 13; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayStart = new Date(dateStr + 'T00:00:00Z').getTime();
        const dayEnd = new Date(dateStr + 'T23:59:59.999Z').getTime();

        // Find incidents that overlap this day
        const dayIncidents = incidents.filter(inc => {
            const created = new Date(inc.created).getTime();
            // Use the latest known timestamp as the end bound:
            // resolved date, last update timestamp, or creation date itself.
            // Do NOT default to Date.now() — that makes a single-day incident
            // span every day from creation until today.
            let end = created;
            if (inc.resolved) {
                end = new Date(inc.resolved).getTime();
            } else if (inc.updates?.length > 0) {
                const lastUpdate = new Date(inc.updates[inc.updates.length - 1].timestamp).getTime();
                if (lastUpdate > end) end = lastUpdate;
            }
            return created <= dayEnd && end >= dayStart;
        });

        let status = 'operational';
        if (dayIncidents.some(inc => inc.severity === 'major')) {
            status = 'outage';
        } else if (dayIncidents.some(inc => inc.severity === 'minor')) {
            status = 'degraded';
        } else if (dayIncidents.length > 0) {
            status = 'degraded';
        }

        days.push({
            date: dateStr,
            status,
            incidentCount: dayIncidents.length,
        });
    }

    return days;
}

/**
 * Compute overall status from daily status
 */
export function computeOverallStatus(dailyStatus, incidents) {
    // Check truly active incidents — unresolved AND with recent activity (last 24h)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const activeIncidents = incidents.filter(inc => {
        if (inc.status === 'resolved') return false;
        // Consider active only if created or last updated within the past 24h
        const lastActivity = inc.updates?.length > 0
            ? new Date(inc.updates[inc.updates.length - 1].timestamp).getTime()
            : new Date(inc.created).getTime();
        return lastActivity >= oneDayAgo;
    });
    if (activeIncidents.some(inc => inc.severity === 'major')) return 'outage';
    if (activeIncidents.length > 0) return 'degraded';

    // Check last 24 hours from daily status
    const today = dailyStatus[dailyStatus.length - 1];
    if (today?.status === 'outage') return 'outage';
    if (today?.status === 'degraded') return 'degraded';

    return 'operational';
}

// ============ Main Entry Point ============

/**
 * Fetch all cloud provider statuses in parallel
 * Returns normalized data model
 */
export async function fetchCloudStatus() {
    const results = await Promise.allSettled([
        fetchFeed(FEEDS.aws.feedUrl).then(text => ({ provider: 'aws', incidents: parseAWSFeed(text) })),
        fetchFeed(FEEDS.gcp.feedUrl).then(text => ({ provider: 'gcp', incidents: parseGCPFeed(text) })),
        fetchFeed(FEEDS.azure.feedUrl).then(text => ({ provider: 'azure', incidents: parseAzureFeed(text) })),
        fetchFeed(FEEDS.m365.feedUrl).then(text => ({ provider: 'm365', incidents: parseM365Feed(text) })),
    ]);

    const providers = {};
    const providerIds = ['aws', 'gcp', 'azure', 'm365'];

    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        let providerId, incidents;

        if (result.status === 'fulfilled') {
            providerId = result.value.provider;
            incidents = result.value.incidents;
        } else {
            providerId = providerIds[i];
            incidents = [];
            console.error(`[CloudStatus] Failed to fetch ${providerId}:`, result.reason?.message);
        }

        const feed = FEEDS[providerId];
        const dailyStatus = computeDailyStatus(incidents);
        const overallStatus = computeOverallStatus(dailyStatus, incidents);

        providers[providerId] = {
            id: providerId,
            name: feed.name,
            url: feed.url,
            overallStatus,
            incidents: incidents.sort((a, b) => new Date(b.created) - new Date(a.created)),
            dailyStatus,
            lastChecked: new Date().toISOString(),
        };
    }

    return {
        providers,
        fetchedAt: new Date().toISOString(),
    };
}
