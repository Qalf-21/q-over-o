import { apiRequest } from './client';

export const userApi = {
  async becomeTutor(payload: {
    confirm: boolean;
    bio?: string;
    hourlyRate?: number;
    subjects?: string[];
  }) {
    return apiRequest('/users/become-tutor', {
      method: 'POST',
      body: payload
    });
  }
};
