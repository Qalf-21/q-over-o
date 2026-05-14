// src/api/adminApi.ts — FULL REPLACEMENT
//
// Adds getAdminFullOverview() for the new rich admin dashboard.
// All existing methods kept intact.

import { apiRequest } from './client';
import type {
  AdminFullOverview,
  AdminLog,
  AdminOverview,
  AdminTableRow,
} from '../features/admin/types/admin';

export const adminApi = {
  // ── New full overview endpoint ──────────────────────────────────────────────
  async getAdminFullOverview(): Promise<AdminFullOverview> {
    const response = await apiRequest<AdminFullOverview>('/admin/overview/full');
    if (!response.data) throw new Error('No data returned from admin overview');
    return response.data;
  },

  // ── Legacy thin overview ───────────────────────────────────────────────────
  async getOverview(): Promise<{ data: AdminOverview | null }> {
    const response = await apiRequest<AdminOverview>('/admin/overview');
    return { data: response.data ?? null };
  },

  async getUsers(): Promise<AdminTableRow[]> {
    const response = await apiRequest<AdminTableRow[]>('/admin/users');
    return response.data ?? [];
  },

  async getTutors(): Promise<AdminTableRow[]> {
    const response = await apiRequest<AdminTableRow[]>('/admin/tutors');
    return response.data ?? [];
  },

  async getSessions(): Promise<AdminTableRow[]> {
    const response = await apiRequest<AdminTableRow[]>('/admin/sessions');
    return response.data ?? [];
  },

  async getWallets(): Promise<AdminTableRow[]> {
    const response = await apiRequest<AdminTableRow[]>('/admin/wallets');
    return response.data ?? [];
  },

  async getReviews(): Promise<AdminTableRow[]> {
    const response = await apiRequest<AdminTableRow[]>('/admin/reviews');
    return response.data ?? [];
  },

  async getAuditLogs(): Promise<AdminLog[]> {
    const response = await apiRequest<AdminLog[]>('/admin/audit-logs');
    return response.data ?? [];
  },
};