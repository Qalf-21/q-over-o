import { apiRequest } from './client';
import type { AdminLog, AdminOverview, AdminTableRow } from '../features/admin/types/admin';

const rows = (response: { data?: AdminTableRow[] }) => response.data || [];

export const adminApi = {
  async getOverview() {
    return apiRequest<AdminOverview>('/admin/overview', { method: 'GET' });
  },

  async getUsers() {
    return rows(await apiRequest<AdminTableRow[]>('/admin/users', { method: 'GET' }));
  },

  async getTutors() {
    return rows(await apiRequest<AdminTableRow[]>('/admin/tutors', { method: 'GET' }));
  },

  async getSessions() {
    return rows(await apiRequest<AdminTableRow[]>('/admin/sessions', { method: 'GET' }));
  },

  async getWallets() {
    return rows(await apiRequest<AdminTableRow[]>('/admin/wallets', { method: 'GET' }));
  },

  async getReviews() {
    return rows(await apiRequest<AdminTableRow[]>('/admin/reviews', { method: 'GET' }));
  },

  async getAuditLogs() {
    const response = await apiRequest<AdminLog[]>('/admin/audit-logs', { method: 'GET' });
    return response.data || [];
  },
};
