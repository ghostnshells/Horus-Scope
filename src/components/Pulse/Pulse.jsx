import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { fetchCloudStatus, clearCloudStatusCache } from '../../services/cloudStatusService';
import ProviderCard from './ProviderCard';
import IncidentFeed from './IncidentFeed';
import './Pulse.css';

const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

const Pulse = ({ userCloudRegions }) => {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const intervalRef = useRef(null);

    // Resolve regions: undefined = still loading, null = no prefs (pass null to API), object = user prefs
    const regionsResolved = userCloudRegions !== undefined;
    const regionsToSend = userCloudRegions || null;

    const loadData = useCallback(async (forceRefresh = false) => {
        if (!regionsResolved) return;
        setIsLoading(true);
        setError(null);
        try {
            const result = await fetchCloudStatus(forceRefresh, regionsToSend);
            setData(result);
        } catch (err) {
            console.error('[Pulse] Fetch error:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [regionsResolved, regionsToSend]);

    // Initial fetch (waits until regions are resolved)
    useEffect(() => {
        loadData();
    }, [loadData]);

    // Auto-refresh
    useEffect(() => {
        intervalRef.current = setInterval(() => {
            loadData();
        }, AUTO_REFRESH_INTERVAL);

        return () => clearInterval(intervalRef.current);
    }, [loadData]);

    const handleRefresh = () => {
        clearCloudStatusCache();
        loadData(true);
    };

    const providers = data?.providers || {};
    const providerOrder = ['aws', 'gcp', 'azure', 'm365'];

    // Show loading on initial fetch only
    if (isLoading && !data) {
        return (
            <div className="pulse">
                <div className="pulse-header">
                    <div className="pulse-header-left">
                        <h1>The Pulse</h1>
                        <p>Cloud infrastructure status monitor</p>
                    </div>
                </div>
                <div className="pulse-loading">
                    <div className="pulse-loading-spinner" />
                    <p>Fetching cloud provider status...</p>
                </div>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="pulse">
                <div className="pulse-header">
                    <div className="pulse-header-left">
                        <h1>The Pulse</h1>
                        <p>Cloud infrastructure status monitor</p>
                    </div>
                </div>
                <div className="pulse-error">
                    <AlertTriangle size={32} className="pulse-error-icon" />
                    <h3>Failed to load status data</h3>
                    <p>{error}</p>
                    <button onClick={handleRefresh}>Try Again</button>
                </div>
            </div>
        );
    }

    return (
        <div className="pulse">
            <div className="pulse-header">
                <div className="pulse-header-left">
                    <h1>The Pulse</h1>
                    <p>Cloud infrastructure status monitor</p>
                </div>
                <button
                    className="pulse-refresh-btn"
                    onClick={handleRefresh}
                    disabled={isLoading}
                >
                    <RefreshCw size={14} className={isLoading ? 'spinning' : ''} />
                    {isLoading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            <div className="pulse-section">
                <div className="pulse-section-title">Provider Status</div>
                <div className="provider-cards-grid">
                    {providerOrder.map(id => {
                        const provider = providers[id];
                        if (!provider) return null;
                        return <ProviderCard key={id} provider={provider} selectedRegions={userCloudRegions} />;
                    })}
                </div>
            </div>

            <div className="pulse-section">
                <div className="pulse-section-title">Recent Incidents</div>
                <IncidentFeed providers={providers} />
            </div>
        </div>
    );
};

export default Pulse;
