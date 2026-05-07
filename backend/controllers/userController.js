// backend/controllers/userController.js
// MODIFIED: hardened becomeTutor — explicit error mapping, idempotent guard
const supabase = require('../config/supabase');
const { AppError, asyncHandler } = require('../utils/errorHandler');

/**
 * POST /api/users/become-tutor
 *
 * Body:
 *   confirm       {boolean}  — must be exactly `true`
 *   bio           {string}   — optional tutor bio (default: '')
 *   hourlyRate    {number}   — optional tokens/hr (default: 500, must be > 0)
 *   subjects      {string[]} — optional array of subject UUIDs
 *
 * Delegates to the `become_tutor_atomic` Supabase RPC which:
 *   1. Updates profiles.role → 'tutor'
 *   2. Upserts tutor_profiles row (idempotent)
 *   3. Inserts tutor_subjects rows (if provided)
 *   4. Initialises wallet if missing
 *
 * Returns 201 on creation, 200 if the user was already a tutor (idempotent).
 */
exports.becomeTutor = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { confirm, bio = '', hourlyRate = 500, subjects = [] } = req.body;

  // ── Validation ────────────────────────────────────────────────────────────
  if (confirm !== true) {
    throw new AppError(
      'Confirmation is required to become a tutor',
      400,
      'CONFIRMATION_REQUIRED',
    );
  }

  const rate = Number(hourlyRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new AppError('hourlyRate must be a positive number', 400, 'VALIDATION_ERROR');
  }

  if (!Array.isArray(subjects)) {
    throw new AppError('subjects must be an array of subject IDs', 400, 'VALIDATION_ERROR');
  }

  // ── Idempotency guard ─────────────────────────────────────────────────────
  // If the user is already a tutor we return success without re-running the RPC.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (profileError) {
    throw new AppError('Failed to fetch user profile', 500);
  }

  if (profile?.role === 'tutor') {
    return res.status(200).json({
      success: true,
      message: 'Already a tutor',
      data: { alreadyTutor: true },
    });
  }

  // ── Run atomic RPC ────────────────────────────────────────────────────────
  const { data, error } = await supabase.rpc('become_tutor_atomic', {
    p_user_id:            userId,
    p_bio:                String(bio || '').trim(),
    p_hourly_rate_tokens: rate,
    p_subject_ids:        subjects,
  });

  if (error) {
    // Surface meaningful messages from DB-level checks
    const msg = error.message || 'Failed to create tutor profile';
    throw new AppError(msg, 400);
  }

  res.status(201).json({
    success: true,
    message: 'Tutor profile created successfully',
    data,
  });
});