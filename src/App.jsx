import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Menu, Newspaper, LogOut, AlertTriangle, X } from 'lucide-react';
import Sidebar from './components/Sidebar/Sidebar';
import Dashboard from './components/Dashboard/Dashboard';
import AlertsList from './components/AlertsList/AlertsList';
import NewsFeed from './components/NewsFeed';
import Pulse from './components/Pulse/Pulse';
import LoginPage from './components/Auth/LoginPage';
import ForgotPassword from './components/Auth/ForgotPassword';
import ResetPassword from './components/Auth/ResetPassword';
import VerifyEmail from './components/Auth/VerifyEmail';
import Settings from './components/Settings/Settings';
import {
    fetchAllVulnerabilities,
    getVulnerabilityStats,
    getVulnCountsByAsset,
    clearCache
} from './services/vulnerabilityService';
import {
    isAuthenticated,
    getStoredUser,
    login as authLogin,
    signup as authSignup,
    logout as authLogout,
    updateStoredUser,
    resendVerification
} from './services/authService';
import { getUserAssets, getCloudRegions } from './services/userService';

function App() {
    // State
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [timeRange, setTimeRange] = useState('30d');
    const [vulnerabilities, setVulnerabilities] = useState(null);
    const [stats, setStats] = useState(null);
    const [vulnCounts, setVulnCounts] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(null);
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [error, setError] = useState(null);

    // Collapse states for responsive layout
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isNewsFeedCollapsed, setIsNewsFeedCollapsed] = useState(true); // Collapsed by default
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isMobileNewsOpen, setIsMobileNewsOpen] = useState(false);

    // Auth state
    const [user, setUser] = useState(getStoredUser());
    const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated());
    const [showLoginModal, setShowLoginModal] = useState(false);

    // Auth flow views
    const [authView, setAuthView] = useState(null); // null | 'forgot' | 'reset' | 'verify' | 'settings'
    const [authToken, setAuthToken] = useState(null); // token from URL for verify/reset

    // User asset customization
    const [userAssets, setUserAssets] = useState(null); // null = show all, array = filtered
    const [userCloudRegions, setUserCloudRegions] = useState(undefined); // undefined = not loaded, null = no prefs

    // Verification banner
    const [showVerificationBanner, setShowVerificationBanner] = useState(true);

    // Vendor view mode state
    const [viewMode, setViewMode] = useState('category'); // 'category' | 'vendor'
    const [selectedVendor, setSelectedVendor] = useState(null);
    const [selectedSubcategory, setSelectedSubcategory] = useState(null);

    // Active view state: 'dashboard' | 'pulse'
    const [activeView, setActiveView] = useState('dashboard');

    // URL-based routing on mount
    useEffect(() => {
        const path = window.location.pathname;
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');

        if (path === '/verify-email' && token) {
            setAuthView('verify');
            setAuthToken(token);
        } else if (path === '/reset-password' && token) {
            setAuthView('reset');
            setAuthToken(token);
        } else if (path === '/settings') {
            if (isAuthenticated()) {
                setAuthView('settings');
            }
            window.history.replaceState(null, '', '/');
        }
    }, []);

    // Load user preferences on login
    useEffect(() => {
        if (isLoggedIn) {
            getUserAssets()
                .then(assets => setUserAssets(assets))
                .catch(() => setUserAssets(null));
            getCloudRegions()
                .then(regions => setUserCloudRegions(regions))
                .catch(() => setUserCloudRegions(null));
        } else {
            setUserAssets(null);
            setUserCloudRegions(null); // null = not logged in, no filtering
        }
    }, [isLoggedIn]);

    // Handle view mode change
    const handleViewModeChange = (mode) => {
        setViewMode(mode);
        // Reset selections when switching modes
        if (mode === 'category') {
            setSelectedVendor(null);
            setSelectedSubcategory(null);
        } else {
            setSelectedCategory('All');
        }
    };

    // Handle vendor selection
    const handleVendorSelect = (vendor) => {
        setSelectedVendor(vendor);
        setSelectedSubcategory(null); // Reset subcategory when vendor changes
    };

    // Handle subcategory selection
    const handleSubcategorySelect = (subcat) => {
        setSelectedSubcategory(subcat);
    };

    // Handle login/signup
    const handleLogin = async (email, password, isSignupMode) => {
        if (isSignupMode) {
            const userData = await authSignup(email, password);
            setUser(userData);
        } else {
            const userData = await authLogin(email, password);
            setUser(userData);
        }
        setIsLoggedIn(true);
        setShowLoginModal(false);
        setShowVerificationBanner(true);
    };

    // Handle logout
    const handleLogout = async () => {
        await authLogout();
        setUser(null);
        setIsLoggedIn(false);
        setUserAssets(null);
        setAuthView(null);
    };

    // Handle auth view completion (verify/reset done)
    const handleAuthViewComplete = () => {
        setAuthView(null);
        setAuthToken(null);
        window.history.replaceState(null, '', '/');
        // If email was verified, update local user state
        if (user) {
            const updated = { ...user, emailVerified: true };
            setUser(updated);
            updateStoredUser({ emailVerified: true });
        }
    };

    // Handle forgot password
    const handleForgotPassword = () => {
        setShowLoginModal(false);
        setAuthView('forgot');
    };

    // Fetch vulnerabilities from live NVD API
    const fetchData = useCallback(async (forceRefresh = false) => {
        setIsLoading(true);
        setError(null);
        setLoadingProgress({ current: 0, total: 24, asset: 'Initializing connection to NVD...' });

        try {
            const data = await fetchAllVulnerabilities(
                timeRange,
                (current, total, assetName) => {
                    setLoadingProgress({ current: current + 1, total, asset: assetName });
                },
                forceRefresh
            );

            setVulnerabilities(data);
            setStats(getVulnerabilityStats(data));
            setVulnCounts(getVulnCountsByAsset(data));
        } catch (err) {
            console.error('Error fetching vulnerabilities:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
            setLoadingProgress(null);
        }
    }, [timeRange]);

    // Initial fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Handle time range change
    // Note: We don't clear cache here - the service will use cached data from larger
    // time ranges when available, and only fetch from API when necessary
    const handleTimeRangeChange = (newRange) => {
        setTimeRange(newRange);
    };

    // Handle refresh
    const handleRefresh = () => {
        clearCache();
        fetchData(true);
    };

    // Lifecycle state
    const [vulnStatuses, setVulnStatuses] = useState({});
    const [slaConfig, setSlaConfig] = useState(null);

    // Filter data by user's selected assets
    const filteredVulnerabilities = useMemo(() => {
        if (!vulnerabilities || !userAssets) return vulnerabilities;
        const allowedSet = new Set(userAssets);
        const filteredByAsset = {};
        const filteredAll = [];

        for (const [assetId, vulns] of Object.entries(vulnerabilities.byAsset || {})) {
            if (allowedSet.has(assetId)) {
                filteredByAsset[assetId] = vulns;
                filteredAll.push(...vulns);
            }
        }

        return {
            ...vulnerabilities,
            byAsset: filteredByAsset,
            all: filteredAll
        };
    }, [vulnerabilities, userAssets]);

    const filteredStats = useMemo(() => {
        if (!filteredVulnerabilities) return stats;
        return getVulnerabilityStats(filteredVulnerabilities);
    }, [filteredVulnerabilities, stats]);

    const filteredVulnCounts = useMemo(() => {
        if (!filteredVulnerabilities) return vulnCounts;
        return getVulnCountsByAsset(filteredVulnerabilities);
    }, [filteredVulnerabilities, vulnCounts]);

    // Handle status change from lifecycle components
    const handleStatusChange = (cveId, newStatus) => {
        setVulnStatuses(prev => ({
            ...prev,
            [cveId]: { status: newStatus, updatedAt: new Date().toISOString() }
        }));
    };

    // Handle asset click
    const handleAssetClick = (asset) => {
        setSelectedAsset(asset);
        setIsPanelOpen(true);
    };

    // Close panel
    const handleClosePanel = () => {
        setIsPanelOpen(false);
        setTimeout(() => setSelectedAsset(null), 300);
    };

    // Get vulnerabilities for selected asset
    const getSelectedAssetVulns = () => {
        if (!selectedAsset || !vulnerabilities?.byAsset) return [];
        return vulnerabilities.byAsset[selectedAsset.id] || [];
    };

    // Render special auth views (full-page)
    if (authView === 'verify') {
        return <VerifyEmail token={authToken} onComplete={handleAuthViewComplete} />;
    }
    if (authView === 'reset') {
        return (
            <ResetPassword
                token={authToken}
                onComplete={() => {
                    setAuthView(null);
                    setAuthToken(null);
                    window.history.replaceState(null, '', '/');
                    setShowLoginModal(true);
                }}
            />
        );
    }
    if (authView === 'forgot') {
        return (
            <ForgotPassword
                onBack={() => {
                    setAuthView(null);
                    setShowLoginModal(true);
                }}
            />
        );
    }
    if (authView === 'settings' && isLoggedIn) {
        return (
            <Settings
                user={user}
                onBack={() => setAuthView(null)}
                onAssetsChanged={(ids) => setUserAssets(ids)}
                onCloudRegionsChanged={(regions) => setUserCloudRegions(regions)}
            />
        );
    }

    return (
        <div className={`app ${isSidebarCollapsed ? 'sidebar-collapsed' : ''} ${isNewsFeedCollapsed ? 'news-collapsed' : ''} ${isMobileSidebarOpen ? 'mobile-sidebar-open' : ''}`}>
            <div className="mobile-header">
                <button
                    className="mobile-menu-btn"
                    onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                    aria-label="Toggle menu"
                >
                    <Menu size={20} />
                </button>
                <div className="mobile-logo">
                    <img src={`${import.meta.env.BASE_URL}horus_scope_logo.png`} alt="Horus Scope" className="mobile-logo-img" />
                    <span className="mobile-logo-text">HORUS SCOPE</span>
                </div>
                <div className="mobile-header-right">
                    {isLoggedIn ? (
                        <button className="mobile-auth-btn" onClick={handleLogout} aria-label="Logout" title={user?.email}>
                            <LogOut size={18} />
                        </button>
                    ) : (
                        <button className="mobile-auth-btn" onClick={() => setShowLoginModal(true)} aria-label="Sign in">
                            Sign In
                        </button>
                    )}
                    <button
                        className="mobile-news-btn"
                        onClick={() => setIsMobileNewsOpen(!isMobileNewsOpen)}
                        aria-label="Toggle news"
                    >
                        <Newspaper size={20} />
                    </button>
                </div>
            </div>

            <div
                className={`sidebar-overlay ${isMobileSidebarOpen ? 'visible' : ''}`}
                onClick={() => setIsMobileSidebarOpen(false)}
            />

            <Sidebar
                selectedCategory={selectedCategory}
                onCategorySelect={(cat) => {
                    setSelectedCategory(cat);
                    setIsMobileSidebarOpen(false);
                }}
                vulnCounts={filteredVulnCounts}
                lastUpdated={vulnerabilities?.fetchedAt}
                onRefresh={handleRefresh}
                isLoading={isLoading}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                selectedVendor={selectedVendor}
                onVendorSelect={(vendor) => {
                    handleVendorSelect(vendor);
                    setIsMobileSidebarOpen(false);
                }}
                selectedSubcategory={selectedSubcategory}
                onSubcategorySelect={(subcat) => {
                    handleSubcategorySelect(subcat);
                    setIsMobileSidebarOpen(false);
                }}
                activeView={activeView}
                onActiveViewChange={(view) => {
                    setActiveView(view);
                    setIsMobileSidebarOpen(false);
                }}
                isLoggedIn={isLoggedIn}
                user={user}
                onSignInClick={() => setShowLoginModal(true)}
                onLogoutClick={handleLogout}
                onSettingsClick={() => setAuthView('settings')}
            />

            <main className="main-content">
                {activeView === 'pulse' ? (
                    <Pulse userCloudRegions={userCloudRegions} />
                ) : (
                    <>
                        <Dashboard
                            selectedCategory={selectedCategory}
                            timeRange={timeRange}
                            onTimeRangeChange={handleTimeRangeChange}
                            vulnerabilities={filteredVulnerabilities}
                            vulnCounts={filteredVulnCounts}
                            stats={filteredStats}
                            isLoading={isLoading}
                            loadingProgress={loadingProgress}
                            onAssetClick={handleAssetClick}
                            selectedAsset={selectedAsset}
                            viewMode={viewMode}
                            selectedVendor={selectedVendor}
                            selectedSubcategory={selectedSubcategory}
                            isAuthenticated={isLoggedIn}
                            vulnStatuses={vulnStatuses}
                            slaConfig={slaConfig}
                            userAssets={userAssets}
                        />

                        <aside className={`news-panel ${isNewsFeedCollapsed ? 'collapsed' : ''}`}>
                            <NewsFeed
                                isCollapsed={isNewsFeedCollapsed}
                                onToggleCollapse={() => setIsNewsFeedCollapsed(!isNewsFeedCollapsed)}
                            />
                        </aside>
                    </>
                )}
            </main>

            <AlertsList
                asset={selectedAsset}
                vulnerabilities={getSelectedAssetVulns()}
                isOpen={isPanelOpen}
                onClose={handleClosePanel}
                isAuthenticated={isLoggedIn}
                slaConfig={slaConfig}
                vulnStatuses={vulnStatuses}
                onStatusChange={handleStatusChange}
            />

            {/* Mobile news overlay */}
            <div className={`mobile-news-overlay ${isMobileNewsOpen ? 'open' : ''}`}>
                <NewsFeed
                    isCollapsed={false}
                    onToggleCollapse={() => setIsMobileNewsOpen(false)}
                />
            </div>
            {isMobileNewsOpen && (
                <div
                    className="mobile-news-backdrop"
                    onClick={() => setIsMobileNewsOpen(false)}
                />
            )}

            {/* Verification Banner */}
            {isLoggedIn && user && !user.emailVerified && showVerificationBanner && (
                <div className="verification-banner">
                    <AlertTriangle size={16} />
                    <span>Please verify your email address to unlock all features.</span>
                    <button
                        className="verification-banner-resend"
                        onClick={async () => {
                            try {
                                await resendVerification();
                                alert('Verification email sent!');
                            } catch { /* ignore */ }
                        }}
                    >
                        Resend Link
                    </button>
                    <button
                        className="verification-banner-close"
                        onClick={() => setShowVerificationBanner(false)}
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Login Modal */}
            {showLoginModal && !isLoggedIn && (
                <div className="login-modal-overlay" onClick={() => setShowLoginModal(false)}>
                    <div onClick={(e) => e.stopPropagation()}>
                        <LoginPage onLogin={handleLogin} onForgotPassword={handleForgotPassword} />
                    </div>
                </div>
            )}

            {error && (
                <div style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    background: 'var(--severity-critical-bg)',
                    border: '1px solid var(--severity-critical)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-4)',
                    color: 'var(--severity-critical)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    zIndex: 1000,
                    maxWidth: '400px'
                }}>
                    <span>Error: {error}</span>
                    <button
                        onClick={() => setError(null)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'inherit',
                            cursor: 'pointer',
                            fontSize: '20px',
                            flexShrink: 0
                        }}
                    >×</button>
                </div>
            )}
        </div>
    );
}

export default App;
