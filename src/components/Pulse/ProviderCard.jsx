import React from 'react';
import { ExternalLink } from 'lucide-react';
import UptimeTimeline from './UptimeTimeline';

const PROVIDER_COLORS = {
    aws: '#FF9900',
    gcp: '#4285F4',
    azure: '#0078D4',
    m365: '#D83B01',
};

const STATUS_LABELS = {
    operational: 'Operational',
    degraded: 'Degraded',
    outage: 'Outage',
    unknown: 'Unknown',
};

const ProviderCard = ({ provider }) => {
    const color = PROVIDER_COLORS[provider.id] || '#6b7280';
    const recentIncidents = provider.incidents?.filter(i => i.status !== 'resolved').length || 0;
    const totalIncidents = provider.incidents?.length || 0;

    return (
        <div className="provider-card">
            <div className="provider-card-accent" style={{ background: color }} />
            <div className="provider-card-content">
                <div className="provider-card-header">
                    <div className="provider-card-identity">
                        <img
                            src={`${import.meta.env.BASE_URL}provider-logos/${provider.id}.svg`}
                            alt={provider.name}
                            className="provider-card-logo"
                        />
                        <span className="provider-card-name">{provider.name}</span>
                    </div>
                    <div className={`status-badge ${provider.overallStatus}`}>
                        <span className="status-badge-dot" />
                        {STATUS_LABELS[provider.overallStatus] || 'Unknown'}
                    </div>
                </div>

                <UptimeTimeline dailyStatus={provider.dailyStatus} />

                <div className="provider-card-footer">
                    <span className="provider-card-incidents">
                        {recentIncidents > 0 ? (
                            <><strong>{recentIncidents}</strong> active incident{recentIncidents > 1 ? 's' : ''}</>
                        ) : (
                            <>{totalIncidents} incident{totalIncidents !== 1 ? 's' : ''} (14d)</>
                        )}
                    </span>
                    <a
                        href={provider.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="provider-card-link"
                    >
                        Status page <ExternalLink size={11} style={{ marginLeft: 2, verticalAlign: 'middle' }} />
                    </a>
                </div>
            </div>
        </div>
    );
};

export default ProviderCard;
