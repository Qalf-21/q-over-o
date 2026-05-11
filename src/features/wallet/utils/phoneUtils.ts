// ─────────────────────────────────────────────────────────────────────────────
// src/features/wallet/utils/phoneUtils.ts
//
// Client-side phone number handling for Kenyan M-Pesa numbers.
// Mirrors the backend phoneNormalizer.js logic so the user gets immediate
// feedback without a round-trip.
// ─────────────────────────────────────────────────────────────────────────────

import type { PhoneValidationResult } from '../../../types/wallet';

const SAFARICOM_PREFIXES = new Set([
  '701', '702', '703', '704', '705', '706', '707', '708', '709',
  '710', '711', '712', '713', '714', '715', '716', '717', '718', '719',
  '720', '721', '722', '723', '724', '725', '726', '727', '728', '729',
  '740', '741', '742', '743', '745', '746', '748',
  '757', '758', '759',
  '768', '769',
  '790', '791', '792', '793', '794', '795', '796', '797', '798', '799',
  '110', '111', '112',
]);

/**
 * Normalise and validate a Kenyan phone number.
 *
 * Accepted formats:
 *   07XXXXXXXX   → 2547XXXXXXXX
 *   01XXXXXXXX   → 2541XXXXXXXX
 *   +2547XXXXXXXX / +2541XXXXXXXX
 *    2547XXXXXXXX /  2541XXXXXXXX
 */
export function validatePhone(raw: string): PhoneValidationResult {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, error: 'Please enter a phone number' };
  }

  // Strip whitespace, dashes, brackets
  let cleaned = raw.replace(/[\s\-().]/g, '');

  // Remove leading +
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }

  // Convert local format → E.164 without +
  if (/^0[71]\d{8}$/.test(cleaned)) {
    // 07XXXXXXXX or 01XXXXXXXX → 10 digits
    cleaned = `254${cleaned.slice(1)}`;
  } else if (/^254[71]\d{8}$/.test(cleaned)) {
    // already normalised — 12 digits
  } else {
    return {
      valid: false,
      error: 'Enter a valid Safaricom number: 07XX XXX XXX or 01XX XXX XXX',
    };
  }

  if (cleaned.length !== 12 || !/^\d{12}$/.test(cleaned)) {
    return { valid: false, error: 'Phone number is incomplete' };
  }

  const prefix = cleaned.slice(3, 6);
  if (!SAFARICOM_PREFIXES.has(prefix)) {
    return {
      valid: false,
      error: 'This number doesn\'t appear to be a Safaricom number',
    };
  }

  // Display format: 07XX XXX XXX
  const local = `0${cleaned.slice(3)}`;
  const display = `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;

  return { valid: true, normalized: cleaned, display };
}

/**
 * Auto-format a phone input as the user types.
 * Converts to "07XX XXX XXX" display form.
 */
export function formatPhoneInput(raw: string): string {
  // Keep only digits
  const digits = raw.replace(/\D/g, '');

  // Convert 254… prefix to 07… for display
  let local = digits;
  if (local.startsWith('254') && local.length > 3) {
    local = `0${local.slice(3)}`;
  }

  // Apply 07XX XXX XXX mask
  if (local.length <= 4)  return local;
  if (local.length <= 7)  return `${local.slice(0, 4)} ${local.slice(4)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7, 10)}`;
}

/**
 * Strip formatting before sending to backend / validation.
 */
export function stripPhoneFormat(formatted: string): string {
  return formatted.replace(/\s/g, '');
}