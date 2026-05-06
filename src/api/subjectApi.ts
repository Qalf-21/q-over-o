import { apiRequest } from './client';
import type { Subject } from '../types/tutor';

const normalizeSubject = (subject: any): Subject => ({
  id: subject.id,
  name: subject.name,
  category: subject.category || subject.code || 'General',
  level: subject.level || 'intermediate'
});

export const subjectApi = {
  async getSubjects() {
    const response = await apiRequest<any[]>('/subjects', { method: 'GET', auth: false });
    return {
      success: response.success,
      data: (response.data || []).map(normalizeSubject)
    };
  }
};
