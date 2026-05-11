/**
 * backend/utils/darajaAuth.js
 *
 * Daraja OAuth 2.0 Access Token Manager
 * ─────────────────────────────────────────────────────────────────────────────
 * • Fetches a Safaricom Daraja access token via client_credentials grant
 * • Caches the token in memory for 55 minutes (token TTL is 3600s / 60 min)
 * • Never regenerates a token unnecessarily
 * • Thread-safe refresh via in-flight promise deduplication
 * • Never logs or exposes the consumer secret or raw token in production
 */

'use strict';

const axios = require('axios');
const logger = require('./logger');

// ── In-memory token cache ─────────────────────────────────────────────────────
let _cachedToken = null;     // { value: string, expiresAt: Date }
let _refreshPromise = null;  // deduplicate concurrent refresh calls

/** Token lifetime in ms — 55 min, leaving a 5-min safety window before the
 *  Safaricom 60-min hard expiry. */
const TOKEN_TTL_MS = 55 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function _buildBasicAuth() {
  const key    = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;

  if (!key || !secret) {
    throw new Error('MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET must be set');
  }

  return Buffer.from(`${key}:${secret}`).toString('base64');
}

function _isTokenValid() {
  return (
    _cachedToken !== null &&
    _cachedToken.value &&
    new Date() < _cachedToken.expiresAt
  );
}

// ── Core fetch ────────────────────────────────────────────────────────────────

async function _fetchFreshToken() {
  const baseURL = process.env.MPESA_BASE_URL;
  if (!baseURL) throw new Error('MPESA_BASE_URL must be set');

  const url  = `${baseURL}/oauth/v1/generate?grant_type=client_credentials`;
  const auth = _buildBasicAuth();

  logger.info({ event: 'daraja_token_fetch', url: url.replace(baseURL, '[BASE]') },
    'Fetching Daraja access token');

  const response = await axios.get(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    timeout: 10_000,
  });

  const token = response.data?.access_token;
  if (!token) {
    throw new Error(`Daraja token response missing access_token: ${JSON.stringify(response.data)}`);
  }

  _cachedToken = {
    value:     token,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  };

  logger.info({ event: 'daraja_token_cached', expiresAt: _cachedToken.expiresAt },
    'Daraja access token cached');

  return token;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns a valid Daraja access token.
 * Uses the cached value when still within the 55-minute window.
 * Concurrent callers share a single in-flight refresh promise to prevent
 * hammering the Safaricom OAuth endpoint.
 *
 * @returns {Promise<string>} A valid bearer token
 */
async function getAccessToken() {
  // Fast path: use cached token
  if (_isTokenValid()) {
    logger.debug({ event: 'daraja_token_cache_hit' }, 'Returning cached Daraja token');
    return _cachedToken.value;
  }

  // Slow path: refresh, deduplicated
  if (!_refreshPromise) {
    _refreshPromise = _fetchFreshToken().finally(() => {
      _refreshPromise = null;
    });
  }

  return _refreshPromise;
}

/**
 * Force-invalidate the cached token (e.g., after a 401 from Safaricom).
 * The next call to getAccessToken() will trigger a fresh fetch.
 */
function invalidateToken() {
  logger.warn({ event: 'daraja_token_invalidated' }, 'Daraja token cache invalidated');
  _cachedToken = null;
}

module.exports = { getAccessToken, invalidateToken };