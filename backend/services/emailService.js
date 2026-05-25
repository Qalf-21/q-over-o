'use strict';

const { logger } = require('../utils/logger');

const DEFAULT_TIMEOUT_MS = 10_000;

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const isEmailConfigured = () => Boolean(
  process.env.EMAIL_LOG_ONLY === 'true' ||
  (process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
);

const appBaseUrl = () => (
  process.env.APP_PUBLIC_URL ||
  process.env.FRONTEND_URL ||
  'http://localhost:5173'
).replace(/\/+$/, '');

const absoluteAppUrl = (linkUrl) => {
  if (!linkUrl || typeof linkUrl !== 'string') return null;
  try {
    return new URL(linkUrl, `${appBaseUrl()}/`).toString();
  } catch {
    return null;
  }
};

const renderNotificationEmail = ({ title, message, linkUrl }) => {
  const safeTitle = escapeHtml(title || 'Notification');
  const safeMessage = escapeHtml(message || '');
  const actionUrl = absoluteAppUrl(linkUrl);
  const safeActionUrl = actionUrl ? escapeHtml(actionUrl) : null;

  const text = [
    title || 'Notification',
    '',
    message || '',
    actionUrl ? `Open in Q-over-o: ${actionUrl}` : '',
  ].filter(Boolean).join('\n');

  const html = `
    <div style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#4f46e5;">Q-over-o</p>
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0f172a;">${safeTitle}</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">${safeMessage}</p>
        ${safeActionUrl ? `<a href="${safeActionUrl}" style="display:inline-block;border-radius:8px;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 16px;">Open notification</a>` : ''}
      </div>
    </div>
  `;

  return { text, html };
};

async function postJsonWithTimeout(url, options, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function sendEmail({ to, subject, text, html, metadata = {} }) {
  if (!to) return { skipped: true, reason: 'missing_recipient' };
  if (!isEmailConfigured()) return { skipped: true, reason: 'email_not_configured' };

  if (process.env.EMAIL_LOG_ONLY === 'true') {
    logger.info({ event: 'email_log_only', to, subject, metadata }, 'Email notification prepared');
    return { skipped: false, provider: 'log' };
  }

  const response = await postJsonWithTimeout('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
      html,
      reply_to: process.env.EMAIL_REPLY_TO || undefined,
      tags: metadata.type ? [{ name: 'notification_type', value: String(metadata.type).slice(0, 256) }] : undefined,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Email provider rejected notification: ${response.status} ${body.slice(0, 300)}`);
  }

  const data = await response.json().catch(() => ({}));
  return { skipped: false, provider: 'resend', id: data.id };
}

async function sendNotificationEmail({ to, title, message, linkUrl, type, userId }) {
  const { text, html } = renderNotificationEmail({ title, message, linkUrl });
  return sendEmail({
    to,
    subject: title || 'Q-over-o notification',
    text,
    html,
    metadata: { type, userId },
  });
}

module.exports = {
  absoluteAppUrl,
  isEmailConfigured,
  sendEmail,
  sendNotificationEmail,
};
