import { reviewApi } from '../../api/reviewApi';
import { sessionApi } from '../../api/sessionApi';
import { tutorApi } from '../../api/tutorApi';
import { walletApi } from '../../api/walletApi';
import type {
  BookingRequest,
  ReviewSubmission,
  SearchFilters,
  TuteeSession,
  TutorSearchResult
} from './tutor';

const addMinutes = (isoDateTime: string, minutes: number) =>
  new Date(new Date(isoDateTime).getTime() + minutes * 60000).toISOString();

class TuteeService {
  searchTutors(filters: SearchFilters): Promise<{ success: boolean; data: TutorSearchResult[] }> {
    return tutorApi.getTutors(filters);
  }

  getTutorProfile(tutorId: string): Promise<{ success: boolean; data: TutorSearchResult }> {
    return tutorApi.getTutor(tutorId);
  }

  async createBooking(booking: BookingRequest) {
    return sessionApi.bookSession({
      tutor_id: booking.tutorId,
      subject_id: booking.subjectId || booking.subject,
      start_time: new Date(booking.scheduledAt).toISOString(),
      end_time: addMinutes(booking.scheduledAt, booking.duration)
    });
  }

  async getTokenBalance(): Promise<{ success: boolean; data: { balance: number } }> {
    const response = await walletApi.getWallet();
    return { success: response.success, data: { balance: response.data.balance } };
  }

  purchaseTokens(amountKes: number, phoneNumber: string) {
    return walletApi.purchaseTokens(amountKes, phoneNumber);
  }

  getMySessions(): Promise<{ success: boolean; data: TuteeSession[] }> {
    return sessionApi.getTuteeSessions();
  }

  async getUpcomingSessions(): Promise<{ success: boolean; data: TuteeSession[] }> {
    const response = await sessionApi.getTuteeSessions();
    return {
      success: response.success,
      data: response.data.filter(session => ['pending', 'confirmed', 'in-progress'].includes(session.status))
    };
  }

  async getCompletedSessions(): Promise<{ success: boolean; data: TuteeSession[] }> {
    const response = await sessionApi.getTuteeSessions();
    return {
      success: response.success,
      data: response.data.filter(session => session.status === 'completed')
    };
  }

  cancelSession(sessionId: string) {
    return sessionApi.cancelSession(sessionId);
  }

  submitReview(review: ReviewSubmission) {
    return reviewApi.createReview(review);
  }

  getTutorReviews(tutorId: string) {
    return reviewApi.getTutorReviews(tutorId);
  }
}

export const tuteeService = new TuteeService();
