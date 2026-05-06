import { apiRequest } from './client';
import type { SearchFilters, Subject, TutorSearchResult } from '../types/tutor';

const normalizeSubject = (subject: any): Subject => ({
  id: subject.id,
  name: subject.name,
  category: subject.category || subject.code || 'General',
  level: subject.level || 'intermediate'
});
const personName = (value: any) =>
  value.name || [value.firstName || value.first_name, value.lastName || value.last_name].filter(Boolean).join(' ');

export const normalizeTutor = (tutor: any): TutorSearchResult => ({
  id: tutor.id || tutor.user_id,
  name: personName(tutor) || 'Unnamed tutor',
  avatar: tutor.avatar || tutor.avatar_url,
  bio: tutor.bio || '',
  subjects: (tutor.subjects || []).map(normalizeSubject),
  hourlyRate: tutor.hourlyRate ?? tutor.hourly_rate_tokens ?? 0,
  rating: tutor.rating ?? tutor.rating_avg ?? 0,
  totalReviews: tutor.totalReviews ?? tutor.total_reviews ?? 0,
  totalSessions: tutor.totalSessions ?? tutor.total_sessions ?? 0,
  isAvailable: tutor.isAvailable ?? tutor.is_available ?? true,
  nextAvailable: tutor.nextAvailable ?? tutor.next_available
});

export const tutorApi = {
  async getTutors(filters: SearchFilters = { query: '' }) {
    const params = new URLSearchParams();
    if (filters.query) params.set('q', filters.query);
    if (filters.subject) params.set('subject', filters.subject);
    if (filters.minRating) params.set('minRating', String(filters.minRating));
    if (filters.maxPrice) params.set('maxPrice', String(filters.maxPrice));
    if (filters.availableNow) params.set('availableNow', 'true');

    const path = params.toString() ? `/tutors?${params}` : '/tutors';
    const response = await apiRequest<any[]>(path, { method: 'GET' });
    return {
      success: response.success,
      data: (response.data || []).map(normalizeTutor)
    };
  },

  async getTutor(id: string) {
    const response = await apiRequest<any>(`/tutors/${id}`, { method: 'GET' });
    return {
      success: response.success,
      data: normalizeTutor(response.data || {})
    };
  },

  async getMyProfile() {
    return apiRequest('/tutors/profile/me', { method: 'GET' });
  },

  async updateProfile(profile: { bio?: string; hourlyRate?: number; subjects?: string[] }) {
    return apiRequest('/tutors/profile', {
      method: 'PUT',
      body: profile
    });
  },

  async createAvailability(startTime: string, endTime: string) {
    return apiRequest('/tutors/availability', {
      method: 'POST',
      body: { startTime, endTime }
    });
  },

  async getAvailability(tutorId: string) {
    return apiRequest(`/tutors/${tutorId}/availability`, { method: 'GET' });
  },

  async deleteAvailability(slotId: string) {
    return apiRequest(`/tutors/availability/${slotId}`, { method: 'DELETE' });
  },

  async revertApplication() {
    return apiRequest('/tutors/application', { method: 'DELETE' });
  }
};
