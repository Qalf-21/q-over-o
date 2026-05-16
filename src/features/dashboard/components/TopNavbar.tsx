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
            if (notification.linkUrl) navigate(notification.linkUrl);
            browserNotification.close();
          };
        });
    }
    knownNotificationIds.current = nextIds;
    hasLoadedNotifications.current = true;
    setNotifications(items);
    setUnreadCount(nextUnreadCount);
  }, [navigate]);

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
      const payload = JSON.parse((event as MessageEvent).data) as {
        notifications?: AppNotification[];
        unreadCount?: number;
      };
      applyNotifications(payload.notifications || [], payload.unreadCount || 0);
    });
    source.onerror = () => {
      source.close();
    };
    return () => source.close();
  }, [applyNotifications]);

  const handleNotificationClick = async (notification: AppNotification) => {
    if (!notification.read) {
      await notificationApi.markRead(notification.id).catch(() => undefined);
      setUnreadCount(count => Math.max(0, count - 1));
      setNotifications(items =>
        items.map(item => item.id === notification.id ? { ...item, read: true } : item),
      );
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
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsNotificationsOpen(open => !open)}
              className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
              <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden z-30">
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
