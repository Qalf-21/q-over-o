import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  User,
  Calendar,
  Wallet,
  Clock,
  LogOut,
  X,
  GraduationCap,
} from 'lucide-react';
import type { User as UserType } from '../../auth/types';
import { userApi } from '../../../api/userApi';
import { useAuth } from '../../../shared/hooks/useAuth';

interface SidebarProps {
  user: UserType | null;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ user, onClose }) => {
  const location = useLocation();
  const navigate  = useNavigate();
  const { refreshUser, logout } = useAuth();

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User';
  const initial     = user?.firstName?.[0] || 'U';
  const isTutor     = user?.role === 'tutor';

  // A tutor is in "learn mode" when on any /dashboard/learn/* route.
  const isLearningMode = location.pathname.startsWith('/dashboard/learn');

  // ── Nav item definitions ─────────────────────────────────────────────────
  // Tutor dashboard nav — tutor-only pages
  const tutorNavItems = [
    { path: '/dashboard/overview',      icon: LayoutDashboard, label: 'Overview' },
    { path: '/dashboard/sessions',      icon: Calendar,        label: 'Sessions' },
    { path: '/dashboard/availability',  icon: Clock,           label: 'Availability' },
    { path: '/dashboard/earnings',      icon: Wallet,          label: 'Earnings' },
    { path: '/dashboard/profile',       icon: User,            label: 'Profile' },
  ];

  // Learner nav — shared by tutors (via /learn/*) and tutees (via direct paths)
  const tuteeNavItems = [
    {
      path:  isTutor ? '/dashboard/learn/discover' : '/dashboard/discover',
      icon:  LayoutDashboard,
      label: 'Discover',
    },
    {
      path:  isTutor ? '/dashboard/learn/sessions' : '/dashboard/my-sessions',
      icon:  Calendar,
      label: 'My Sessions',
    },
    {
      path:  isTutor ? '/dashboard/learn/history' : '/dashboard/history',
      icon:  Clock,
      label: 'History',
    },
  ];

  // Show tutor nav unless we're in learning mode
  const navItems = isTutor && !isLearningMode ? tutorNavItems : tuteeNavItems;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleBecomeTutor = async () => {
    const confirmed = window.confirm(
      'Create your tutor profile and switch to the tutor dashboard?',
    );
    if (!confirmed) return;

    await userApi.becomeTutor({ confirm: true });
    await refreshUser();
    navigate('/dashboard/overview', { replace: true });
    onClose();
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
    onClose();
  };

  // ── Active detection ──────────────────────────────────────────────────────
  // /dashboard/overview is the tutor index — treat /dashboard exactly as active too.
  const isActive = (path: string): boolean => {
    if (path === '/dashboard/overview') {
      return (
        location.pathname === '/dashboard' ||
        location.pathname === '/dashboard/overview'
      );
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
        <NavLink to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Q-over-o
          </span>
        </NavLink>
        <button
          onClick={onClose}
          className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-4">
          Menu
        </div>

        {/* Tutor/Learn mode switcher — only shown to tutors */}
        {isTutor && (
          <div className="grid grid-cols-2 gap-2 mb-4 px-2">
            <NavLink
              to="/dashboard/overview"
              onClick={onClose}
              className={`text-center px-3 py-2 rounded-lg text-sm font-medium ${
                !isLearningMode
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tutor
            </NavLink>
            <NavLink
              to="/dashboard/learn/discover"
              onClick={onClose}
              className={`text-center px-3 py-2 rounded-lg text-sm font-medium ${
                isLearningMode
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Learn
            </NavLink>
          </div>
        )}

        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
              isActive(item.path)
                ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 shadow-sm'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <item.icon
              className={`w-5 h-5 ${isActive(item.path) ? 'text-indigo-600' : 'text-gray-400'}`}
            />
            {item.label}
          </NavLink>
        ))}

        {/* Become a Tutor — only shown to tutees */}
        {!isTutor && (
          <button
            type="button"
            onClick={handleBecomeTutor}
            className="mt-4 flex w-full items-center gap-3 rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white transition-colors hover:bg-indigo-700"
          >
            <GraduationCap className="h-5 w-5" />
            Become a Tutor
          </button>
        )}
      </nav>

      {/* ── User section ─────────────────────────────────────────────────── */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 mb-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-bold">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-600 hover:bg-red-50 font-medium transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Log Out
        </button>
      </div>
    </div>
  );
};
