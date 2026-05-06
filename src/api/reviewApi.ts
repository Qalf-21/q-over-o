import { apiRequest } from './client';
import type { ReviewSubmission } from '../types/tutor';

export const reviewApi = {
  async getTutorReviews(tutorId: string) {
    const response = await apiRequest<any[]>(`/reviews/tutor/${tutorId}`, { method: 'GET' });
    return {
      success: response.success,
      data: response.data || []
    };
  },

  async createReview(review: ReviewSubmission) {
    return apiRequest('/reviews', {
      method: 'POST',
      body: review
    });
  },

  async updateReview(id: string, review: Partial<Pick<ReviewSubmission, 'rating' | 'comment'>>) {
    return apiRequest(`/reviews/${id}`, {
      method: 'PUT',
      body: review
    });
  },

  async deleteReview(id: string) {
    return apiRequest(`/reviews/${id}`, {
      method: 'DELETE'
    });
  }
};
