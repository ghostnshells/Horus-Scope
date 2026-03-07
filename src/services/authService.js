// Frontend authentication service
// Handles token storage, auto-refresh, and authenticated API calls

const AUTH_API = '/api/auth';
const TOKEN_KEY = 'horus_scope_access_token';
const REFRESH_KEY = 'horus_scope_refresh_token';
const USER_KEY = 'horus_scope_user';

/**
 * Get stored access token
 */
export function getAccessToken() {
    return localStorage.getItem(TOKEN_KEY);
}

/**
 * Get stored refresh token
 */
export function getRefreshToken() {
    return localStorage.getItem(REFRESH_KEY);
}

/**
 * Get stored user info
 */
export function getStoredUser() {
    try {
        const user = localStorage.getItem(USER_KEY);
        return user ? JSON.parse(user) : null;
    } catch {
        return null;
    }
}

/**
 * Store tokens and user info
 */
export function storeAuth(accessToken, refreshToken, user) {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
    if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
}

/**
 * Update stored user data (e.g. after email verification)
 */
export function updateStoredUser(updates) {
    const current = getStoredUser();
    if (current) {
        localStorage.setItem(USER_KEY, JSON.stringify({ ...current, ...updates }));
    }
}

/**
 * Clear all auth data
 */
export function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
}

/**
 * Check if user is authenticated (has tokens)
 */
export function isAuthenticated() {
    return !!getAccessToken();
}

/**
 * Sign up a new user
 */
export async function signup(email, password) {
    const response = await fetch(`${AUTH_API}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
    }

    storeAuth(data.accessToken, data.refreshToken, data.user);
    return data.user;
}

/**
 * Log in with email and password
 */
export async function login(email, password) {
    const response = await fetch(`${AUTH_API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Login failed');
    }

    storeAuth(data.accessToken, data.refreshToken, data.user);
    return data.user;
}

/**
 * Refresh the access token using the refresh token
 */
export async function refreshTokens() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
        throw new Error('No refresh token available');
    }

    const response = await fetch(`${AUTH_API}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
    });

    const data = await response.json();

    if (!response.ok) {
        clearAuth();
        throw new Error(data.error || 'Token refresh failed');
    }

    storeAuth(data.accessToken, data.refreshToken, getStoredUser());
    return data.accessToken;
}

/**
 * Log out — revoke refresh token and clear local storage
 */
export async function logout() {
    const refreshToken = getRefreshToken();

    try {
        if (refreshToken) {
            await fetch(`${AUTH_API}/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });
        }
    } catch {
        // Best effort — clear local state regardless
    }

    clearAuth();
}

/**
 * Fetch with automatic token refresh on 401
 */
export async function fetchWithAuth(url, options = {}) {
    const accessToken = getAccessToken();

    if (!accessToken) {
        throw new Error('Not authenticated');
    }

    const authOptions = {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${accessToken}`
        }
    };

    let response = await fetch(url, authOptions);

    // If 401, try to refresh the token and retry
    if (response.status === 401) {
        try {
            const newToken = await refreshTokens();
            authOptions.headers['Authorization'] = `Bearer ${newToken}`;
            response = await fetch(url, authOptions);
        } catch {
            clearAuth();
            throw new Error('Session expired. Please log in again.');
        }
    }

    return response;
}

/**
 * Get current user from API
 */
export async function getCurrentUser() {
    const response = await fetchWithAuth(`${AUTH_API}/me`);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Failed to get user');
    }

    return data.user;
}

/**
 * Verify email with token from link
 */
export async function verifyEmailToken(token) {
    const response = await fetch(`${AUTH_API}/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
    }
    return data;
}

/**
 * Resend verification email
 */
export async function resendVerification() {
    const response = await fetchWithAuth(`${AUTH_API}/resend-verification`, {
        method: 'POST'
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to resend verification');
    }
    return data;
}

/**
 * Request password reset email
 */
export async function forgotPassword(email) {
    const response = await fetch(`${AUTH_API}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email');
    }
    return data;
}

/**
 * Reset password with token from email
 */
export async function resetPasswordWithToken(token, password) {
    const response = await fetch(`${AUTH_API}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Password reset failed');
    }
    return data;
}
