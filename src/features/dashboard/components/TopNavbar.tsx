// ─────────────────────────────────────────────────────────────────────────────
// src/features/dashboard/components/TopNavbar.tsx
//
// Fix: tutors in "Learn" mode (/dashboard/learn/*) now see the token balance
//      and "+ Add" button, since they can also book and pay other tutors.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Menu, Plus, Zap } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { User } from '../../auth/types';
import { walletApi } from '../../../api/walletApi';
import { notificationApi, type AppNotification } from '../../../api/notificationApi';
import { useAutoRefresh } from '../../../shared/hooks/useAutoRefresh';

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
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User';
  const initial = user?.firstName?.[0] || 'U';

  const isTutor = user?.role === 'tutor';
  // Tutors browsing /dashboard/learn/* are acting as learners — show the wallet UI
  const isLearningMode = location.pathname.startsWith('/dashboard/learn');
  const showWallet = !isTutor || isLearningMode;

  const [balance,    setBalance]    = useState<number | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification === 'undefined' ? 'denied' : Notification.permission,
  );
  const knownNotificationIds = useRef<Set<string>>(new Set());
  const hasLoadedNotifications = useRef(false);

  const loadBalance = useCallback(async (silent = false) => {
    if (!showWallet) return;
    try {
      if (!silent) setIsFetching(true);
      const { data } = await walletApi.getWallet();
      setBalance(data.balance);
    } catch {
      // silently fail — balance stays null
    } finally {
      if (!silent) setIsFetching(false);
    }
  }, [showWallet]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  useAutoRefresh(() => loadBalance(true), { enabled: showWallet, intervalMs: 15_000 });

  const markNotificationReadLocally = useCallback((notificationId: string) => {
    setUnreadCount(count => Math.max(0, count - 1));
    setNotifications(items =>
      items.map(item => item.id === notificationId ? { ...item, read: true } : item),
    );
  }, []);

  const applyNotifications = useCallback((items: AppNotification[], nextUnreadCount: number) => {
    const nextIds = new Set(items.map(notification => notification.id));
    if (hasLoadedNotifications.current && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      items
        .filter(notification => !notification.read && !knownNotificationIds.current.has(notification.id))
        .slice(0, 3)
        .forEach(notification => {
          const browserNotification = new Notification(notification.title, {
            body: notification.message,
            tag: notification.id,
          });
          browserNotification.onclick = () => {
            window.focus();
            if (!notification.read) {
              notificationApi.markRead(notification.id).catch(() => undefined);
              markNotificationReadLocally(notification.id);
            }
            if (notification.linkUrl) navigate(notification.linkUrl);
            browserNotification.close();
          };
        });
    }
    knownNotificationIds.current = nextIds;
    hasLoadedNotifications.current = true;
    setNotifications(items);
    setUnreadCount(nextUnreadCount);
  }, [markNotificationReadLocally, navigate]);

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await notificationApi.getNotifications();
      applyNotifications(data?.notifications || [], data?.unreadCount || 0);
    } catch {
      applyNotifications([], 0);
    }
  }, [applyNotifications]);

  useEffect(() => {
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 30_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadNotifications();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadNotifications]);

  useEffect(() => {
    const streamUrl = notificationApi.getStreamUrl();
    if (!streamUrl || typeof EventSource === 'undefined') return;

    const source = new EventSource(streamUrl);
    source.addEventListener('notifications', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as {
          notifications?: AppNotification[];
          unreadCount?: number;
        };
        applyNotifications(payload.notifications || [], payload.unreadCount || 0);
      } catch {
        // Ignore malformed SSE payloads; polling remains the fallback.
      }
    });
    source.onerror = () => {
      source.close();
    };
    return () => source.close();
  }, [applyNotifications]);

  const handleNotificationClick = async (notification: AppNotification) => {
    if (!notification.read) {
      await notificationApi.markRead(notification.id).catch(() => undefined);
      markNotificationReadLocally(notification.id);
    }
    setIsNotificationsOpen(false);
    if (notification.linkUrl) {
      navigate(notification.linkUrl);
    }
  };

  const handleMarkAllRead = async () => {
    await notificationApi.markAllRead().catch(() => undefined);
    setUnreadCount(0);
    setNotifications(items => items.map(item => ({ ...item, read: true })));
  };

  const handleEnableBrowserNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: hamburger */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="app-icon-button lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          {/* Token balance + quick deposit — shown to tutees AND tutors in learn mode */}
          {showWallet && (
            <div className="hidden sm:flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-1.5 shadow-sm">
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
                  className="ml-1 inline-flex items-center gap-0.5 rounded-lg bg-indigo-600 px-2 py-1 text-xs font-bold text-white transition-colors hover:bg-indigo-700"
                  aria-label="Add tokens"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              )}
            </div>
          )}

          {/* Notifications */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsNotificationsOpen(open => !open)}
              className="app-icon-button relative"
              aria-label="Notifications"
              aria-expanded={isNotificationsOpen}
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {isNotificationsOpen && (
              <div className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/80">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <h2 className="text-sm font-bold text-gray-900">Notifications</h2>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Mark read
                    </button>
                  )}
                </div>
                {notificationPermission === 'default' && (
                  <div className="px-4 py-3 border-b border-gray-100 bg-indigo-50">
                    <button
                      type="button"
                      onClick={handleEnableBrowserNotifications}
                      className="text-sm font-semibold text-indigo-700 hover:text-indigo-800"
                    >
                      Enable browser alerts
                    </button>
                  </div>
                )}
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">No notifications</div>
                  ) : (
                    notifications.map(notification => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => handleNotificationClick(notification)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex gap-3">
                          <span className={`mt-1 h-2 w-2 rounded-full flex-none ${notification.read ? 'bg-gray-200' : 'bg-indigo-500'}`} />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-gray-900">{notification.title}</span>
                            <span className="block mt-0.5 text-sm text-gray-600 line-clamp-2">{notification.message}</span>
                            <span className="block mt-1 text-xs text-gray-400">
                              {new Date(notification.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          <button
            onClick={() => navigate('/dashboard/profile')}
            className="group hidden items-center gap-3 rounded-2xl border border-transparent py-1 pl-3 pr-1 transition-all hover:border-indigo-100 hover:bg-indigo-50/70 sm:flex"
            aria-label="Go to profile settings"
          >
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900 transition-colors group-hover:text-indigo-700">
                {displayName}
              </p>
              <p className="text-xs text-slate-500">
                {isTutor ? 'Tutor account' : 'Tutee account'}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-white shadow-md shadow-indigo-500/20 ring-2 ring-transparent transition-all group-hover:ring-indigo-300">
              {initial}
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};
