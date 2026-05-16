import { apiRequest } from './client';

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
};
