// ─────────────────────────────────────────────────────────────────────────────
// src/features/dashboard/components/DashboardLayout.tsx
//
// Fix: tutors browsing /dashboard/learn/* also get the deposit modal wired up,
//      since they can book and pay other tutors just like tutees can.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopNavbar } from './TopNavbar';
import { useAuth } from '../../../shared/hooks/useAuth';
import { DepositModal } from '../../wallet/components/DepositModal';

interface DashboardLayoutProps {
  children: React.ReactNode;
  user?: unknown;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showDeposit,   setShowDeposit]   = useState(false);

  const isTutor = user?.role === 'tutor';
  const isLearningMode = location.pathname.startsWith('/dashboard/learn');

  // Show the deposit flow for tutees always, and for tutors when they're in learn mode
  const canDeposit = !isTutor || isLearningMode;

  return (
    <div className="app-surface flex h-screen overflow-hidden">
        {/* Sidebar — desktop always visible, mobile overlay */}
        <div className="hidden lg:flex lg:flex-shrink-0">
          <div className="w-64 flex flex-col border-r border-slate-200/80 bg-white/95 shadow-sm">
            <Sidebar user={user} onClose={() => setIsSidebarOpen(false)} />
          </div>
        </div>

        {/* Mobile sidebar overlay */}
        {isSidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="fixed inset-0 bg-slate-950/55 backdrop-blur-sm"
              onClick={() => setIsSidebarOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 w-64 bg-white z-50 shadow-2xl">
              <Sidebar user={user} onClose={() => setIsSidebarOpen(false)} />
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <TopNavbar
            user={user}
            onMenuClick={() => setIsSidebarOpen(true)}
            onDeposit={canDeposit ? () => setShowDeposit(true) : undefined}
          />

          <main className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
              {children}
            </div>
          </main>
        </div>

        {/* Global deposit modal — available to tutees and tutors in learn mode */}
        {canDeposit && (
          <DepositModal
            isOpen={showDeposit}
            onClose={() => setShowDeposit(false)}
          />
        )}
    </div>
  );
};
