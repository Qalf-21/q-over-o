const supabase = require('../config/supabase');
const { AppError } = require('../utils/errorHandler');
const { authLog, resolveAuthUser } = require('../utils/authResolver');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Access denied. No token provided.', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    authLog('auth.middleware.token_received');

    // Validate with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      authLog('auth.middleware.invalid_token', { error: error?.message });
      throw new AppError('Invalid or expired token.', 401, 'UNAUTHORIZED');
    }

    req.user = await resolveAuthUser(user);

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { authMiddleware };
