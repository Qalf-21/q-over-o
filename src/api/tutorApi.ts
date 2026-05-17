// src/api/tutorApi.ts — FULL REPLACEMENT
//
// Fixes:
//   • normalizeTutor: isAvailable fallback changed from `?? true` → `?? false`
//     (previously masked real availability, showing all tutors as available)
//   • normalizeSubject: removed reference to `category` field — not in DB schema.
//     Falls back to `code` to keep the Subject type satisfied without a DB hit.

import { apiRequest } from './client';
import type { SearchFilters, Subject, TutorSearchResult } from '../types/tutor';

type RawSubject = {
  id?: string;
  name?: string;
  code?: string;
  level?: Subject['level'];
};

type RawTutor = {
  id?: string;
  user_id?: string;
  name?: string;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  avatar?: string;
  avatar_url?: string;
  bio?: string;
  subjects?: RawSubject[];
  hourlyRate?: number;
  hourly_rate_tokens?: number;
  listedHourlyRate?: number;
  listed_hourly_rate?: number;
  rating?: number;
  rating_avg?: number;
  totalReviews?: number;
  total_reviews?: number;
  totalSessions?: number;
  total_sessions?: number;
  isAvailable?: boolean;
  is_available?: boolean;
  nextAvailable?: string;
  next_available?: string;
  qualification?: TutorSearchResult['qualification'];
};

type AvailabilitySlot = Record<string, unknown>;

const normalizeSubject = (subject: RawSubject): Subject => ({
  id:       subject.id || '',
  name:     subject.name || 'General',
  // `category` does not exist in the subjects table — use code as fallback
  category: subject.code || 'General',
  level:    subject.level || 'intermediate'
});

const personName = (value: RawTutor) =>
  value.name || [value.firstName || value.first_name, value.lastName || value.last_name].filter(Boolean).join(' ');

export const normalizeTutor = (tutor: RawTutor): TutorSearchResult => ({
  id:            tutor.id || tutor.user_id || '',
  name:          personName(tutor) || 'Unnamed tutor',
  avatar:        tutor.avatar || tutor.avatar_url,
  bio:           tutor.bio || '',
  subjects:      (tutor.subjects || []).map(normalizeSubject),
  hourlyRate:    tutor.hourlyRate ?? tutor.hourly_rate_tokens ?? 0,
  listedHourlyRate: tutor.listedHourlyRate ?? tutor.listed_hourly_rate ?? tutor.hourly_rate_tokens,
  rating:        tutor.rating ?? tutor.rating_avg ?? 0,
  totalReviews:  tutor.totalReviews ?? tutor.total_reviews ?? 0,
  totalSessions: tutor.totalSessions ?? tutor.total_sessions ?? 0,
  isAvailable:   tutor.isAvailable ?? tutor.is_available ?? false,
  nextAvailable: tutor.nextAvailable ?? tutor.next_available,
  qualification: tutor.qualification
});

export const tutorApi = {
  async getTutors(filters: SearchFilters = { query: '' }) {
    const params = new URLSearchParams();
    if (filters.query)        params.set('q',            filters.query);
    if (filters.subject)      params.set('subject',      filters.subject);
    if (filters.minRating)    params.set('minRating',    String(filters.minRating));
    if (filters.maxPrice)     params.set('maxPrice',     String(filters.maxPrice));
    if (filters.availableNow) params.set('availableNow', 'true');
    const path = params.toString() ? `/tutors?${params}` : '/tutors';
    const response = await apiRequest<RawTutor[]>(path, { method: 'GET' });
    return {
      success: response.success,
      data: (response.data || []).map(normalizeTutor)
    };
  },

  async getTutor(id: string) {
    const response = await apiRequest<RawTutor>(`/tutors/${id}`, { method: 'GET' });
    return {
      success: response.success,
      data: normalizeTutor(response.data || {})
    };
  },

  async getMyProfile() {
    return apiRequest('/tutors/profile/me', { method: 'GET' });
  },

  async getMyQualification() {
    return apiRequest('/tutors/qualification/me', { method: 'GET' });
  },

  async updateProfile(profile: { bio?: string; hourlyRate?: number; subjects?: string[]; requestedSubjects?: string[] }) {
    return apiRequest('/tutors/profile', {
      method: 'PUT',
      body: profile
    });
  },

  async getSubjects() {
    return apiRequest<RawSubject[]>('/tutors/subjects', { method: 'GET' });
  },

  async getMyAvailability() {
    return apiRequest<AvailabilitySlot[]>('/tutors/availability', { method: 'GET' });
  },

  async createAvailability(slot: { dayOfWeek: number; startTime: string; endTime: string }) {
    return apiRequest('/tutors/availability', {
      method: 'POST',
      body: slot
    });
  },

  async getAvailability(tutorId: string) {
    return apiRequest(`/tutors/${tutorId}/availability`, { method: 'GET' });
  },

  async deleteAvailability(slotId: string) {
    return apiRequest(`/tutors/availability/${slotId}`, { method: 'DELETE' });
  },

  async toggleAvailability(isAvailable: boolean) {
    return apiRequest('/tutors/availability/toggle', {
      method: 'PATCH',
      body: { isAvailable }
    });
  },

  async revertApplication() {
    return apiRequest('/tutors/application', { method: 'DELETE' });
  }
};
