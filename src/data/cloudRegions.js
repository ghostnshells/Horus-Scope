// Cloud provider region definitions
// Used by both Settings UI and backend incident filtering

export const CLOUD_REGIONS = {
    aws: {
        name: 'Amazon Web Services',
        regions: [
            { id: 'us-east-1', name: 'US East (N. Virginia)', patterns: ['n. virginia', 'us-east-1', 'use1'] },
            { id: 'us-east-2', name: 'US East (Ohio)', patterns: ['ohio', 'us-east-2', 'use2'] },
            { id: 'us-west-1', name: 'US West (N. California)', patterns: ['n. california', 'us-west-1', 'usw1'] },
            { id: 'us-west-2', name: 'US West (Oregon)', patterns: ['oregon', 'us-west-2', 'usw2'] },
            { id: 'ca-central-1', name: 'Canada (Central)', patterns: ['canada', 'ca-central-1', 'cac1'] },
            { id: 'eu-west-1', name: 'EU West (Ireland)', patterns: ['ireland', 'eu-west-1', 'euw1'] },
            { id: 'eu-west-2', name: 'EU West (London)', patterns: ['london', 'eu-west-2', 'euw2'] },
            { id: 'eu-central-1', name: 'EU Central (Frankfurt)', patterns: ['frankfurt', 'eu-central-1', 'euc1'] },
            { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', patterns: ['singapore', 'ap-southeast-1', 'apse1'] },
            { id: 'ap-southeast-2', name: 'Asia Pacific (Sydney)', patterns: ['sydney', 'ap-southeast-2', 'apse2'] },
            { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)', patterns: ['tokyo', 'ap-northeast-1', 'apne1'] },
            { id: 'ap-northeast-2', name: 'Asia Pacific (Seoul)', patterns: ['seoul', 'ap-northeast-2', 'apne2'] },
            { id: 'ap-south-1', name: 'Asia Pacific (Mumbai)', patterns: ['mumbai', 'ap-south-1', 'aps1'] },
            { id: 'sa-east-1', name: 'South America (Sao Paulo)', patterns: ['sao paulo', 'sa-east-1', 'sae1'] },
            { id: 'me-south-1', name: 'Middle East (Bahrain)', patterns: ['bahrain', 'me-south-1'] },
            { id: 'af-south-1', name: 'Africa (Cape Town)', patterns: ['cape town', 'af-south-1'] },
        ],
        defaults: ['us-east-1'],
    },
    gcp: {
        name: 'Google Cloud Platform',
        regions: [
            { id: 'us-central1', name: 'Iowa (us-central1)', patterns: ['us-central1', 'iowa'] },
            { id: 'us-east1', name: 'S. Carolina (us-east1)', patterns: ['us-east1', 'south carolina', 's. carolina'] },
            { id: 'us-east4', name: 'N. Virginia (us-east4)', patterns: ['us-east4', 'northern virginia'] },
            { id: 'us-west1', name: 'Oregon (us-west1)', patterns: ['us-west1', 'the dalles'] },
            { id: 'us-west4', name: 'Las Vegas (us-west4)', patterns: ['us-west4', 'las vegas'] },
            { id: 'europe-west1', name: 'Belgium (europe-west1)', patterns: ['europe-west1', 'belgium', 'st. ghislain'] },
            { id: 'europe-west2', name: 'London (europe-west2)', patterns: ['europe-west2', 'london'] },
            { id: 'europe-west3', name: 'Frankfurt (europe-west3)', patterns: ['europe-west3', 'frankfurt'] },
            { id: 'asia-east1', name: 'Taiwan (asia-east1)', patterns: ['asia-east1', 'taiwan', 'changhua'] },
            { id: 'asia-northeast1', name: 'Tokyo (asia-northeast1)', patterns: ['asia-northeast1', 'tokyo'] },
            { id: 'asia-southeast1', name: 'Singapore (asia-southeast1)', patterns: ['asia-southeast1', 'singapore', 'jurong'] },
            { id: 'australia-southeast1', name: 'Sydney (australia-southeast1)', patterns: ['australia-southeast1', 'sydney'] },
            { id: 'southamerica-east1', name: 'Sao Paulo (southamerica-east1)', patterns: ['southamerica-east1', 'sao paulo'] },
        ],
        defaults: ['us-central1'],
    },
    azure: {
        name: 'Microsoft Azure',
        regions: [
            { id: 'eastus', name: 'East US', patterns: ['east us', 'eastus', 'virginia'] },
            { id: 'eastus2', name: 'East US 2', patterns: ['east us 2', 'eastus2'] },
            { id: 'westus', name: 'West US', patterns: ['west us', 'westus', 'california'] },
            { id: 'westus2', name: 'West US 2', patterns: ['west us 2', 'westus2', 'washington'] },
            { id: 'westus3', name: 'West US 3', patterns: ['west us 3', 'westus3', 'arizona'] },
            { id: 'centralus', name: 'Central US', patterns: ['central us', 'centralus', 'iowa'] },
            { id: 'northcentralus', name: 'North Central US', patterns: ['north central us', 'northcentralus', 'illinois'] },
            { id: 'southcentralus', name: 'South Central US', patterns: ['south central us', 'southcentralus', 'texas'] },
            { id: 'canadacentral', name: 'Canada Central', patterns: ['canada central', 'canadacentral', 'toronto'] },
            { id: 'northeurope', name: 'North Europe', patterns: ['north europe', 'northeurope', 'ireland'] },
            { id: 'westeurope', name: 'West Europe', patterns: ['west europe', 'westeurope', 'netherlands'] },
            { id: 'uksouth', name: 'UK South', patterns: ['uk south', 'uksouth', 'london'] },
            { id: 'southeastasia', name: 'Southeast Asia', patterns: ['southeast asia', 'southeastasia', 'singapore'] },
            { id: 'eastasia', name: 'East Asia', patterns: ['east asia', 'eastasia', 'hong kong'] },
            { id: 'japaneast', name: 'Japan East', patterns: ['japan east', 'japaneast', 'tokyo'] },
            { id: 'australiaeast', name: 'Australia East', patterns: ['australia east', 'australiaeast', 'sydney'] },
            { id: 'brazilsouth', name: 'Brazil South', patterns: ['brazil south', 'brazilsouth', 'sao paulo'] },
        ],
        defaults: ['eastus'],
    },
};

// Provider IDs that support region selection (M365 is global-only)
export const REGION_PROVIDERS = ['aws', 'gcp', 'azure'];

// Get default regions for all providers
export function getDefaultRegions() {
    const defaults = {};
    for (const [provider, config] of Object.entries(CLOUD_REGIONS)) {
        defaults[provider] = config.defaults;
    }
    return defaults;
}

// Validate region IDs for a provider
export function isValidRegion(provider, regionId) {
    const config = CLOUD_REGIONS[provider];
    if (!config) return false;
    return config.regions.some(r => r.id === regionId);
}
