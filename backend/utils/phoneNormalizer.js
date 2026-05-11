/**
 * backend/utils/phoneNormalizer.js
 *
 * Safaricom phone number normalizer & validator
 * ─────────────────────────────────────────────────────────────────────────────
 * Accepts:
 *   07XXXXXXXX    (10 digits, leading 0)
 *   01XXXXXXXX    (10 digits, Airtel-prefixed Safaricom lines)
 *   +2547XXXXXXXX (E.164, leading +)
 *   2547XXXXXXXX  (E.164, no +)
 *
 * Normalises to: 2547XXXXXXXX (12 digits)
 *
 * Rejects:
 *   — Numbers not matching valid Safaricom prefix ranges
 *   — Numbers with invalid length after prefix normalisation
 */

'use strict';

// Safaricom Kenya prefixes (as of 2024)
// 07: 070, 071, 072, 074, 075, 076, 078, 079
// 01: 011x (Airtel Kenya but some legacy Safaricom SIMs)
// We validate the first 3 digits after 254 to cover mainstream Safaricom ranges.
const SAFARICOM_PREFIXES = new Set([
  '700', '701', '702', '703', '704', '705', '706', '707', '708', '709',
  '710', '711', '712', '713', '714', '715', '716', '717', '718', '719',
  '720', '721', '722', '723', '724', '725', '726', '727', '728', '729',
  '740', '741', '742', '743', '744', '745', '746', '747', '748', '749',
  '750', '751', '752', '753', '754', '755', '756', '757', '758', '759',
  '760', '761', '762', '763', '764', '765', '766', '767', '768', '769',
  '780', '781', '782', '783', '784', '785', '786', '787', '788', '789',
  '790', '791', '792', '793', '794', '795', '796', '797', '798', '799',
  // 01x Safaricom lines
  '110', '111', '112', '113', '114', '115', '116', '117', '118', '119',
]);

/**
 * Normalise a Kenyan phone number to E.164 (no +), e.g. 2547XXXXXXXX.
 *
 * @param   {string} raw  - Raw phone string from client
 * @returns {{ ok: true,  value: string } |
 *           { ok: false, error: string }}
 */
function normalizePhone(raw) {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Phone number must be a string' };
  }

  // Strip whitespace, dashes, parentheses
  let cleaned = raw.replace(/[\s\-().]/g, '');

  // Remove leading +
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }

  // Convert local format → E.164 without +
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = `254${cleaned.slice(1)}`;
  } else if (cleaned.startsWith('254') && cleaned.length === 12) {
    // already normalised
  } else {
    return {
      ok: false,
      error: `Unrecognised phone format: "${raw}". Expected 07XXXXXXXX, 01XXXXXXXX, +2547XXXXXXXX or 2547XXXXXXXX`,
    };
  }

  // Must be exactly 12 digits at this point
  if (!/^\d{12}$/.test(cleaned)) {
    return { ok: false, error: `Phone number has wrong length after normalisation: "${cleaned}"` };
  }

  // Validate country code
  if (!cleaned.startsWith('254')) {
    return { ok: false, error: `Phone number must be a Kenyan number (254 country code)` };
  }

  // Validate Safaricom prefix (positions 3-5 = first 3 digits after 254)
  const prefix = cleaned.slice(3, 6);
  if (!SAFARICOM_PREFIXES.has(prefix)) {
    return {
      ok: false,
      error: `Phone number ${cleaned} does not appear to be a valid Safaricom number`,
    };
  }

  return { ok: true, value: cleaned };
}

/**
 * Convenience wrapper — throws AppError on invalid input.
 *
 * @param   {string} raw
 * @param   {Function} AppError  - your existing AppError class
 * @returns {string}  Normalised phone number
 */
function normalizePhoneOrThrow(raw, AppError) {
  const result = normalizePhone(raw);
  if (!result.ok) {
    throw new AppError(result.error, 400, 'INVALID_PHONE');
  }
  return result.value;
}

module.exports = { normalizePhone, normalizePhoneOrThrow };