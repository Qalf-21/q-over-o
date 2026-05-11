// ─────────────────────────────────────────────────────────────────────────────
// src/features/dashboard/components/DashboardLayout.tsx  (UPDATED)
//
// Changes from original:
//   • Wraps children in <ToastProvider>
//   • Passes onDeposit to TopNavbar so the global + Add CTA works
//   • Renders <DepositModal> at layout level (tutees only)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopNavbar } from './TopNavbar';
import { useAuth } from '../../../shared/hooks/useAuth';
import { ToastProvider } from '../../../shared/components/Toast';
import { DepositModal } from '../../wallet/components/DepositModal';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showDeposit,   setShowDeposit]   = useState(false);

  const isTutee = user?.role !== 'tutor';

  return (
    <ToastProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        {/* Sidebar — desktop always visible, mobile overlay */}
        <div className="hidden lg:flex lg:flex-shrink-0">
          <div className="w-64 flex flex-col border-r border-gray-200 bg-white">
            <Sidebar user={user} onClose={() => setIsSidebarOpen(false)} />
          </div>
        </div>

        {/* Mobile sidebar overlay */}
        {isSidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="fixed inset-0 bg-gray-600/75 backdrop-blur-sm"
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
            onDeposit={isTutee ? () => setShowDeposit(true) : undefined}
          />

          <main className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
              {children}
            </div>
          </main>
        </div>

        {/* Global deposit modal (tutees only) */}
        {isTutee && (
          <DepositModal
            isOpen={showDeposit}
            onClose={() => setShowDeposit(false)}
          />
        )}
      </div>
    </ToastProvider>
  );
};
