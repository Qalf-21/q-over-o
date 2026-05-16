import { apiRequest } from './client';
import { getAuthToken } from './client';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  linkUrl?: string | null;
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
};

export type NotificationsResponse = {
  notifications: AppNotification[];
  unreadCount: number;
};

export const notificationApi = {
  async getNotifications() {
    return apiRequest<NotificationsResponse>('/notifications', { method: 'GET' });
  },

  async markRead(id: string) {
    return apiRequest<never>(`/notifications/${id}/read`, { method: 'POST' });
  },

  async markAllRead() {
    return apiRequest<never>('/notifications/read-all', { method: 'POST' });
  },

  getStreamUrl() {
    const token = getAuthToken();
    if (!token) return null;
    return `${API_BASE_URL}/notifications/stream?token=${encodeURIComponent(token)}`;
  },
};
