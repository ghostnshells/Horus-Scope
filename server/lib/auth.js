// Authentication service — PostgreSQL-backed user management and JWT tokens

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'heimdall-dev-secret-change-me';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Create a new user
 */
export async function createUser(email, password) {
    const normalizedEmail = email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(password, 12);

    try {
        const { rows } = await pool.query(
            `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING email, created_at`,
            [normalizedEmail, passwordHash]
        );
        return { email: rows[0].email, createdAt: rows[0].created_at.toISOString() };
    } catch (err) {
        if (err.code === '23505') { // unique_violation
            throw new Error('User already exists');
        }
        throw err;
    }
}

/**
 * Validate password for a user
 */
export async function validatePassword(email, password) {
    const normalizedEmail = email.toLowerCase().trim();
    const { rows } = await pool.query(
        `SELECT email, password_hash, created_at FROM users WHERE email = $1`,
        [normalizedEmail]
    );

    if (rows.length === 0) {
        throw new Error('Invalid credentials');
    }

    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
        throw new Error('Invalid credentials');
    }

    return { email: user.email, createdAt: user.created_at.toISOString() };
}

/**
 * Generate access + refresh token pair
 */
export function generateTokens(email) {
    const accessToken = jwt.sign(
        { email, type: 'access' },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
        { email, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
}

/**
 * Verify an access token
 */
export function verifyAccessToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.type !== 'access') {
            throw new Error('Invalid token type');
        }
        return decoded;
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
}

/**
 * Verify a refresh token
 */
export function verifyRefreshToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.type !== 'refresh') {
            throw new Error('Invalid token type');
        }
        return decoded;
    } catch (error) {
        throw new Error('Invalid or expired refresh token');
    }
}

/**
 * Store refresh token in database (for revocation tracking)
 */
export async function storeRefreshToken(refreshToken, email) {
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000);
    await pool.query(
        `INSERT INTO sessions (refresh_token, email, expires_at) VALUES ($1, $2, $3)`,
        [refreshToken, email, expiresAt]
    );
}

/**
 * Check if a refresh token is still valid (not revoked)
 */
export async function isRefreshTokenValid(refreshToken) {
    const { rows } = await pool.query(
        `SELECT email FROM sessions WHERE refresh_token = $1 AND expires_at > NOW()`,
        [refreshToken]
    );
    return rows.length ? rows[0].email : null;
}

/**
 * Revoke a refresh token
 */
export async function revokeRefreshToken(refreshToken) {
    await pool.query(
        `DELETE FROM sessions WHERE refresh_token = $1`,
        [refreshToken]
    );
}

/**
 * Get user info (without password hash)
 */
export async function getUser(email) {
    const normalizedEmail = email.toLowerCase().trim();
    const { rows } = await pool.query(
        `SELECT email, created_at FROM users WHERE email = $1`,
        [normalizedEmail]
    );
    if (rows.length === 0) return null;
    return { email: rows[0].email, createdAt: rows[0].created_at.toISOString() };
}
