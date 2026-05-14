import React from 'react';
import { Bell, Menu, Search, ShieldCheck } from 'lucide-react';
import type { User } from '../../auth/types';

interface AdminNavbarProps {
  user: User | null;
  onMenuClick: () => void;
}

const displayName = (user: User | null) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Admin';

export const AdminNavbar: React.FC<AdminNavbarProps> = ({ user, onMenuClick }) => (
  <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
    <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-200 transition-colors hover:bg-white/10 lg:hidden"
          aria-label="Open admin navigation"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-300 md:flex">
          <Search className="h-4 w-4 text-slate-500" />
          <span className="text-sm">Search admin records</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="relative rounded-xl border border-white/10 bg-white/5 p-2 text-slate-200 transition-colors hover:bg-white/10"
          aria-label="Admin notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-pink-500" />
        </button>
        <div className="flex items-center gap-3 border-l border-white/10 pl-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-white">{displayName(user)}</p>
            <p className="text-xs capitalize text-indigo-200">{user?.adminRole?.replace('_', ' ')}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-950/30">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>
      </div>
    </div>
  </header>
);
