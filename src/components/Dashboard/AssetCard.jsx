import React from 'react';
import {
    Shield,
    Server,
    Database,
    Wifi,
    HardDrive,
    Lock,
    MessageSquare,
    Globe,
    Tv,
    Battery,
    CheckCircle,
    Monitor,
    Cloud,
    Container,
    ShieldAlert,
    Zap
} from 'lucide-react';
import { ASSET_CATEGORIES } from '../../data/assets';
import './AssetCard.css';

// Map categories to icons
const categoryIcons = {
    [ASSET_CATEGORIES.FIREWALL_VPN]: Shield,
    [ASSET_CATEGORIES.STORAGE]: HardDrive,
    [ASSET_CATEGORIES.SERVERS]: Server,
    [ASSET_CATEGORIES.POWER]: Battery,
    [ASSET_CATEGORIES.NETWORK]: Wifi,
    [ASSET_CATEGORIES.NETWORK_OS]: Wifi,
    [ASSET_CATEGORIES.IT_MANAGEMENT]: Server,
    [ASSET_CATEGORIES.DATABASE]: Database,
    [ASSET_CATEGORIES.BACKUP_DR]: HardDrive,
    [ASSET_CATEGORIES.SECURITY]: Lock,
    [ASSET_CATEGORIES.COLLABORATION]: MessageSquare,
    [ASSET_CATEGORIES.BROWSERS]: Globe,
    [ASSET_CATEGORIES.AV_CONTROL]: Tv,
    [ASSET_CATEGORIES.LINUX_DISTROS]: Monitor,
    [ASSET_CATEGORIES.CLOUD_PLATFORMS]: Cloud,
    [ASSET_CATEGORIES.NETWORK_SECURITY]: ShieldAlert,
    [ASSET_CATEGORIES.CONTAINERS]: Container
};

const AssetCard = ({ asset, vulnCounts = {}, onClick, isSelected }) => {
    const Icon = categoryIcons[asset.category] || Server;
    const { total = 0, critical = 0, high = 0, medium = 0, low = 0, epssHigh = 0 } = vulnCounts;

    // Determine card severity class
    let severityClass = 'no-vulns';
    if (critical > 0) severityClass = 'has-critical';
    else if (high > 0) severityClass = 'has-high';
    else if (medium > 0) severityClass = 'has-medium';
    else if (low > 0) severityClass = 'has-low';

    return (
        <div
            className={`asset-card ${severityClass} ${isSelected ? 'selected' : ''}`}
            onClick={() => onClick?.(asset)}
        >
            <div className="asset-card-header">
                <div className="asset-card-info">
                    <div className="asset-card-vendor">{asset.vendor}</div>
                    <div className="asset-card-name" title={asset.name}>{asset.name}</div>
                </div>
                <div className="asset-card-icon">
                    <Icon />
                </div>
            </div>

            <div className="asset-card-stats">
                {critical > 0 && (
                    <div className="asset-stat critical">
                        <span className="asset-stat-dot" />
                        {critical} Critical
                    </div>
                )}
                {high > 0 && (
                    <div className="asset-stat high">
                        <span className="asset-stat-dot" />
                        {high} High
                    </div>
                )}
                {medium > 0 && (
                    <div className="asset-stat medium">
                        <span className="asset-stat-dot" />
                        {medium} Medium
                    </div>
                )}
                {low > 0 && (
                    <div className="asset-stat low">
                        <span className="asset-stat-dot" />
                        {low} Low
                    </div>
                )}
            </div>

            <div className="asset-card-footer">
                {total > 0 ? (
                    <span className="asset-card-total">
                        <strong>{total}</strong> vulnerabilities
                    </span>
                ) : (
                    <span className="asset-card-status">
                        <CheckCircle />
                        No vulnerabilities
                    </span>
                )}
                {epssHigh > 0 && (
                    <span className="asset-card-epss">
                        <Zap size={12} />
                        {epssHigh} likely exploited
                    </span>
                )}
            </div>
        </div>
    );
};

// Skeleton version for loading
export const AssetCardSkeleton = () => (
    <div className="asset-card skeleton">
        <div className="asset-card-header">
            <div className="asset-card-info">
                <div className="skeleton-text short" style={{ marginBottom: '8px', height: '12px' }} />
                <div className="skeleton-text medium" style={{ height: '16px' }} />
            </div>
            <div className="asset-card-icon" style={{ background: 'var(--bg-elevated)' }} />
        </div>
        <div className="asset-card-stats">
            <div className="skeleton-text" style={{ width: '60px', height: '24px' }} />
            <div className="skeleton-text" style={{ width: '50px', height: '24px' }} />
        </div>
        <div className="asset-card-footer">
            <div className="skeleton-text" style={{ width: '100px', height: '14px' }} />
        </div>
    </div>
);

export default AssetCard;
