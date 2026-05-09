// backend/controllers/authController.js — FULL REPLACEMENT
//
// Change from previous version:
//   • register() now upserts a wallets row (balance_tokens = 0) for the new user
//     immediately after the profile row is created. This prevents the
//     "Wallet not found" 404 that new tutees hit on the Discover page.

const supabase = require('../config/supabase');
const { AppError, asyncHandler } = require('../utils/errorHandler');

// ─── Register ─────────────────────────────────────────────────────────────────

exports.register = asyncHandler(async (req, res) => {
  const { first_name, last_name, email, password } = req.body;

  const firstName       = typeof first_name === 'string' ? first_name.trim() : '';
  const lastName        = typeof last_name  === 'string' ? last_name.trim()  : '';
  const normalizedEmail = typeof email      === 'string' ? email.trim().toLowerCase() : '';

  if (!firstName || !lastName || !normalizedEmail || !password) {
    throw new AppError('first_name, last_name, email, and password are required', 400, 'VALIDATION_ERROR');
  }
  if (firstName.length < 2 || lastName.length < 2) {
    throw new AppError('First name and last name must each be at least 2 characters', 400, 'VALIDATION_ERROR');
  }

  // ── 1. Create Supabase auth user ────────────────────────────────────────────
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName, role: 'tutee' },
    },
  });

  if (authError)          throw new AppError(authError.message, 400, authError.code);
  if (!authData.user?.id) throw new AppError('Signup failed before user creation', 500);

  const userId = authData.user.id;

  // ── 2. Upsert profile row ───────────────────────────────────────────────────
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id:         userId,
      first_name: firstName,
      last_name:  lastName,
      email:      normalizedEmail,
      role:       'tutee',
      is_tutor:   false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select('id, email, first_name, last_name, role, is_tutor, created_at, updated_at')
    .single();

  if (profileError) {
    await supabase.auth.admin.deleteUser(userId);
    throw new AppError('Failed to create profile', 500);
  }

  // ── 3. Upsert wallet row (0 balance) ────────────────────────────────────────
  // Use upsert so re-registrations or trigger-created wallets don't cause a
  // duplicate-key error. A missing wallet breaks the Discover page entirely.
  const { error: walletError } = await supabase
    .from('wallets')
    .upsert(
      { user_id: userId, balance_tokens: 0 },
      { onConflict: 'user_id' }
    );

  if (walletError) {
    // Log but don't block — the auth + profile already exist; wallet can be
    // created lazily by the getWallet endpoint if this fails.
    console.error('[register] wallet upsert failed:', walletError.message);
  }

  res.status(201).json({
    success: true,
    message: 'Registration successful. Please check your email to verify your account.',
    data: {
      user: {
        id:    userId,
        email: authData.user.email,
        ...profile,
      },
      token:         authData.session?.access_token  ?? '',
      refresh_token: authData.session?.refresh_token ?? '',
    },
  });
});

// ─── Login ────────────────────────────────────────────────────────────────────

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError('Email and password are required', 400, 'VALIDATION_ERROR');
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) throw new AppError(error.message, 401, 'INVALID_CREDENTIALS');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role, is_tutor, created_at, updated_at')
    .eq('id', data.user.id)
    .single();

  // ── Ensure wallet exists for users who registered before this fix ────────────
  await supabase
    .from('wallets')
    .upsert(
      { user_id: data.user.id, balance_tokens: 0 },
      { onConflict: 'user_id' }
    );

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id:           data.user.id,
        aud:          data.user.aud,
        email:        data.user.email,
        app_metadata: data.user.app_metadata,
        created_at:   data.user.created_at,
        updated_at:   data.user.updated_at,
        profile,
        role:         profile?.role ?? 'tutee',
        first_name:   profile?.first_name,
        last_name:    profile?.last_name,
      },
      token:         data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  });
});

// ─── Get current user ─────────────────────────────────────────────────────────

exports.getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
});

// ─── Token refresh ────────────────────────────────────────────────────────────

exports.refreshSession = asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token || typeof refresh_token !== 'string') {
    throw new AppError('refresh_token is required', 400, 'VALIDATION_ERROR');
  }

  const { data, error } = await supabase.auth.refreshSession({ refresh_token });

  if (error || !data?.session) {
    throw new AppError('Session refresh failed. Please log in again.', 401, 'REFRESH_FAILED');
  }

  res.json({
    success: true,
    message: 'Session refreshed',
    data: {
      access_token:  data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  });
});

// ─── Password reset ───────────────────────────────────────────────────────────

exports.resetPassword = asyncHandler(async (req, res) => {
  const { email, redirectTo } = req.body;

  if (!email) throw new AppError('Email is required', 400, 'VALIDATION_ERROR');

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) throw new AppError(error.message, 400, error.code);

  res.json({
    success: true,
    message: 'Password reset instructions sent if the account exists',
  });
});

// ─── Update password ──────────────────────────────────────────────────────────

exports.updatePassword = asyncHandler(async (req, res) => {
  const { password } = req.body;

  if (!password || password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400, 'VALIDATION_ERROR');
  }

  const { error } = await supabase.auth.admin.updateUserById(req.user.id, { password });

  if (error) throw new AppError(error.message, 400, error.code);

  res.json({ success: true, message: 'Password updated successfully' });
});