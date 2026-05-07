// src/api/profileApi.ts

import { apiRequest } from './client';
import type { ApiResponse } from './client';

export interface ProfileData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'tutee' | 'tutor';
  isTutor: boolean;
  createdAt: string;
  updatedAt: string;
  stats: {
    totalSessionsBooked: number;
    completedSessions: number;
  };
  tutorProfile?: {
    bio: string;
    hourly_rate_tokens: number;
    rating_avg: number;
    total_reviews: number;
    total_sessions: number;
    is_available: boolean;
  } | null;
}

export interface UpdateProfilePayload {
  first_name?: string;
  last_name?: string;
}

export const profileApi = {
  async getMe(): Promise<ApiResponse<ProfileData>> {
    return apiRequest<ProfileData>('/profile/me', { method: 'GET' });
  },

  async updateProfile(
    payload: UpdateProfilePayload
  ): Promise<ApiResponse<ProfileData>> {
    return apiRequest<ProfileData>('/profile/update', {
      method: 'PUT',
      body: payload,
    });
  },

  async deleteAccount(): Promise<ApiResponse<never>> {
    return apiRequest<never>('/profile/delete', { method: 'DELETE' });
  },
};