// ─────────────────────────────────────────────────────────────────────────────
// src/features/dashboard/components/TopNavbar.tsx
//
// Fix: tutors in "Learn" mode (/dashboard/learn/*) now see the token balance
//      and "+ Add" button, since they can also book and pay other tutors.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { Bell, Menu, Plus, Zap } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { User } from '../../auth/types';
import { walletApi } from '../../../api/walletApi';

interface TopNavbarProps {
  user: User | null;
  onMenuClick: () => void;
  /** Optional: open deposit modal from the navbar */
  onDeposit?: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  user,
  onMenuClick,
  onDeposit,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = 0; // TODO: wire notifications context
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User';
  const initial = user?.firstName?.[0] || 'U';

  const isTutor = user?.role === 'tutor';
  // Tutors browsing /dashboard/learn/* are acting as learners — show the wallet UI
  const isLearningMode = location.pathname.startsWith('/dashboard/learn');
  const showWallet = !isTutor || isLearningMode;

  const [balance,    setBalance]    = useState<number | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (!showWallet) return; // no need to fetch if we won't display it
    let cancelled = false;
    const load = async () => {
      try {
        setIsFetching(true);
        const { data } = await walletApi.getWallet();
        if (!cancelled) setBalance(data.balance);
      } catch {
        // silently fail — balance stays null
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [showWallet]);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: hamburger */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          {/* Token balance + quick deposit — shown to tutees AND tutors in learn mode */}
          {showWallet && (
            <div className="hidden sm:flex items-center gap-2 bg-indigo-50 rounded-xl px-3 py-1.5">
              <Zap className="w-3.5 h-3.5 text-indigo-500" />
              {isFetching ? (
                <div className="w-12 h-3.5 bg-indigo-100 rounded animate-pulse" />
              ) : (
                <span className="text-sm font-bold text-indigo-700">
                  {(balance ?? 0).toLocaleString()} tkn
                </span>
              )}
              {onDeposit && (
                <button
                  type="button"
                  onClick={onDeposit}
                  className="ml-1 flex items-center gap-0.5 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-lg hover:bg-indigo-700 transition-colors"
                  aria-label="Add tokens"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              )}
            </div>
          )}

          {/* Notifications */}
          <button
            className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-gray-600" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Profile */}
          <button
            onClick={() => navigate('/dashboard/profile')}
            className="hidden sm:flex items-center gap-3 pl-4 border-l border-gray-200 hover:opacity-80 transition-opacity group"
            aria-label="Go to profile settings"
          >
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                {displayName}
              </p>
              <p className="text-xs text-gray-500">
                {isTutor ? 'Tutor account' : 'Tutee account'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-bold shadow-md ring-2 ring-transparent group-hover:ring-indigo-300 transition-all">
              {initial}
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};
