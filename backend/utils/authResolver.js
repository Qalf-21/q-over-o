const supabase = require('../config/supabase');
const { AppError } = require('./errorHandler');

const ADMIN_ROLES = [
  'super_admin',
  'support_admin',
  'finance_admin',
  'moderator',
  'analytics_admin',
];

const authLog = (event, payload = {}) => {
  if (process.env.AUTH_DEBUG === 'true') {
    console.info(JSON.stringify({ event, scope: 'auth', ...payload }));
  }
};

const resolveAuthUser = async (supabaseUser) => {
  if (!supabaseUser?.id) throw new AppError('Invalid authenticated user.', 401, 'UNAUTHORIZED');

  authLog('auth.resolve.start', { userId: supabaseUser.id, email: supabaseUser.email });

  const [{ data: profile, error: profileError }, { data: admin, error: adminError }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role, is_tutor, is_suspended, deleted_at, created_at, updated_at')
      .eq('id', supabaseUser.id)
      .single(),
    supabase
      .from('admins')
      .select('user_id, role, is_active')
      .eq('user_id', supabaseUser.id)
      .eq('is_active', true)
      .maybeSingle(),
  ]);

  if (profileError || !profile) {
    authLog('auth.profile.missing', { userId: supabaseUser.id, error: profileError?.message });
    throw new AppError('Profile not found.', 404, 'PROFILE_NOT_FOUND');
  }
  if (profile.deleted_at) throw new AppError('Account not found.', 404, 'PROFILE_NOT_FOUND');
  if (profile.is_suspended) throw new AppError('Account suspended.', 403, 'ACCOUNT_SUSPENDED');
  if (adminError) throw new AppError('Failed to resolve admin permissions.', 500, 'ADMIN_LOOKUP_FAILED');

  const adminRole = admin?.role && ADMIN_ROLES.includes(admin.role) ? admin.role : null;
  const authUser = {
    id: supabaseUser.id,
    aud: supabaseUser.aud,
    email: supabaseUser.email || profile.email,
    app_metadata: supabaseUser.app_metadata,
    created_at: supabaseUser.created_at,
    updated_at: supabaseUser.updated_at,
    profile,
    role: profile.role || 'tutee',
    adminRole,
    admin_role: adminRole,
    isAdmin: Boolean(adminRole),
    is_admin: Boolean(adminRole),
    first_name: profile.first_name,
    last_name: profile.last_name,
    is_tutor: profile.role === 'tutor' || profile.is_tutor === true,
  };

  authLog('auth.resolve.done', {
    userId: authUser.id,
    role: authUser.role,
    adminRole: authUser.adminRole,
    isAdmin: authUser.isAdmin,
  });

  return authUser;
};

module.exports = { ADMIN_ROLES, authLog, resolveAuthUser };
