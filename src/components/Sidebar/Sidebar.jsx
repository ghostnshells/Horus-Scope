import React, { useState } from 'react';
import {
    Shield,
    LayoutDashboard,
    Server,
    Database,
    Wifi,
    HardDrive,
    Lock,
    MessageSquare,
    Globe,
    Tv,
    Battery,
    RefreshCw,
    Clock,
    Radio,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Building2,
    Layers,
    Menu,
    Activity
} from 'lucide-react';
import {
    ASSET_CATEGORIES,
    getAssetsByCategory,
    getVendorGroups,
    getAssetsByVendorGroup,
    getSubcategoriesForVendor,
    getVendorVulnCounts,
    getSubcategoryVulnCounts
} from '../../data/assets';
import './Sidebar.css';

// Map categories to icons
const categoryIcons = {
    [ASSET_CATEGORIES.FIREWALL_VPN]: Shield,
    [ASSET_CATEGORIES.STORAGE]: HardDrive,
    [ASSET_CATEGORIES.SERVERS]: Server,
    [ASSET_CATEGORIES.POWER]: Battery,
    [ASSET_CATEGORIES.NETWORK]: Wifi,
    [ASSET_CATEGORIES.NETWORK_OS]: Wifi,
    [ASSET_CATEGORIES.IT_MANAGEMENT]: LayoutDashboard,
    [ASSET_CATEGORIES.DATABASE]: Database,
    [ASSET_CATEGORIES.BACKUP_DR]: HardDrive,
    [ASSET_CATEGORIES.SECURITY]: Lock,
    [ASSET_CATEGORIES.COLLABORATION]: MessageSquare,
    [ASSET_CATEGORIES.BROWSERS]: Globe,
    [ASSET_CATEGORIES.AV_CONTROL]: Tv
};

// Vendor icons mapping
const vendorIcons = {
    'WatchGuard': Shield,
    'HPE': Server,
    'Cisco': Wifi,
    'Microsoft': Building2,
    'Tripp Lite': Battery,
    'SolarWinds': LayoutDashboard,
    'ConnectWise': LayoutDashboard,
    'Oracle': Database,
    'Veeam': HardDrive,
    'Zerto': HardDrive,
    'BitDefender': Lock,
    'Zoom': MessageSquare,
    'Google': Globe,
    'Mozilla': Globe,
    'Crestron': Tv
};

