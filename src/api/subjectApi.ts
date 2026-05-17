// src/api/subjectApi.ts — FULL REPLACEMENT
//
// Fix: normalizeSubject no longer references `category` or `level` which don't
//      exist in the subjects table (only id, name, code). The Subject type still
//      has category/level for compatibility — we default them gracefully.

import { apiRequest } from './client';
import type { Subject } from '../types/tutor';

type RawSubject = {
  id?: string;
  name?: string;
  code?: string;
};

const normalizeSubject = (subject: RawSubject): Subject => ({
  id:       subject.id || '',
  name:     subject.name || 'General',
  // `category` and `level` are not stored in DB — use code as a sensible fallback
  category: subject.code || 'General',
  level:    'intermediate'
});

export const subjectApi = {
  async getSubjects() {
    const response = await apiRequest<RawSubject[]>('/subjects', { method: 'GET', auth: false });
    return {
      success: response.success,
      data: (response.data || []).map(normalizeSubject)
    };
  }
};
