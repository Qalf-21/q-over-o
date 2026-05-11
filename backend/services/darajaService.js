/**
 * backend/services/darajaService.js
 *
 * Safaricom Daraja STK Push + Query Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibilities:
 *   1. Initiate STK Push (CustomerPayBillOnline)
 *   2. Query Daraja for transaction status (STK Query)
 *   3. Timestamp + password generation
 *   4. Structured error handling with auto token refresh on 401
 *
 * Never:
 *   — Logs passkey or consumer secret
 *   — Credits wallets (that is the callback handler's job after verification)
 *   — Trusts frontend phone numbers directly (caller must normalise first)
 */

'use strict';

const axios = require('axios');
const { getAccessToken, invalidateToken } = require('../utils/darajaAuth');
const { logger, auditPayment } = require('../utils/logger');
const { AppError } = require('../utils/errorHandler');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generate a Daraja-format timestamp: YYYYMMDDHHmmss
 */
function generateTimestamp() {
  return new Date()
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14);
}

/**
 * Generate the STK Push password.
 * Formula: Base64(Shortcode + Passkey + Timestamp)
 */
function generateStkPassword(timestamp) {
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey   = process.env.MPESA_PASSKEY;

  if (!shortcode || !passkey) {
    throw new AppError('MPESA_SHORTCODE and MPESA_PASSKEY must be set', 500, 'CONFIG_ERROR');
  }

  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

// ── Axios instance with retry-on-401 ─────────────────────────────────────────

async function darajaPost(path, payload, correlationId) {
  const baseURL = process.env.MPESA_BASE_URL;
  if (!baseURL) throw new AppError('MPESA_BASE_URL must be set', 500, 'CONFIG_ERROR');

  const url = `${baseURL}${path}`;

  // Attempt once, then retry with a fresh token if Safaricom returns 401
  for (let attempt = 1; attempt <= 2; attempt++) {
    const token = await getAccessToken();

    try {
      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 30_000,
      });

      return response.data;
    } catch (err) {
      const status  = err.response?.status;
      const errData = err.response?.data;

      if (status === 401 && attempt === 1) {
        logger.warn(
          { event: 'daraja_401_refresh', correlationId },
          'Daraja returned 401 — invalidating token and retrying',
        );
        invalidateToken();
        continue; // retry loop
      }

      logger.error(
        { event: 'daraja_http_error', status, errData, correlationId, attempt },
        'Daraja API request failed',
      );

      // Translate Daraja error codes to friendly messages
      const darajaMsg = errData?.errorMessage || errData?.ResponseDescription || err.message;
      throw new AppError(`Daraja API error: ${darajaMsg}`, 502, 'DARAJA_API_ERROR');
    }
  }
}

// ── STK Push ──────────────────────────────────────────────────────────────────

/**
 * Initiate an STK Push to the customer's phone.
 *
 * @param {object} params
 * @param {string} params.phone             - Normalised phone (2547XXXXXXXX)
 * @param {number} params.amountKes         - Amount in KES (integer)
 * @param {string} params.accountReference  - Short reference shown on customer's phone
 * @param {string} params.description       - Transaction description
 * @param {string} params.correlationId     - Trace ID
 *
 * @returns {{ checkoutRequestId, merchantRequestId, responseDescription }}
 */
async function initiateSTKPush({ phone, amountKes, accountReference, description, correlationId }) {
  const shortcode  = process.env.MPESA_SHORTCODE;
  const callbackURL = process.env.MPESA_CALLBACK_URL;

  if (!shortcode || !callbackURL) {
    throw new AppError('MPESA_SHORTCODE and MPESA_CALLBACK_URL must be set', 500, 'CONFIG_ERROR');
  }

  if (!Number.isInteger(amountKes) || amountKes < 1) {
    throw new AppError('Amount must be a positive integer (KES)', 400, 'INVALID_AMOUNT');
  }

  const timestamp = generateTimestamp();
  const password  = generateStkPassword(timestamp);

  const payload = {
    BusinessShortCode: shortcode,
    Password:          password,
    Timestamp:         timestamp,
    TransactionType:   'CustomerPayBillOnline',
    Amount:            amountKes,
    PartyA:            phone,
    PartyB:            shortcode,
    PhoneNumber:       phone,
    CallBackURL:       callbackURL,
    AccountReference:  accountReference.slice(0, 12),  // Safaricom max 12 chars
    TransactionDesc:   description.slice(0, 13),        // Safaricom max 13 chars
  };

  auditPayment({
    event:             'stk_push_initiated',
    correlationId,
    phone:             phone.replace(/(\d{3})\d{6}(\d{3})/, '$1******$2'), // mask middle digits
    amountKes,
    accountReference,
  });

  const data = await darajaPost(
    '/mpesa/stkpush/v1/processrequest',
    payload,
    correlationId,
  );

  if (data.ResponseCode !== '0') {
    logger.error(
      { event: 'stk_push_rejected', data, correlationId },
      'Safaricom rejected STK Push',
    );
    throw new AppError(
      `STK Push rejected: ${data.ResponseDescription || 'Unknown reason'}`,
      502,
      'STK_PUSH_REJECTED',
    );
  }

  auditPayment({
    event:              'stk_push_accepted',
    correlationId,
    checkoutRequestId:  data.CheckoutRequestID,
    merchantRequestId:  data.MerchantRequestID,
  });

  return {
    checkoutRequestId:   data.CheckoutRequestID,
    merchantRequestId:   data.MerchantRequestID,
    responseDescription: data.ResponseDescription,
    customerMessage:     data.CustomerMessage,
  };
}

// ── STK Query (status verification) ──────────────────────────────────────────

/**
 * Query Safaricom for the status of an STK Push transaction.
 * Use this AFTER receiving a callback to independently verify the result.
 *
 * @param {string} checkoutRequestId  - From the original STK Push response
 * @param {string} correlationId
 *
 * @returns {{ resultCode, resultDesc, status: 'success'|'failed'|'pending' }}
 */
async function queryStkStatus(checkoutRequestId, correlationId) {
  const shortcode = process.env.MPESA_SHORTCODE;
  const timestamp = generateTimestamp();
  const password  = generateStkPassword(timestamp);

  const payload = {
    BusinessShortCode: shortcode,
    Password:          password,
    Timestamp:         timestamp,
    CheckoutRequestID: checkoutRequestId,
  };

  auditPayment({
    event: 'stk_query_initiated',
    correlationId,
    checkoutRequestId,
  });

  const data = await darajaPost(
    '/mpesa/stkpushquery/v1/query',
    payload,
    correlationId,
  );

  const resultCode = String(data.ResultCode ?? data.errorCode ?? '-1');
  const resultDesc = data.ResultDesc || data.errorMessage || 'Unknown';

  let status;
  if (resultCode === '0') {
    status = 'success';
  } else if (resultCode === '1032' || resultCode === '1037') {
    // 1032 = request cancelled by user, 1037 = timeout
    status = 'failed';
  } else if (resultCode === '500.001.1001') {
    // Query too early — transaction not yet processed
    status = 'pending';
  } else {
    status = 'failed';
  }

  auditPayment({
    event:  'stk_query_result',
    correlationId,
    checkoutRequestId,
    resultCode,
    resultDesc,
    status,
  });

  return { resultCode, resultDesc, status };
}

module.exports = { initiateSTKPush, queryStkStatus, generateTimestamp, generateStkPassword };