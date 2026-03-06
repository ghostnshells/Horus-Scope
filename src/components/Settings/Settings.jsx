import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, Mail, Shield, Save, Loader } from 'lucide-react';
import { ASSETS } from '../../data/assets';
import { CLOUD_REGIONS, REGION_PROVIDERS, getDefaultRegions } from '../../data/cloudRegions';
import { getUserAssets, setUserAssets, getCloudRegions, setCloudRegions } from '../../services/userService';
import { resendVerification } from '../../services/authService';
import './Settings.css';

// Sorted alphabetically once
const SORTED_ASSETS = [...ASSETS].sort((a, b) => a.name.localeCompare(b.name));

const Settings = ({ user, onBack, onAssetsChanged, onCloudRegionsChanged, onEmailVerified }) => {
    const [selectedAssets, setSelectedAssets] = useState(new Set(ASSETS.map(a => a.id)));
    const [initialAssets, setInitialAssets] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null); // null | 'saved' | 'error'
    const [verificationSent, setVerificationSent] = useState(false);
    const [verificationSending, setVerificationSending] = useState(false);

    // Cloud region state
    const [selectedRegions, setSelectedRegions] = useState(() => {
        const defaults = getDefaultRegions();
        const state = {};
        for (const provider of REGION_PROVIDERS) {
            state[provider] = new Set(defaults[provider]);
        }
        return state;
    });
    const [initialRegions, setInitialRegions] = useState(null);

    // Load user preferences
    useEffect(() => {
        Promise.all([
            getUserAssets().catch(() => null),
            getCloudRegions().catch(() => null),
        ]).then(([assets, regions]) => {
            // Assets
            if (assets) {
                setSelectedAssets(new Set(assets));
                setInitialAssets(new Set(assets));
            } else {
                const all = new Set(ASSETS.map(a => a.id));
                setSelectedAssets(all);
                setInitialAssets(null);
            }

            // Cloud regions
            const defaults = getDefaultRegions();
            if (regions) {
                const state = {};
                for (const provider of REGION_PROVIDERS) {
                    state[provider] = new Set(regions[provider] || defaults[provider]);
                }
                setSelectedRegions(state);
                setInitialRegions(regions);
            } else {
                setInitialRegions(null);
            }
        }).finally(() => setIsLoading(false));
    }, []);

    const toggleAsset = (assetId) => {
        setSelectedAssets(prev => {
            const next = new Set(prev);
            if (next.has(assetId)) {
                next.delete(assetId);
            } else {
                next.add(assetId);
            }
            return next;
        });
        setSaveStatus(null);
    };

    const selectAll = () => {
        setSelectedAssets(new Set(ASSETS.map(a => a.id)));
        setSaveStatus(null);
    };

    const deselectAll = () => {
        setSelectedAssets(new Set());
        setSaveStatus(null);
    };

    const toggleRegion = (provider, regionId) => {
        setSelectedRegions(prev => {
            const next = { ...prev };
            const providerSet = new Set(prev[provider]);
            if (providerSet.has(regionId)) {
                providerSet.delete(regionId);
            } else {
                providerSet.add(regionId);
            }
            next[provider] = providerSet;
            return next;
        });
        setSaveStatus(null);
    };

    const selectAllRegions = (provider) => {
        setSelectedRegions(prev => ({
            ...prev,
            [provider]: new Set(CLOUD_REGIONS[provider].regions.map(r => r.id)),
        }));
        setSaveStatus(null);
    };

    const deselectAllRegions = (provider) => {
        setSelectedRegions(prev => ({
            ...prev,
            [provider]: new Set(),
        }));
        setSaveStatus(null);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveStatus(null);
        try {
            // Save assets
            const ids = Array.from(selectedAssets);
            await setUserAssets(ids);
            setInitialAssets(new Set(ids));
            if (onAssetsChanged) onAssetsChanged(ids);

            // Save cloud regions
            const regionsPayload = {};
            for (const provider of REGION_PROVIDERS) {
                regionsPayload[provider] = Array.from(selectedRegions[provider]);
            }
            await setCloudRegions(regionsPayload);
            setInitialRegions(regionsPayload);
            if (onCloudRegionsChanged) onCloudRegionsChanged(regionsPayload);

            setSaveStatus('saved');
        } catch (err) {
            console.error('Failed to save:', err);
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleResendVerification = async () => {
        setVerificationSending(true);
        try {
            await resendVerification();
            setVerificationSent(true);
        } catch (err) {
            console.error('Failed to resend verification:', err);
        } finally {
            setVerificationSending(false);
        }
    };

    const hasAssetChanges = (() => {
        if (initialAssets === null) {
            return selectedAssets.size !== ASSETS.length;
        }
        if (selectedAssets.size !== initialAssets.size) return true;
        for (const id of selectedAssets) {
            if (!initialAssets.has(id)) return true;
        }
        return false;
    })();

    const hasRegionChanges = (() => {
        const defaults = getDefaultRegions();
        for (const provider of REGION_PROVIDERS) {
            const current = Array.from(selectedRegions[provider]).sort();
            const initial = initialRegions
                ? (initialRegions[provider] || defaults[provider]).slice().sort()
                : defaults[provider].slice().sort();
            if (current.length !== initial.length) return true;
            for (let i = 0; i < current.length; i++) {
                if (current[i] !== initial[i]) return true;
            }
        }
        return false;
    })();

    const hasChanges = hasAssetChanges || hasRegionChanges;
    const allSelected = selectedAssets.size === ASSETS.length;

    return (
        <div className="settings-page">
            <div className="settings-header">
                <button className="settings-back-btn" onClick={onBack}>
                    <ArrowLeft size={18} />
                    <span>Dashboard</span>
                </button>
                <h1 className="settings-title">Settings</h1>
            </div>

            <div className="settings-content">
                {/* Account Section */}
                <section className="settings-section">
                    <h2 className="settings-section-title">Account</h2>
                    <div className="settings-card">
                        <div className="settings-row">
                            <div className="settings-row-label">
                                <Mail size={16} />
                                Email
                            </div>
                            <div className="settings-row-value">{user?.email}</div>
                        </div>

                        <div className="settings-row">
                            <div className="settings-row-label">
                                <Shield size={16} />
                                Verification
                            </div>
                            <div className="settings-row-value">
                                {user?.emailVerified ? (
                                    <span className="settings-verified">
                                        <CheckCircle size={14} />
                                        Verified
                                    </span>
                                ) : (
                                    <div className="settings-unverified">
                                        <span>Not verified</span>
                                        {verificationSent ? (
                                            <span className="settings-verification-sent">Email sent!</span>
                                        ) : (
                                            <button
                                                className="settings-resend-btn"
                                                onClick={handleResendVerification}
                                                disabled={verificationSending}
                                            >
                                                {verificationSending ? 'Sending...' : 'Resend Verification'}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {user?.createdAt && (
                            <div className="settings-row">
                                <div className="settings-row-label">Member since</div>
                                <div className="settings-row-value">
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Monitored Assets Section */}
                <section className="settings-section">
                    <div className="settings-section-header">
                        <h2 className="settings-section-title">Monitored Assets</h2>
                        <div className="settings-section-actions">
                            <span className="settings-asset-count">
                                {selectedAssets.size} / {ASSETS.length}
                            </span>
                            <button
                                className="settings-toggle-all-btn"
                                onClick={allSelected ? deselectAll : selectAll}
                            >
                                {allSelected ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="settings-loading">
                            <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} />
                            <span>Loading preferences...</span>
                        </div>
                    ) : (
                        <div className="settings-asset-columns">
                            {SORTED_ASSETS.map(asset => (
                                <label
                                    key={asset.id}
                                    className={`settings-asset-row ${selectedAssets.has(asset.id) ? 'selected' : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedAssets.has(asset.id)}
                                        onChange={() => toggleAsset(asset.id)}
                                        className="settings-native-checkbox"
                                    />
                                    <span className="settings-asset-name">{asset.name}</span>
                                </label>
                            ))}
                        </div>
                    )}

                </section>

                {/* Cloud Regions Section */}
                <section className="settings-section">
                    <div className="settings-section-header">
                        <h2 className="settings-section-title">Cloud Regions</h2>
                        <span className="settings-asset-count">
                            Monitored regions for The Pulse
                        </span>
                    </div>

                    {isLoading ? (
                        <div className="settings-loading">
                            <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} />
                            <span>Loading preferences...</span>
                        </div>
                    ) : (
                        <div className="settings-regions-container">
                            {REGION_PROVIDERS.map(providerId => {
                                const config = CLOUD_REGIONS[providerId];
                                const providerRegions = selectedRegions[providerId] || new Set();
                                const allProviderSelected = providerRegions.size === config.regions.length;

                                return (
                                    <div key={providerId} className="settings-region-provider">
                                        <div className="settings-region-provider-header">
                                            <span className="settings-region-provider-name">{config.name}</span>
                                            <span className="settings-asset-count">
                                                {providerRegions.size}/{config.regions.length}
                                            </span>
                                            <button
                                                className="settings-toggle-all-btn"
                                                onClick={() => allProviderSelected
                                                    ? deselectAllRegions(providerId)
                                                    : selectAllRegions(providerId)
                                                }
                                            >
                                                {allProviderSelected ? 'Deselect All' : 'Select All'}
                                            </button>
                                        </div>
                                        <div className="settings-region-grid">
                                            {config.regions.map(region => (
                                                <label
                                                    key={region.id}
                                                    className={`settings-asset-row ${providerRegions.has(region.id) ? 'selected' : ''}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={providerRegions.has(region.id)}
                                                        onChange={() => toggleRegion(providerId, region.id)}
                                                        className="settings-native-checkbox"
                                                    />
                                                    <span className="settings-asset-name">{region.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Save Bar */}
                <div className="settings-save-bar">
                    <button
                        className="settings-save-btn"
                        onClick={handleSave}
                        disabled={isSaving || !hasChanges}
                    >
                        {isSaving ? (
                            <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : (
                            <Save size={16} />
                        )}
                        {isSaving ? 'Saving...' : 'Save Preferences'}
                    </button>
                    {saveStatus === 'saved' && (
                        <span className="settings-save-status success">
                            <CheckCircle size={14} /> Saved!
                        </span>
                    )}
                    {saveStatus === 'error' && (
                        <span className="settings-save-status error">
                            Failed to save. Try again.
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Settings;
