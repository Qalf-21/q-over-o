export interface TutorProfile {
  id: string;
  name: string;
  email: string;
  bio: string;
  subjects: Subject[];
  hourlyRate: number;
  rating: number;
  totalReviews: number;
  totalSessions: number;
  isAvailable: boolean;
  createdAt: string;
}

export interface Subject {
  id: string;
  name: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced';
}

export interface TimeSlot {
  id: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // "09:00"
  endTime: string;   // "17:00"
  isAvailable: boolean;
}

export interface Session {
  id: string;
  tuteeId: string;
  tuteeName: string;
  tuteeAvatar?: string;
  subject: string;
  topic: string;
  scheduledAt: string;
  duration: number; // minutes
  status: 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'declined';
  tokenAmount: number;
  notes?: string;
  meetingLink?: string;
  createdAt: string;
}

export interface Earnings {
  totalEarned: number;
  availableBalance: number;
  pendingBalance: number;
  lifetimeSessions: number;
  transactions: Transaction[];
}

export interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  sessionId?: string;
}

export interface WithdrawalRequest {
  id: string;
  amount: number;
  method: 'mpesa';
  phoneNumber: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  processedAt?: string;
}

export interface Notification {
  id: string;
  type: 'session_request' | 'booking_confirmed' | 'payment_received' | 'review_received' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

// Add to existing types

export interface TutorSearchResult {
  id: string;
  name: string;
  avatar?: string;
  bio: string;
  subjects: Subject[];
  hourlyRate: number;
  rating: number;
  totalReviews: number;
  totalSessions: number;
  isAvailable: boolean;
  nextAvailable?: string;
}

export interface SearchFilters {
  query: string;
  subject?: string;
  minRating?: number;
  maxPrice?: number;
  availableNow?: boolean;
}

export interface BookingRequest {
  tutorId: string;
  tutorName: string;
  subjectId?: string;
  subject: string;
  scheduledAt: string;
  duration: number;
  tokenAmount: number;
  notes?: string;
}

export interface TuteeSession {
  id: string;
  tutorId: string;
  tutorName: string;
  tutorAvatar?: string;
  subject: string;
  topic: string;
  scheduledAt: string;
  duration: number;
  status: 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'declined';
  tokenAmount: number;
  meetingLink?: string;
  hasReviewed: boolean;
  review?: {
    rating: number;
    comment: string;
  };
}

export interface ReviewSubmission {
  sessionId: string;
  tutorId: string;
  rating: number;
  comment: string;
}

// Add to existing types

export interface TutorSearchResult {
  id: string;
  name: string;
  avatar?: string;
  bio: string;
  subjects: Subject[];
  hourlyRate: number;
  rating: number;
  totalReviews: number;
  totalSessions: number;
  isAvailable: boolean;
  nextAvailable?: string;
}

export interface SearchFilters {
  query: string;
  subject?: string;
  minRating?: number;
  maxPrice?: number;
  availableNow?: boolean;
}

export interface BookingRequest {
  tutorId: string;
  tutorName: string;
  subject: string;
  scheduledAt: string;
  duration: number;
  tokenAmount: number;
  notes?: string;
}

export interface TuteeSession {
  id: string;
  tutorId: string;
  tutorName: string;
  tutorAvatar?: string;
  subject: string;
  topic: string;
  scheduledAt: string;
  duration: number;
  status: 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'declined';
  tokenAmount: number;
  meetingLink?: string;
  hasReviewed: boolean;
  review?: {
    rating: number;
    comment: string;
  };
}

export interface ReviewSubmission {
  sessionId: string;
  tutorId: string;
  rating: number;
  comment: string;
}
