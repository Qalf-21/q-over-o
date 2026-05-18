// src/features/dashboard/components/Sidebar.tsx
// CHANGE: removed "Profile" nav item from tutorNavItems (redundant — accessible via avatar)

import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Wallet,
  Clock,
  BarChart3,
  LogOut,
  X,
  GraduationCap,
} from 'lucide-react';
import type { User as UserType } from '../../auth/types';
import { userApi } from '../../../api/userApi';
import { useAuth } from '../../../shared/hooks/useAuth';
import { BecomeTutorModal } from './BecomeTutorModal';
import { Logo } from '../../../shared/components/Logo';

interface SidebarProps {
  user: UserType | null;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ user, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshUser, logout } = useAuth();
  const [showBecomeTutorModal, setShowBecomeTutorModal] = useState(false);

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User';
  const initial = user?.firstName?.[0] || 'U';
  const isTutor = user?.role === 'tutor';

  const isLearningMode = location.pathname.startsWith('/dashboard/learn');

  // ── Nav item definitions ──────────────────────────────────────────────────
  // Profile removed — accessible via the avatar card at the bottom of sidebar
  const tutorNavItems = [
    { path: '/dashboard/overview',     icon: LayoutDashboard, label: 'Overview' },
    { path: '/dashboard/sessions',     icon: Calendar,        label: 'Sessions' },
    { path: '/dashboard/availability', icon: Clock,           label: 'Availability' },
    { path: '/dashboard/earnings',     icon: Wallet,          label: 'Earnings' },
    { path: '/dashboard/reports/earnings', icon: BarChart3,   label: 'Earnings Reports' },
    { path: '/dashboard/reports/performance', icon: BarChart3, label: 'Performance Reports' },
  ];

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
    {
      path:  isTutor ? '/dashboard/learn/reports/sessions' : '/dashboard/reports/sessions',
      icon:  BarChart3,
      label: 'Session Reports',
    },
    {
      path:  isTutor ? '/dashboard/learn/reports/wallet' : '/dashboard/reports/wallet',
      icon:  Wallet,
      label: 'Wallet Reports',
    },
  ];

  const navItems = isTutor && !isLearningMode ? tutorNavItems : tuteeNavItems;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleBecomeTutorConfirm = async () => {
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

  const handleProfileClick = () => {
    navigate('/dashboard/profile');
    onClose();
  };

  // ── Active detection ─────────────────────────────────────────────────────
  const isActive = (path: string): boolean => {
    if (path === '/dashboard/overview') {
      return (
        location.pathname === '/dashboard' ||
        location.pathname === '/dashboard/overview'
      );
    }
    return location.pathname.startsWith(path);
  };

  const isProfileActive = location.pathname === '/dashboard/profile';

  return (
    <>
      <div className="flex flex-col h-full">
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <Logo size="sm" />
          <button
            onClick={onClose}
            className="app-icon-button lg:hidden"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          <div className="mb-4 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Workspace
          </div>

          {/* Tutor/Learn mode switcher — only shown to tutors */}
          {isTutor && (
            <div className="grid grid-cols-2 gap-2 mb-4 px-2">
              <NavLink
                to="/dashboard/overview"
                onClick={onClose}
                className={`text-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !isLearningMode
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-200'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Tutor
              </NavLink>
              <NavLink
                to="/dashboard/learn/discover"
                onClick={onClose}
                className={`text-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isLearningMode
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-200'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
              }`}
            >
              <item.icon
                className={`w-5 h-5 ${isActive(item.path) ? 'text-indigo-600' : 'text-slate-400'}`}
              />
              {item.label}
            </NavLink>
          ))}

          {/* Become a Tutor — only shown to tutees */}
          {!isTutor && (
            <button
              type="button"
              onClick={() => setShowBecomeTutorModal(true)}
              className="mt-4 flex w-full items-center gap-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 font-medium text-white transition-all hover:from-indigo-700 hover:to-purple-700 shadow-md shadow-indigo-200"
            >
              <GraduationCap className="h-5 w-5" />
              Become a Tutor
            </button>
          )}
        </nav>

        {/* ── User section ── */}
        <div className="border-t border-slate-100 p-4">
          {/* Clickable profile card — navigates to /dashboard/profile */}
          <button
            type="button"
            onClick={handleProfileClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-3 transition-all group ${
              isProfileActive
                ? 'bg-gradient-to-r from-indigo-50 to-purple-50 shadow-sm'
                : 'bg-slate-50 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50'
            }`}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-semibold text-white shadow-sm">
              {initial}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role ?? 'tutee'}</p>
            </div>
          </button>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>

      {/* Become Tutor modal — rendered outside the scroll container */}
      <BecomeTutorModal
        isOpen={showBecomeTutorModal}
        onClose={() => setShowBecomeTutorModal(false)}
        onConfirm={handleBecomeTutorConfirm}
      />
    </>
  );
};
