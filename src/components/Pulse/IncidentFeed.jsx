import React, { useState } from 'react';
import { CheckCircle, ChevronDown } from 'lucide-react';

const PROVIDER_LABELS = {
    aws: 'AWS',
    gcp: 'GCP',
    azure: 'Azure',
    m365: 'M365',
};

const formatTimeAgo = (dateStr) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
};

const formatTimestamp = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

const IncidentItem = ({ incident, providerId }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="incident-item">
            <div
                className="incident-item-header"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <span className={`incident-provider-badge ${providerId}`}>
                    {PROVIDER_LABELS[providerId] || providerId}
                </span>
                <div className="incident-item-content">
                    <div className="incident-item-title">{incident.title}</div>
                    <div className="incident-item-meta">
                        <span className={`incident-status-badge ${incident.status}`}>
                            {incident.status}
                        </span>
                        <span>{formatTimeAgo(incident.created)}</span>
                        {incident.affectedServices?.length > 0 && (
                            <span>{incident.affectedServices[0]}</span>
                        )}
                    </div>
                </div>
                <button className={`incident-expand-btn ${isExpanded ? 'expanded' : ''}`}>
                    <ChevronDown size={16} />
                </button>
            </div>

            {isExpanded && (
                <div className="incident-detail">
                    {incident.description && (
                        <p className="incident-description">{incident.description}</p>
                    )}

                    {incident.affectedServices?.length > 0 && (
                        <div className="incident-services">
                            {incident.affectedServices.map((svc, i) => (
                                <span key={i} className="incident-service-tag">{svc}</span>
                            ))}
                        </div>
                    )}

                    {incident.updates?.length > 0 && (
                        <div className="incident-updates">
                            <div className="incident-updates-title">Updates</div>
                            {incident.updates.map((update, i) => (
                                <div key={i} className="incident-update">
                                    <div className="incident-update-dot" />
                                    <div className="incident-update-content">
                                        <div className="incident-update-time">
                                            {formatTimestamp(update.timestamp)}
                                        </div>
                                        <div className="incident-update-message">
                                            {update.message}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const IncidentFeed = ({ providers = {} }) => {
    // Merge all incidents from all providers, tagged with providerId
    const allIncidents = Object.entries(providers)
        .flatMap(([providerId, provider]) =>
            (provider.incidents || []).map(inc => ({ ...inc, providerId }))
        )
        .sort((a, b) => new Date(b.created) - new Date(a.created));

    if (allIncidents.length === 0) {
        return (
            <div className="incident-feed-empty">
                <div className="incident-feed-empty-icon">
                    <CheckCircle size={24} />
                </div>
                <h3>No incidents reported</h3>
                <p>All cloud providers are operating normally with no incidents in the last 14 days.</p>
            </div>
        );
    }

    return (
        <div className="incident-feed">
            {allIncidents.map(incident => (
                <IncidentItem
                    key={incident.id}
                    incident={incident}
                    providerId={incident.providerId}
                />
            ))}
        </div>
    );
};

export default IncidentFeed;
