type LogoNavigationInput = {
  pathname: string;
  role?: string | null;
  isAdmin?: boolean;
};

const publicPrefixes = ['/login', '/register', '/forgot-password'];

export const resolveLogoDestination = ({ pathname, role, isAdmin }: LogoNavigationInput) => {
  if (pathname === '/' || publicPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return '/';
  }

  if (pathname.startsWith('/dashboard/admin') || isAdmin) {
    return '/dashboard/admin';
  }

  if (pathname.startsWith('/dashboard') || pathname.startsWith('/tutee') || pathname.startsWith('/tutor')) {
    return role === 'tutor' ? '/tutor/overview' : '/tutee/discover';
  }

  return '/';
};
