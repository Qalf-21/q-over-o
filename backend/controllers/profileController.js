// backend/controllers/profileController.js
// FIXED: removed total_sessions from tutor_profiles select (column does not exist)
const supabase = require('../config/supabase');
const { AppError, asyncHandler } = require('../utils/errorHandler');
const { getTutorQualificationStatus } = require('../services/tutorQualificationService');

// GET /api/profile/me
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

  // If tutor, pull tutor-specific stats (only columns that exist in tutor_profiles)
  let tutorStats = null;
  if (profile.role === 'tutor' || profile.is_tutor) {
    const qualification = await getTutorQualificationStatus(userId);
    const { data: tp } = await supabase
      .from('tutor_profiles')
      .select('bio, hourly_rate_tokens, rating_avg, total_reviews, is_verified')
      .eq('user_id', userId)
      .maybeSingle();

    tutorStats = tp
      ? {
          bio:                tp.bio,
          hourly_rate_tokens: tp.hourly_rate_tokens,
          rating_avg:         tp.rating_avg,
          total_reviews:      tp.total_reviews,
          is_verified:        tp.is_verified,
          qualification,
          total_sessions:      qualification.completedSessions,
        }
      : null;
  }

  // Session stats (shared for tutee activity)
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
      id:        profile.id,
      firstName: profile.first_name,
      lastName:  profile.last_name,
      email:     profile.email,
      role:      profile.role,
      isTutor:   profile.is_tutor,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
      stats: {
        totalSessionsBooked: totalSessionsBooked || 0,
        completedSessions:   completedSessions   || 0,
      },
      tutorProfile: tutorStats,
    },
  });
});

// PUT /api/profile/update
exports.updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { first_name, last_name } = req.body;

  if (first_name !== undefined) {
    const name = typeof first_name === 'string' ? first_name.trim() : '';
    if (name.length < 2 || name.length > 60) {
      throw new AppError('First name must be between 2 and 60 characters', 400, 'VALIDATION_ERROR');
    }
    if (!/^[a-zA-Z\s'\-]+$/.test(name)) {
      throw new AppError('First name contains invalid characters', 400, 'VALIDATION_ERROR');
    }
  }

  if (last_name !== undefined) {
    const name = typeof last_name === 'string' ? last_name.trim() : '';
    if (name.length < 2 || name.length > 60) {
      throw new AppError('Last name must be between 2 and 60 characters', 400, 'VALIDATION_ERROR');
    }
    if (!/^[a-zA-Z\s'\-]+$/.test(name)) {
      throw new AppError('Last name contains invalid characters', 400, 'VALIDATION_ERROR');
    }
  }

  const updates = { updated_at: new Date().toISOString() };
  if (first_name !== undefined) updates.first_name = first_name.trim();
  if (last_name  !== undefined) updates.last_name  = last_name.trim();

  const { data: updated, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('id, email, first_name, last_name, role, is_tutor, created_at, updated_at')
    .single();

  if (error) {
    throw new AppError('Failed to update profile', 500);
  }

  await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      first_name: updated.first_name,
      last_name:  updated.last_name,
    },
  });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      id:        updated.id,
      firstName: updated.first_name,
      lastName:  updated.last_name,
      email:     updated.email,
      role:      updated.role,
      isTutor:   updated.is_tutor,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    },
  });
});

// POST /api/profile/change-password
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

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email:    userEmail,
    password: current_password,
  });
  if (signInError) {
    throw new AppError('Current password is incorrect', 400, 'INVALID_PASSWORD');
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    password: new_password,
  });
  if (updateError) throw new AppError('Failed to update password', 500);

  res.json({ success: true, message: 'Password updated successfully' });
});

// DELETE /api/profile/delete
exports.deleteProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  await supabase
    .from('sessions')
    .update({ status: 'cancelled' })
    .eq('tutor_id', userId)
    .in('status', ['pending', 'confirmed']);

  await supabase
    .from('sessions')
    .update({ status: 'cancelled' })
    .eq('tutee_id', userId)
    .in('status', ['pending', 'confirmed']);

  await supabase.from('tutor_profiles').delete().eq('user_id', userId);
  await supabase.from('tutor_subjects').delete().eq('tutor_id', userId);
  await supabase.from('reviews').delete().or(`tutee_id.eq.${userId},tutor_id.eq.${userId}`);
  await supabase.from('transactions').delete().eq('user_id', userId);
  await supabase.from('wallets').delete().eq('user_id', userId);

  const { error: profileDeleteError } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId);

  if (profileDeleteError) {
    throw new AppError('Failed to delete profile data', 500);
  }

  const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    console.error('[deleteProfile] auth.admin.deleteUser failed:', authDeleteError.message);
  }

  res.json({ success: true, message: 'Account deleted successfully' });
});
