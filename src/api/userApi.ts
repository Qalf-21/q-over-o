// src/api/userApi.ts
import { apiRequest } from './client';

export const userApi = {
  /**
   * POST /api/users/become-tutor
   * Calls the existing backend endpoint which runs become_tutor_atomic RPC.
   * confirm: true is REQUIRED by the backend.
   */
  async becomeTutor(payload: {
    confirm: boolean;
    bio?: string;
    hourlyRate?: number;
    subjects?: string[];
  }) {
    return apiRequest('/users/become-tutor', {
      method: 'POST',
      body: payload,
    });
  },
};