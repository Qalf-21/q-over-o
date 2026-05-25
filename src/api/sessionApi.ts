
// src/api/sessionApi.ts — FULL REPLACEMENT
//
// Changes:
//  • BookSessionPayload now includes optional notes and availability_slot_id
//    so the backend can trim/split the slot after booking

import { apiRequest } from './client';
import type { Session, TuteeSession } from '../types/tutor';
import { parseUtcDate } from '../utils/dateTime';

type RawSession = Record<string, unknown>;

export type BookSessionPayload = {
  tutor_id: string;
  subject_id?: string;  // optional — backend falls back to tutor's first subject
  start_time: string;
  end_time: string;
  topic?: string;
  notes?: string;
  availability_slot_id?: string;
};

export type SessionJoinInfo = {
  appId: string;
  domain: string;
  room: string;
  roomName: string;
  jwt: string;
  moderator: boolean;
};

const minutesBetween = (start?: string, end?: string) => {
  if (!start || !end) return 0;
  return Math.max(0, Math.round((parseUtcDate(end).getTime() - parseUtcDate(start).getTime()) / 60000));
};

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const asRecord = (value: unknown): RawSession | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as RawSession : undefined;

const firstString = (...values: unknown[]): string | undefined =>
  values.map(asString).find(Boolean);

const durationMinutes = (session: RawSession) => {
  const fromTimes = minutesBetween(
    firstString(session.start_time, session.startTime, session.scheduledAt),
    firstString(session.end_time, session.endTime, session.endsAt),
  );
  if (fromTimes > 0) return fromTimes;
  const rawDuration = Number(session.duration || 0);
  return rawDuration > 0 && rawDuration <= 12 ? rawDuration * 60 : rawDuration;
};

const tokenAmount = (session: RawSession) =>
  asNumber(session.tokenAmount)
    ?? asNumber(session.token_amount)
    ?? asNumber(session.amount_tokens)
    ?? asNumber(session.cost_tokens)
    ?? asNumber(session.escrow_amount_tokens)
    ?? 0;

const subjectName = (session: RawSession) => {
  const subjects = asRecord(session.subjects);
  return firstString(session.subject, session.subjectName, session.subject_name, subjects?.name) || 'General';
};

const topic = (session: RawSession) => firstString(session.topic, session.notes) || 'Tutoring session';
const profileName = (profile: unknown) => {
  const record = asRecord(profile);
  return [record?.first_name, record?.last_name].map(asString).filter(Boolean).join(' ');
};

export const normalizeTutorSession = (session: RawSession): Session => ({
  id: firstString(session.id) || '',
  tuteeId: firstString(session.tuteeId, session.tutee_id) || '',
  tuteeName: firstString(session.tuteeName, session.otherPartyName, session.tutee_name) || profileName(session.profiles) || 'Student',
  subject: subjectName(session),
  topic: topic(session),
  scheduledAt: firstString(session.scheduledAt, session.start_time, session.startTime) || '',
  scheduledEnd: firstString(session.scheduledEnd, session.end_time, session.endTime),
  duration: durationMinutes(session),
  status: (firstString(session.status) || 'pending') as Session['status'],
  tokenAmount: tokenAmount(session),
  notes: firstString(session.notes),
  meetingLink: firstString(session.meetingLink, session.meetingUrl, session.meeting_url),
  createdAt: firstString(session.createdAt, session.created_at) || ''
});

export const normalizeTuteeSession = (session: RawSession): TuteeSession => ({
  id: firstString(session.id) || '',
  tutorId: firstString(session.tutorId, session.tutor_id) || '',
  tutorName: firstString(session.tutorName, session.otherPartyName, session.tutor_name) || profileName(session.profiles) || 'Tutor',
  tutorAvatar: firstString(session.tutorAvatar, session.tutor_avatar),
  subject: subjectName(session),
  topic: topic(session),
  scheduledAt: firstString(session.scheduledAt, session.start_time, session.startTime) || '',
  scheduledEnd: firstString(session.scheduledEnd, session.end_time, session.endTime),
  duration: durationMinutes(session),
  status: (firstString(session.status) || 'pending') as TuteeSession['status'],
  tokenAmount: tokenAmount(session),
  meetingLink: firstString(session.meetingLink, session.meetingUrl, session.meeting_url),
  hasReviewed: Boolean(session.hasReviewed || session.has_reviewed),
  review: asRecord(session.review) as TuteeSession['review']
});

export const sessionApi = {
  async bookSession(payload: BookSessionPayload) {
    return apiRequest<{ session_id?: string }>('/sessions/book', {
      method: 'POST',
      body: payload
    });
  },

  async getSessions() {
    const response = await apiRequest<RawSession[]>('/sessions', { method: 'GET' });
    return {
      success: response.success,
      data: response.data || []
    };
  },

  async getTutorSessions() {
    const response = await apiRequest<RawSession[]>('/sessions?mode=tutor', { method: 'GET' });
    return {
      success: response.success,
      data: (response.data || []).map(normalizeTutorSession)
    };
  },

  async getTuteeSessions() {
    const response = await apiRequest<RawSession[]>('/sessions?mode=tutee', { method: 'GET' });
    return {
      success: response.success,
      data: (response.data || []).map(normalizeTuteeSession)
    };
  },

  async completeSession(id: string) {
    return apiRequest<never>(`/sessions/${id}/complete`, { method: 'POST' });
  },

  async acceptSession(id: string) {
    return apiRequest<never>(`/sessions/${id}/accept`, { method: 'POST' });
  },

  async getJoinInfo(id: string) {
    return apiRequest<SessionJoinInfo>(`/sessions/${id}/join`, { method: 'GET' });
  },

  async declineSession(id: string) {
    return apiRequest<never>(`/sessions/${id}/decline`, { method: 'POST' });
  },

  async cancelSession(id: string) {
    return apiRequest<never>(`/sessions/${id}/cancel`, { method: 'POST' });
  },

  async undoCancellation(id: string) {
    return apiRequest<never>(`/sessions/${id}/cancel/undo`, { method: 'POST' });
  }
};
