import { apiRequest } from './client';
import type { Session, TuteeSession } from '../types/tutor';

export type BookSessionPayload = {
  tutor_id: string;
  subject_id: string;
  start_time: string;
  end_time: string;
};

const minutesBetween = (start?: string, end?: string) => {
  if (!start || !end) return 0;
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
};

const tokenAmount = (session: any) =>
  session.tokenAmount ?? session.token_amount ?? session.amount_tokens ?? session.cost_tokens ?? 0;

const subjectName = (session: any) =>
  session.subject || session.subjectName || session.subject_name || session.subjects?.name || 'General';

const topic = (session: any) => session.topic || session.notes || 'Tutoring session';
const profileName = (profile: any) => [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');

export const normalizeTutorSession = (session: any): Session => ({
  id: session.id,
  tuteeId: session.tuteeId || session.tutee_id || '',
  tuteeName: session.tuteeName || session.otherPartyName || session.tutee_name || profileName(session.profiles) || 'Student',
  subject: subjectName(session),
  topic: topic(session),
  scheduledAt: session.scheduledAt || session.start_time || session.startTime,
  duration: session.duration || minutesBetween(session.start_time, session.end_time),
  status: session.status,
  tokenAmount: tokenAmount(session),
  notes: session.notes,
  meetingLink: session.meetingLink || session.meetingUrl || session.meeting_url,
  createdAt: session.createdAt || session.created_at || ''
});

export const normalizeTuteeSession = (session: any): TuteeSession => ({
  id: session.id,
  tutorId: session.tutorId || session.tutor_id || '',
  tutorName: session.tutorName || session.otherPartyName || session.tutor_name || profileName(session.profiles) || 'Tutor',
  tutorAvatar: session.tutorAvatar || session.tutor_avatar,
  subject: subjectName(session),
  topic: topic(session),
  scheduledAt: session.scheduledAt || session.start_time || session.startTime,
  duration: session.duration || minutesBetween(session.start_time, session.end_time),
  status: session.status,
  tokenAmount: tokenAmount(session),
  meetingLink: session.meetingLink || session.meetingUrl || session.meeting_url,
  hasReviewed: Boolean(session.hasReviewed || session.has_reviewed),
  review: session.review
});

export const sessionApi = {
  async bookSession(payload: BookSessionPayload) {
    return apiRequest<{ session_id?: string }>('/sessions/book', {
      method: 'POST',
      body: payload
    });
  },

  async getSessions() {
    const response = await apiRequest<any[]>('/sessions', { method: 'GET' });
    return {
      success: response.success,
      data: response.data || []
    };
  },

  async getTutorSessions() {
    const response = await apiRequest<any[]>('/sessions?mode=tutor', { method: 'GET' });
    return {
      success: response.success,
      data: (response.data || []).map(normalizeTutorSession)
    };
  },

  async getTuteeSessions() {
    const response = await apiRequest<any[]>('/sessions?mode=tutee', { method: 'GET' });
    return {
      success: response.success,
      data: (response.data || []).map(normalizeTuteeSession)
    };
  },

  async completeSession(id: string) {
    return apiRequest<never>(`/sessions/${id}/complete`, { method: 'POST' });
  },

  async cancelSession(id: string) {
    return apiRequest<never>(`/sessions/${id}/cancel`, { method: 'POST' });
  },

  async undoCancellation(id: string) {
    return apiRequest<never>(`/sessions/${id}/cancel/undo`, { method: 'POST' });
  }
};
