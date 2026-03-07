import React, { useState } from 'react';
import { Shield, Mail, Lock, LogIn, UserPlus, AlertCircle } from 'lucide-react';
import './LoginPage.css';

const LoginPage = ({ onLogin, onForgotPassword }) => {
    const [isSignup, setIsSignup] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (isSignup && password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setIsLoading(true);

        try {
            await onLogin(email, password, isSignup);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <div className="login-logo">
                        <Shield size={32} />
                    </div>
                    <h1 className="login-title">HORUS SCOPE</h1>
                    <p className="login-subtitle">Vulnerability Monitoring Dashboard</p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="login-tabs">
                        <button
                            type="button"
                            className={`login-tab ${!isSignup ? 'active' : ''}`}
                            onClick={() => { setIsSignup(false); setError(null); }}
                        >
                            <LogIn size={14} />
                            Sign In
                        </button>
                        <button
                            type="button"
                            className={`login-tab ${isSignup ? 'active' : ''}`}
                            onClick={() => { setIsSignup(true); setError(null); }}
                        >
                            <UserPlus size={14} />
                            Sign Up
                        </button>
                    </div>

                    {error && (
                        <div className="login-error">
                            <AlertCircle size={14} />
                            {error}
                        </div>
                    )}

                    <div className="login-field">
                        <label className="login-label" htmlFor="email">
                            <Mail size={14} />
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            className="login-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="login-field">
                        <label className="login-label" htmlFor="password">
                            <Lock size={14} />
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            className="login-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Min. 8 characters"
                            required
                            minLength={8}
                            autoComplete={isSignup ? 'new-password' : 'current-password'}
                        />
                    </div>

                    {!isSignup && onForgotPassword && (
                        <button
                            type="button"
                            className="login-forgot-link"
                            onClick={onForgotPassword}
                        >
                            Forgot Password?
                        </button>
                    )}

                    {isSignup && (
                        <div className="login-field">
                            <label className="login-label" htmlFor="confirmPassword">
                                <Lock size={14} />
                                Confirm Password
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                className="login-input"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Re-enter password"
                                required
                                minLength={8}
                                autoComplete="new-password"
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        className="login-submit"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span className="login-spinner" />
                        ) : (
                            <>
                                {isSignup ? <UserPlus size={16} /> : <LogIn size={16} />}
                                {isSignup ? 'Create Account' : 'Sign In'}
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
