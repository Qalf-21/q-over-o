// src/api/adminApi.ts — FULL REPLACEMENT
//
// Adds getAdminFullOverview() for the new rich admin dashboard.
// All existing methods kept intact.

import { apiRequest } from './client';
import type {
  AdminFullOverview,
  AdminListParams,
  AdminListResponse,
  AdminLog,
  AdminOverview,
  AdminReportResponse,
  AdminSessionRow,
  AdminTableRow,
  AdminTutorRow,
  AdminUserRow,
  AdminWalletRow,
} from '../features/admin/types/admin';

const queryString = (params: AdminListParams = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

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

  async getReports(params?: AdminListParams): Promise<AdminReportResponse> {
    const response = await apiRequest<AdminReportResponse>(`/admin/reports${queryString(params)}`);
    return response.data ?? {
      rows: [],
      pagination: { page: params?.page ?? 1, pageSize: params?.pageSize ?? 20, total: 0 },
      summary: { rows: 0, totalValue: 0, totalTokens: 0, totalKes: 0 },
      chart: [],
    };
  },

  async getUsers(): Promise<AdminTableRow[]> {
    const response = await apiRequest<AdminTableRow[]>('/admin/users');
    const data = response.data as AdminTableRow[] | AdminListResponse<AdminUserRow> | undefined;
    return Array.isArray(data) ? data : data?.rows ?? [];
  },

  async getManagedUsers(params?: AdminListParams): Promise<AdminListResponse<AdminUserRow>> {
    const response = await apiRequest<AdminListResponse<AdminUserRow>>(`/admin/users${queryString(params)}`);
    return response.data ?? { rows: [], pagination: { page: params?.page ?? 1, pageSize: params?.pageSize ?? 20, total: 0 } };
  },

  async getTutors(): Promise<AdminTableRow[]> {
    const response = await apiRequest<AdminTableRow[]>('/admin/tutors');
    const data = response.data as AdminTableRow[] | AdminListResponse<AdminTutorRow> | undefined;
    return Array.isArray(data) ? data : data?.rows ?? [];
  },

  async getManagedTutors(params?: AdminListParams): Promise<AdminListResponse<AdminTutorRow>> {
    const response = await apiRequest<AdminListResponse<AdminTutorRow>>(`/admin/tutors${queryString(params)}`);
    return response.data ?? { rows: [], pagination: { page: params?.page ?? 1, pageSize: params?.pageSize ?? 20, total: 0 } };
  },

  suspendUser(id: string) {
    return apiRequest(`/admin/users/${id}/status`, { method: 'PATCH', body: { isSuspended: true } });
  },

  reactivateUser(id: string) {
    return apiRequest(`/admin/users/${id}/status`, { method: 'PATCH', body: { isSuspended: false } });
  },

  deleteUser(id: string) {
    return apiRequest(`/admin/users/${id}`, { method: 'DELETE' });
  },

  promoteAdmin(id: string, role = 'support_admin') {
    return apiRequest(`/admin/users/${id}/admin`, { method: 'POST', body: { role } });
  },

  revokeAdmin(id: string) {
    return apiRequest(`/admin/users/${id}/admin`, { method: 'DELETE' });
  },

  suspendTutor(id: string) {
    return apiRequest(`/admin/tutors/${id}/status`, { method: 'PATCH', body: { isSuspended: true } });
  },

  reactivateTutor(id: string) {
    return apiRequest(`/admin/tutors/${id}/status`, { method: 'PATCH', body: { isSuspended: false } });
  },

  verifyTutor(id: string, isVerified: boolean) {
    return apiRequest(`/admin/tutors/${id}/verify`, { method: 'PATCH', body: { isVerified } });
  },

  async getSessions(): Promise<AdminTableRow[]> {
    const response = await apiRequest<AdminTableRow[]>('/admin/sessions');
    const data = response.data as AdminTableRow[] | AdminListResponse<AdminSessionRow> | undefined;
    return Array.isArray(data) ? data : data?.rows ?? [];
  },

  async getManagedSessions(params?: AdminListParams): Promise<AdminListResponse<AdminSessionRow>> {
    const response = await apiRequest<AdminListResponse<AdminSessionRow>>(`/admin/sessions${queryString(params)}`);
    return response.data ?? { rows: [], pagination: { page: params?.page ?? 1, pageSize: params?.pageSize ?? 20, total: 0 }, metrics: {} };
  },

  cancelAdminSession(id: string) {
    return apiRequest(`/admin/sessions/${id}/cancel`, { method: 'POST' });
  },

  resolveSessionDispute(id: string, action: 'refund' | 'release' | 'mark_disputed') {
    return apiRequest(`/admin/sessions/${id}/resolve-dispute`, { method: 'POST', body: { action } });
  },

  async getWallets(): Promise<AdminTableRow[]> {
    const response = await apiRequest<AdminTableRow[]>('/admin/wallets');
    const data = response.data as AdminTableRow[] | AdminListResponse<AdminWalletRow> | undefined;
    return Array.isArray(data) ? data : data?.rows ?? [];
  },

  async getManagedWallets(params?: AdminListParams): Promise<AdminListResponse<AdminWalletRow>> {
    const response = await apiRequest<AdminListResponse<AdminWalletRow>>(`/admin/wallets${queryString(params)}`);
    return response.data ?? { rows: [], pagination: { page: params?.page ?? 1, pageSize: params?.pageSize ?? 20, total: 0 }, metrics: {} };
  },

  async getReviews(): Promise<AdminTableRow[]> {
    const response = await apiRequest<AdminTableRow[]>('/admin/reviews');
    return response.data ?? [];
  },

  async getSubjectRequests(): Promise<AdminTableRow[]> {
    const response = await apiRequest<AdminTableRow[]>('/admin/subject-requests');
    return response.data ?? [];
  },

  async approveSubjectRequest(id: string) {
    return apiRequest(`/admin/subject-requests/${id}/approve`, { method: 'POST' });
  },

  async rejectSubjectRequest(id: string, notes?: string) {
    return apiRequest(`/admin/subject-requests/${id}/reject`, {
      method: 'POST',
      body: { notes },
    });
  },

  async getAuditLogs(): Promise<AdminLog[]> {
    const response = await apiRequest<AdminLog[]>('/admin/audit-logs');
    return response.data ?? [];
  },
};
