const { AppError } = require('../utils/errorHandler');
const { ADMIN_ROLES } = require('../utils/authResolver');

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
  const roles = allowedAdminRoles.length ? allowedAdminRoles : ADMIN_ROLES;
  return (req, res, next) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const adminRole = req.user.adminRole || req.user.admin_role;
    if (!adminRole || !roles.includes(adminRole)) {
      throw new AppError(
        `Admin access denied. Required admin role: ${roles.join(' or ')}`,
        403,
        'ADMIN_FORBIDDEN'
      );
    }

    next();
  };
};

const requireAdmin = requireAdminRole(...ADMIN_ROLES);
const requireSuperAdmin = requireAdminRole('super_admin');

module.exports = { requireRole, requireTutor, requireTutee, requireAdmin, requireAdminRole, requireSuperAdmin };
