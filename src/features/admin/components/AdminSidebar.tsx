import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  Bell,
  ClipboardList,
  FileWarning,
  BarChart3,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Shield,
  Tags,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useLogoNavigation } from '../../../shared/hooks/useLogoNavigation';

interface AdminSidebarProps {
  onClose: () => void;
}

const navItems = [
  { path: '/dashboard/admin', icon: LayoutDashboard, label: 'Overview', end: true },
  { path: '/dashboard/admin/users', icon: Users, label: 'Users' },
  { path: '/dashboard/admin/tutors', icon: Shield, label: 'Tutors' },
  { path: '/dashboard/admin/sessions', icon: Activity, label: 'Sessions' },
  { path: '/dashboard/admin/wallets', icon: Wallet, label: 'Wallets' },
  { path: '/dashboard/admin/reviews', icon: MessageSquare, label: 'Reviews' },
  { path: '/dashboard/admin/subject-requests', icon: Tags, label: 'Subject Requests' },
  { path: '/dashboard/admin/reports/analytics', icon: BarChart3, label: 'Analytics Dashboard' },
  { path: '/dashboard/admin/reports/financial', icon: Wallet, label: 'Financial Reports' },
  { path: '/dashboard/admin/reports/sessions', icon: Activity, label: 'Session Reports' },
  { path: '/dashboard/admin/reports/users', icon: Users, label: 'User Reports' },
  { path: '/dashboard/admin/reports/exceptions', icon: FileWarning, label: 'Exception Reports' },
  { path: '/dashboard/admin/reports/qualifications', icon: Shield, label: 'Qualification Reports' },
  { path: '/dashboard/admin/notifications', icon: Bell, label: 'Notifications' },
  { path: '/dashboard/admin/settings', icon: Settings, label: 'Settings' },
  { path: '/dashboard/admin/audit-logs', icon: ClipboardList, label: 'Audit Logs' },
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ onClose }) => {
  const logoDestination = useLogoNavigation();

  return (
  <aside className="flex h-full flex-col border-r border-white/10 bg-slate-950/95 text-white backdrop-blur-xl">
    <div className="flex items-center justify-between border-b border-white/10 p-6">
      <NavLink to={logoDestination} className="flex items-center gap-3" onClick={onClose} aria-label="Q-over-o admin home">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-900/40">
          <Shield className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="text-lg font-bold">Q-over-o</p>
          <p className="text-xs font-medium text-indigo-200">Admin Console</p>
        </div>
      </NavLink>
      <button
        onClick={onClose}
        className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-white/10 lg:hidden"
        aria-label="Close admin navigation"
      >
        <X className="h-5 w-5" />
      </button>
    </div>

    <nav className="flex-1 space-y-1 overflow-y-auto p-4">
      <p className="px-4 pb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Operations
      </p>
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.end}
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
              isActive
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-950/40'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`
          }
        >
          <item.icon className="h-5 w-5" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  </aside>
  );
};
