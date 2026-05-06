const supabase = require('../config/supabase');
const { AppError } = require('../utils/errorHandler');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Access denied. No token provided.', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];

    // Validate with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw new AppError('Invalid or expired token.', 401, 'UNAUTHORIZED');
    }

    // Get profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role, is_tutor, created_at, updated_at')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new AppError('Profile not found.', 404, 'PROFILE_NOT_FOUND');
    }

    const authUser = {
      id: user.id,
      aud: user.aud,
      email: user.email,
      app_metadata: user.app_metadata,
      created_at: user.created_at,
      updated_at: user.updated_at,
      profile,
      role: profile.role || 'tutee',
      first_name: profile.first_name,
      last_name: profile.last_name,
      is_tutor: profile.role === 'tutor' || profile.is_tutor === true
    };

    req.user = {
      ...authUser,
      id: user.id,
      email: user.email
    };

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { authMiddleware };
