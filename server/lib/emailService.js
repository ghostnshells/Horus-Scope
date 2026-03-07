// Email service using Resend

import { Resend } from 'resend';

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const FROM_EMAIL = process.env.FROM_EMAIL || 'Horus Scope <noreply@horus-scope.com>';

let resend;
function getResend() {
    if (!resend) {
        if (!process.env.RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY is not configured');
        }
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
}

function emailWrapper(title, body) {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;background:#0a0e17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.card{max-width:480px;margin:40px auto;background:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:40px}
h1{color:#37a8a8;font-size:20px;margin:0 0 8px;letter-spacing:0.05em}
h2{color:#e5e7eb;font-size:18px;margin:0 0 16px}
p{color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 16px}
.btn{display:inline-block;padding:12px 32px;background:#37a8a8;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px}
.footer{color:#6b7280;font-size:12px;margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06)}
</style></head><body><div class="card">
<h1>HORUS SCOPE</h1>
<h2>${title}</h2>
${body}
</div></body></html>`;
}

export async function sendVerificationEmail(email, token) {
    const link = `${APP_URL}/verify-email?token=${token}`;
    const html = emailWrapper('Verify Your Email', `
<p>Thanks for signing up. Please verify your email address to unlock all features.</p>
<p><a class="btn" href="${link}">Verify Email</a></p>
<p>Or copy this link:<br><span style="color:#6b7280;word-break:break-all;font-size:12px">${link}</span></p>
<div class="footer">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</div>
`);

    await getResend().emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: 'Verify your Horus Scope email',
        html
    });
}

export async function sendPasswordResetEmail(email, token) {
    const link = `${APP_URL}/reset-password?token=${token}`;
    const html = emailWrapper('Reset Your Password', `
<p>We received a request to reset your password. Click the button below to choose a new one.</p>
<p><a class="btn" href="${link}">Reset Password</a></p>
<p>Or copy this link:<br><span style="color:#6b7280;word-break:break-all;font-size:12px">${link}</span></p>
<div class="footer">This link expires in 1 hour. If you didn't request a password reset, you can ignore this email.</div>
`);

    await getResend().emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: 'Reset your Horus Scope password',
        html
    });
}
