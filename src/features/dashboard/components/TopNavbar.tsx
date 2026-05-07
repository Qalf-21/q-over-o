// src/features/dashboard/components/TopNavbar.tsx
// MODIFIED: avatar + display name in top-right now navigate to /profile

import React from 'react';
import { Bell, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../../auth/types';

interface TopNavbarProps {
  user: User | null;
  onMenuClick: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ user, onMenuClick }) => {
  const navigate = useNavigate();
  const unreadCount = 3; // TODO: Get from notifications context
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User';
  const initial = user?.firstName?.[0] || 'U';

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6 text-gray-600" />
          </button>

          
        </div>

        <div className="flex items-center gap-4">
          <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell className="w-5 h-5 text-gray-600" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Clickable profile section — navigates to /profile */}
          <button
            onClick={() => navigate('/profile')}
            className="hidden sm:flex items-center gap-3 pl-4 border-l border-gray-200 hover:opacity-80 transition-opacity group"
            aria-label="Go to profile"
          >
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                {displayName}
              </p>
              <p className="text-xs text-gray-500">
                {user?.role === 'tutor' ? 'Tutor account' : 'Tutee account'}
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