const Sidebar = ({
    selectedCategory,
    onCategorySelect,
    vulnCounts = {},
    lastUpdated,
    onRefresh,
    isLoading,
    isCollapsed = false,
    onToggleCollapse,
    viewMode = 'category',
    onViewModeChange,
    selectedVendor,
    onVendorSelect,
    selectedSubcategory,
    onSubcategorySelect,
    activeView = 'dashboard',
    onActiveViewChange,
}) => {
    const categories = Object.values(ASSET_CATEGORIES);
    const vendorGroups = getVendorGroups();

    // Track expanded vendors for subcategory display
    const [expandedVendors, setExpandedVendors] = useState({});

    // Toggle vendor expansion
    const toggleVendorExpansion = (vendor) => {
        setExpandedVendors(prev => ({
            ...prev,
            [vendor]: !prev[vendor]
        }));
    };

    // Calculate totals for each category
    const getCategoryStats = (category) => {
        const assets = getAssetsByCategory(category);
        let total = 0;
        let critical = 0;

        assets.forEach(asset => {
            const counts = vulnCounts[asset.id];
            if (counts) {
                total += counts.total || 0;
                critical += counts.critical || 0;
            }
        });

        return { total, critical };
    };

    // Get total for all assets
    const getAllStats = () => {
        let total = 0;
        let critical = 0;

        Object.values(vulnCounts).forEach(counts => {
            total += counts.total || 0;
            critical += counts.critical || 0;
        });

        return { total, critical };
    };

    const allStats = getAllStats();

    // Handle vendor click
    const handleVendorClick = (vendor, e) => {
        e.stopPropagation();
        if (onActiveViewChange) onActiveViewChange('dashboard');
        onVendorSelect(vendor);
        // Auto-expand the vendor when selected
        if (!expandedVendors[vendor]) {
            toggleVendorExpansion(vendor);
        }
    };

    // Handle subcategory click
    const handleSubcategoryClick = (vendor, subcat, e) => {
        e.stopPropagation();
        if (onActiveViewChange) onActiveViewChange('dashboard');
        if (selectedVendor !== vendor) {
            onVendorSelect(vendor);
        }
        onSubcategorySelect(subcat);
    };

    return (
        <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">
                        <img src={`${import.meta.env.BASE_URL}heimdall_prod_logo.png`} alt="Heimdall" className="sidebar-logo-img" />
                    </div>
                    {!isCollapsed && (
                        <div className="sidebar-logo-text">
                            <span>HEIMDALL</span>
                        </div>
                    )}
                </div>
                <button
                    className="sidebar-toggle"
                    onClick={onToggleCollapse}
                    title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>

            <div className="sidebar-content">
                {/* View Mode Toggle */}
                {!isCollapsed && (
                    <div className="sidebar-section">
                        <div className="view-mode-toggle">
                            <button
                                className={`view-mode-btn ${viewMode === 'category' ? 'active' : ''}`}
                                onClick={() => onViewModeChange('category')}
                            >
                                <Layers size={14} />
                                Categories
                            </button>
                            <button
                                className={`view-mode-btn ${viewMode === 'vendor' ? 'active' : ''}`}
                                onClick={() => onViewModeChange('vendor')}
                            >
                                <Building2 size={14} />
                                Vendors
                            </button>
                        </div>
                    </div>
                )}

                {/* Overview - All Assets */}
                <div className="sidebar-section">
                    {!isCollapsed && <div className="sidebar-section-title">Overview</div>}
                    <nav className="sidebar-nav">
                        <div
                            className={`sidebar-nav-item ${activeView === 'dashboard' && ((viewMode === 'category' && selectedCategory === 'All') || (viewMode === 'vendor' && !selectedVendor)) ? 'active' : ''}`}
                            onClick={() => {
                                if (onActiveViewChange) onActiveViewChange('dashboard');
                                if (viewMode === 'category') {
                                    onCategorySelect('All');
                                } else {
                                    onVendorSelect(null);
                                    onSubcategorySelect(null);
                                }
                            }}
                            title="All Assets"
                        >
                            <LayoutDashboard />
                            {!isCollapsed && <span className="sidebar-nav-item-text">All Assets</span>}
                            {allStats.total > 0 && (
                                <span className={`sidebar-nav-item-badge ${allStats.critical > 0 ? 'critical' : ''}`}>
                                    {allStats.total}
                                </span>
                            )}
                        </div>
                    </nav>
                </div>

                {/* Monitor Section */}
                <div className="sidebar-section">
                    {!isCollapsed && <div className="sidebar-section-title">Monitor</div>}
                    <nav className="sidebar-nav">
                        <div
                            className={`sidebar-nav-item ${activeView === 'pulse' ? 'active' : ''}`}
                            onClick={() => onActiveViewChange && onActiveViewChange('pulse')}
                            title="The Pulse"
                        >
                            <Activity />
                            {!isCollapsed && <span className="sidebar-nav-item-text">The Pulse</span>}
                        </div>
                    </nav>
                </div>

                {/* Category View */}
                {viewMode === 'category' && (
                    <div className="sidebar-section">
                        {!isCollapsed && <div className="sidebar-section-title">Categories</div>}
                        <nav className="sidebar-nav">
                            {categories.map(category => {
                                const Icon = categoryIcons[category] || Server;
                                const stats = getCategoryStats(category);

                                return (
                                    <div
                                        key={category}
                                        className={`sidebar-nav-item ${activeView === 'dashboard' && selectedCategory === category ? 'active' : ''}`}
                                        onClick={() => {
                                            if (onActiveViewChange) onActiveViewChange('dashboard');
                                            onCategorySelect(category);
                                        }}
                                        title={category}
                                    >
                                        <Icon />
                                        {!isCollapsed && <span className="sidebar-nav-item-text">{category}</span>}
                                        {stats.total > 0 && (
                                            <span className={`sidebar-nav-item-badge ${stats.critical > 0 ? 'critical' : ''}`}>
                                                {stats.total}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </nav>
                    </div>
                )}

                {/* Vendor View */}
                {viewMode === 'vendor' && (
                    <div className="sidebar-section">
                        {!isCollapsed && <div className="sidebar-section-title">Vendors</div>}
                        <nav className="sidebar-nav vendor-nav">
                            {vendorGroups.map(vendor => {
                                const Icon = vendorIcons[vendor] || Building2;
                                const vendorStats = getVendorVulnCounts(vendor, vulnCounts);
                                const subcategories = getSubcategoriesForVendor(vendor);
                                const isExpanded = expandedVendors[vendor];
                                const isSelected = selectedVendor === vendor;
                                const hasSubcategories = subcategories.length > 1;

                                return (
                                    <div key={vendor} className="vendor-group">
                                        <div
                                            className={`sidebar-nav-item vendor-item ${isSelected && !selectedSubcategory ? 'active' : ''}`}
                                            onClick={(e) => handleVendorClick(vendor, e)}
                                            title={vendor}
                                        >
                                            {hasSubcategories && !isCollapsed && (
                                                <button
                                                    className={`vendor-expand-btn ${isExpanded ? 'expanded' : ''}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleVendorExpansion(vendor);
                                                    }}
                                                >
                                                    <ChevronRight size={14} />
                                                </button>
                                            )}
                                            <Icon />
                                            {!isCollapsed && <span className="sidebar-nav-item-text">{vendor}</span>}
                                            {vendorStats.total > 0 && (
                                                <span className={`sidebar-nav-item-badge ${vendorStats.critical > 0 ? 'critical' : ''}`}>
                                                    {vendorStats.total}
                                                </span>
                                            )}
                                        </div>

                                        {/* Subcategories */}
                                        {!isCollapsed && hasSubcategories && isExpanded && (
                                            <div className="subcategory-list">
                                                {subcategories.map(subcat => {
                                                    const subcatStats = getSubcategoryVulnCounts(vendor, subcat, vulnCounts);
                                                    const isSubcatSelected = selectedVendor === vendor && selectedSubcategory === subcat;

                                                    return (
                                                        <div
                                                            key={subcat}
                                                            className={`sidebar-nav-item subcategory-item ${isSubcatSelected ? 'active' : ''}`}
                                                            onClick={(e) => handleSubcategoryClick(vendor, subcat, e)}
                                                            title={subcat}
                                                        >
                                                            <span className="sidebar-nav-item-text">{subcat}</span>
                                                            {subcatStats.total > 0 && (
                                                                <span className={`sidebar-nav-item-badge ${subcatStats.critical > 0 ? 'critical' : ''}`}>
                                                                    {subcatStats.total}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </nav>
                    </div>
                )}

                {!isCollapsed && (
                    <div className="sidebar-section">
                        <div className="sidebar-section-title">Data Source</div>
                        <div className="data-source-info">
                            <Radio size={14} />
                            <span>Live NVD API</span>
                        </div>
                        <p className="data-source-note">
                            All vulnerability data is fetched from the official National Vulnerability Database (NVD).
                            Click any CVE to verify at nvd.nist.gov.
                        </p>
                    </div>
                )}
            </div>

            <div className="sidebar-footer">
                {lastUpdated && !isCollapsed && (
                    <div className="sidebar-footer-info">
                        <Clock />
                        <span>Updated {formatTimeAgo(new Date(lastUpdated))}</span>
                    </div>
                )}
                <button
                    className="sidebar-refresh-btn"
                    onClick={onRefresh}
                    disabled={isLoading}
                    title={isLoading ? 'Fetching...' : 'Refresh Data'}
                >
                    <RefreshCw className={isLoading ? 'spinning' : ''} />
                    {!isCollapsed && (isLoading ? 'Fetching...' : 'Refresh Data')}
                </button>
                {isLoading && !isCollapsed && (
                    <p className="sidebar-loading-note">
                        NVD API has rate limits. This may take a few minutes.
                    </p>
                )}
            </div>
        </aside>
    );
};

// Format time ago helper
const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
};

export default Sidebar;
