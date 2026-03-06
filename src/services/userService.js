// User profile and asset customization service

import { fetchWithAuth } from './authService';

const USER_API = '/api/user';

export async function getUserProfile() {
    const response = await fetchWithAuth(`${USER_API}/profile`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to get profile');
    return data.user;
}

export async function getUserAssets() {
    const response = await fetchWithAuth(`${USER_API}/assets`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to get assets');
    return data.assets; // null = no preferences (show all), or array of IDs
}

export async function setUserAssets(assetIds) {
    const response = await fetchWithAuth(`${USER_API}/assets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetIds })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to save assets');
    return data.assets;
}

export async function getCloudRegions() {
    const response = await fetchWithAuth(`${USER_API}/cloud-regions`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to get cloud regions');
    return data.regions; // null = no preferences (use defaults), or { aws: [...], gcp: [...], azure: [...] }
}

export async function setCloudRegions(regions) {
    const response = await fetchWithAuth(`${USER_API}/cloud-regions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regions })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to save cloud regions');
    return data.regions;
}
