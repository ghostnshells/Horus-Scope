// Cloud provider region definitions (server-side)
// Mirrors src/data/cloudRegions.js — keep in sync

export const CLOUD_REGIONS = {
    aws: {
        regions: [
            { id: 'us-east-1', patterns: ['n. virginia', 'us-east-1', 'use1'] },
            { id: 'us-east-2', patterns: ['ohio', 'us-east-2', 'use2'] },
            { id: 'us-west-1', patterns: ['n. california', 'us-west-1', 'usw1'] },
            { id: 'us-west-2', patterns: ['oregon', 'us-west-2', 'usw2'] },
            { id: 'ca-central-1', patterns: ['canada', 'ca-central-1', 'cac1'] },
            { id: 'eu-west-1', patterns: ['ireland', 'eu-west-1', 'euw1'] },
            { id: 'eu-west-2', patterns: ['london', 'eu-west-2', 'euw2'] },
            { id: 'eu-central-1', patterns: ['frankfurt', 'eu-central-1', 'euc1'] },
            { id: 'ap-southeast-1', patterns: ['singapore', 'ap-southeast-1', 'apse1'] },
            { id: 'ap-southeast-2', patterns: ['sydney', 'ap-southeast-2', 'apse2'] },
            { id: 'ap-northeast-1', patterns: ['tokyo', 'ap-northeast-1', 'apne1'] },
            { id: 'ap-northeast-2', patterns: ['seoul', 'ap-northeast-2', 'apne2'] },
            { id: 'ap-south-1', patterns: ['mumbai', 'ap-south-1', 'aps1'] },
            { id: 'sa-east-1', patterns: ['sao paulo', 'sa-east-1', 'sae1'] },
            { id: 'me-south-1', patterns: ['bahrain', 'me-south-1'] },
            { id: 'af-south-1', patterns: ['cape town', 'af-south-1'] },
        ],
        defaults: ['us-east-1'],
    },
    gcp: {
        regions: [
            { id: 'us-central1', patterns: ['us-central1', 'iowa'] },
            { id: 'us-east1', patterns: ['us-east1', 'south carolina', 's. carolina'] },
            { id: 'us-east4', patterns: ['us-east4', 'northern virginia'] },
            { id: 'us-west1', patterns: ['us-west1', 'the dalles'] },
            { id: 'us-west4', patterns: ['us-west4', 'las vegas'] },
            { id: 'europe-west1', patterns: ['europe-west1', 'belgium', 'st. ghislain'] },
            { id: 'europe-west2', patterns: ['europe-west2', 'london'] },
            { id: 'europe-west3', patterns: ['europe-west3', 'frankfurt'] },
            { id: 'asia-east1', patterns: ['asia-east1', 'taiwan', 'changhua'] },
            { id: 'asia-northeast1', patterns: ['asia-northeast1', 'tokyo'] },
            { id: 'asia-southeast1', patterns: ['asia-southeast1', 'singapore', 'jurong'] },
            { id: 'australia-southeast1', patterns: ['australia-southeast1', 'sydney'] },
            { id: 'southamerica-east1', patterns: ['southamerica-east1', 'sao paulo'] },
        ],
        defaults: ['us-central1'],
    },
    azure: {
        regions: [
            { id: 'eastus', patterns: ['east us', 'eastus', 'virginia'] },
            { id: 'eastus2', patterns: ['east us 2', 'eastus2'] },
            { id: 'westus', patterns: ['west us', 'westus', 'california'] },
            { id: 'westus2', patterns: ['west us 2', 'westus2', 'washington'] },
            { id: 'westus3', patterns: ['west us 3', 'westus3', 'arizona'] },
            { id: 'centralus', patterns: ['central us', 'centralus', 'iowa'] },
            { id: 'northcentralus', patterns: ['north central us', 'northcentralus', 'illinois'] },
            { id: 'southcentralus', patterns: ['south central us', 'southcentralus', 'texas'] },
            { id: 'canadacentral', patterns: ['canada central', 'canadacentral', 'toronto'] },
            { id: 'northeurope', patterns: ['north europe', 'northeurope', 'ireland'] },
            { id: 'westeurope', patterns: ['west europe', 'westeurope', 'netherlands'] },
            { id: 'uksouth', patterns: ['uk south', 'uksouth', 'london'] },
            { id: 'southeastasia', patterns: ['southeast asia', 'southeastasia', 'singapore'] },
            { id: 'eastasia', patterns: ['east asia', 'eastasia', 'hong kong'] },
            { id: 'japaneast', patterns: ['japan east', 'japaneast', 'tokyo'] },
            { id: 'australiaeast', patterns: ['australia east', 'australiaeast', 'sydney'] },
            { id: 'brazilsouth', patterns: ['brazil south', 'brazilsouth', 'sao paulo'] },
        ],
        defaults: ['eastus'],
    },
};

const VALID_REGION_IDS = new Map();
for (const [provider, config] of Object.entries(CLOUD_REGIONS)) {
    VALID_REGION_IDS.set(provider, new Set(config.regions.map(r => r.id)));
}

export function isValidRegion(provider, regionId) {
    return VALID_REGION_IDS.get(provider)?.has(regionId) || false;
}

export function getDefaultRegions() {
    const defaults = {};
    for (const [provider, config] of Object.entries(CLOUD_REGIONS)) {
        defaults[provider] = config.defaults;
    }
    return defaults;
}

// Regex patterns to detect region codes in text even if not in our predefined list
const REGION_CODE_PATTERNS = {
    aws: /\b([a-z]{2}-(?:north|south|east|west|central|northeast|southeast|northwest|southwest)\w*-\d)\b/gi,
    gcp: /\b((?:us|europe|asia|australia|southamerica|northamerica|me)-\w+-?\w*\d)\b/gi,
    azure: /\b(east\s*us\s*\d?|west\s*us\s*\d?|central\s*us|north\s*(?:central\s*us|europe)|south\s*(?:central\s*us|east\s*asia)|west\s*europe|uk\s*south|japan\s*east|australia\s*east|brazil\s*south|east\s*asia|southeast\s*asia|canada\s*central)\b/gi,
};

/**
 * Match text against all regions for a provider, return matched region IDs.
 * Also detects region codes not in our predefined list so they don't get tagged as 'global'.
 */
export function matchRegions(provider, text) {
    const config = CLOUD_REGIONS[provider];
    if (!config || !text) return [];
    const lower = text.toLowerCase();
    const matched = new Set();

    // Match against our predefined regions
    for (const region of config.regions) {
        if (region.patterns.some(p => lower.includes(p))) {
            matched.add(region.id);
        }
    }

    // Also scan for region-code-like patterns to catch regions not in our list
    // (e.g., me-central-1, af-south-1). These get added as raw IDs so they
    // won't match a user's selected regions and thus get filtered out properly.
    const codePattern = REGION_CODE_PATTERNS[provider];
    if (codePattern) {
        let m;
        codePattern.lastIndex = 0;
        while ((m = codePattern.exec(lower)) !== null) {
            matched.add(m[1].replace(/\s+/g, ''));
        }
    }

    return Array.from(matched);
}
