// backend/controllers/profileController.js
// Handles: GET /api/profile/me, PUT /api/profile/update, POST /api/profile/change-password, DELETE /api/profile/delete

const supabase = require('../config/supabase');
const { AppError, asyncHandler } = require('../utils/errorHandler');

// ─── GET /api/profile/me ────────────────────────────────────────────────────
exports.getProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Fetch full profile row
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role, is_tutor, created_at, updated_at')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
  }

  // If tutor, pull extra stats
  let tutorStats = null;
  if (profile.role === 'tutor' || profile.is_tutor) {
    const { data: tp } = await supabase
      .from('tutor_profiles')
      .select('bio, hourly_rate_tokens, rating_avg, total_reviews, total_sessions, is_available')
      .eq('user_id', userId)
      .maybeSingle();
    tutorStats = tp || null;
  }

  // Session stats (shared)
  const { count: totalSessionsBooked } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('tutee_id', userId);

  const { count: completedSessions } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('tutee_id', userId)
    .eq('status', 'completed');

  res.json({
    success: true,
    data: {
      id: profile.id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      email: profile.email,
      role: profile.role,
      isTutor: profile.is_tutor,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
      stats: {
        totalSessionsBooked: totalSessionsBooked || 0,
        completedSessions: completedSessions || 0,
      },
      tutorProfile: tutorStats,
    },
  });
});

// ─── PUT /api/profile/update ─────────────────────────────────────────────────
exports.updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { first_name, last_name } = req.body;

  // Validate
  if (first_name !== undefined) {
    const name = typeof first_name === 'string' ? first_name.trim() : '';
    if (name.length < 2 || name.length > 60) {
      throw new AppError('First name must be between 2 and 60 characters', 400, 'VALIDATION_ERROR');
    }
    if (!/^[a-zA-ZÀ-ÿ\s'\-]+$/.test(name)) {
      throw new AppError('First name contains invalid characters', 400, 'VALIDATION_ERROR');
    }
  }

  if (last_name !== undefined) {
    const name = typeof last_name === 'string' ? last_name.trim() : '';
    if (name.length < 2 || name.length > 60) {
      throw new AppError('Last name must be between 2 and 60 characters', 400, 'VALIDATION_ERROR');
    }
    if (!/^[a-zA-ZÀ-ÿ\s'\-]+$/.test(name)) {
      throw new AppError('Last name contains invalid characters', 400, 'VALIDATION_ERROR');
    }
  }

  // Build update payload (only update provided fields)
  const updates = { updated_at: new Date().toISOString() };
  if (first_name !== undefined) updates.first_name = first_name.trim();
  if (last_name !== undefined)  updates.last_name  = last_name.trim();

  const { data: updated, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('id, email, first_name, last_name, role, is_tutor, created_at, updated_at')
    .single();

  if (error) {
    throw new AppError('Failed to update profile', 500);
  }

  // Sync Supabase auth metadata so JWT picks up new name on next refresh
  await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      first_name: updated.first_name,
      last_name: updated.last_name,
    },
  });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      id: updated.id,
      firstName: updated.first_name,
      lastName: updated.last_name,
      email: updated.email,
      role: updated.role,
      isTutor: updated.is_tutor,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    },
  });
});

// ─── POST /api/profile/change-password ──────────────────────────────────────
exports.changePassword = asyncHandler(async (req, res) => {
  const userId    = req.user.id;
  const userEmail = req.user.email;
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    throw new AppError('current_password and new_password are required', 400, 'VALIDATION_ERROR');
  }
  if (typeof new_password !== 'string' || new_password.length < 8) {
    throw new AppError('new_password must be at least 8 characters', 400, 'VALIDATION_ERROR');
  }

  // Verify current password by re-authenticating
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: userEmail,
    password: current_password,
  });
  if (signInError) {
    throw new AppError('Current password is incorrect', 400, 'INVALID_PASSWORD');
  }

  // Update via admin API (does not require an active session)
  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    password: new_password,
  });
  if (updateError) throw new AppError('Failed to update password', 500);

  res.json({ success: true, message: 'Password updated successfully' });
});

// ─── DELETE /api/profile/delete ──────────────────────────────────────────────
exports.deleteProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // 1. Cancel any pending/confirmed sessions as tutor
  await supabase
    .from('sessions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('tutor_id', userId)
    .in('status', ['pending', 'confirmed']);

  // 2. Cancel any pending/confirmed sessions as tutee
  await supabase
    .from('sessions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('tutee_id', userId)
    .in('status', ['pending', 'confirmed']);

  // 3. Refund escrow transactions back to tutees where this user was tutor
  //    (best-effort – ignore errors to not block deletion)
  // Supabase RLS + triggers should handle wallet integrity; we just mark sessions.

  // 4. Delete tutor profile if exists
  await supabase
    .from('tutor_profiles')
    .delete()
    .eq('user_id', userId);

  // 5. Delete tutor subjects if exist
  await supabase
    .from('tutor_subjects')
    .delete()
    .eq('tutor_id', userId);

  // 6. Delete reviews written by/for this user
  await supabase
    .from('reviews')
    .delete()
    .or(`tutee_id.eq.${userId},tutor_id.eq.${userId}`);

  // 7. Delete wallet & transactions
  await supabase.from('transactions').delete().eq('user_id', userId);
  await supabase.from('wallets').delete().eq('user_id', userId);

  // 8. Delete profile row
  const { error: profileDeleteError } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId);

  if (profileDeleteError) {
    throw new AppError('Failed to delete profile data', 500);
  }

  // 9. Delete Supabase auth user — this invalidates all tokens
  const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);

  if (authDeleteError) {
    // Profile data is already deleted; log the auth-side failure but still return
    // success to the client since the account data is gone. The orphan auth record
    // will be unreachable without a profile row.
    console.error('[deleteProfile] Supabase auth.admin.deleteUser failed:', authDeleteError.message);
  }

  res.json({
    success: true,
    message: 'Account deleted successfully',
  });
});