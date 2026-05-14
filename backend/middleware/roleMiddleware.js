const { AppError } = require('../utils/errorHandler');

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const userRole = req.user.role || req.user.profile?.role || 'tutee';
    const hasRole = allowedRoles.includes(userRole) || (allowedRoles.includes('tutee') && userRole === 'tutor');

    if (!hasRole) {
      throw new AppError(
        `Access denied. Required role: ${allowedRoles.join(' or ')}`, 
        403, 
        'FORBIDDEN'
      );
    }

    next();
  };
};

const requireTutor = requireRole('tutor');
const requireTutee = requireRole('tutee');
const requireAdminRole = (...allowedAdminRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const adminRole = req.user.adminRole || req.user.admin_role;
    if (!adminRole || !allowedAdminRoles.includes(adminRole)) {
      throw new AppError(
        `Admin access denied. Required admin role: ${allowedAdminRoles.join(' or ')}`,
        403,
        'ADMIN_FORBIDDEN'
      );
    }

    next();
  };
};

const requireSuperAdmin = requireAdminRole('super_admin');

module.exports = { requireRole, requireTutor, requireTutee, requireAdminRole, requireSuperAdmin };
