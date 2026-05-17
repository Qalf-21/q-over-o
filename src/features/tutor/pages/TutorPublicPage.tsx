// src/features/tutors/pages/TutorPublicPage.tsx
// Route: /tutors/:id  (PUBLIC — no auth required)
// Purpose: Marketplace-facing display page for a tutor.
// DISPLAY ONLY — all editing happens at /dashboard/profile.

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star,
  //Clock,
  BookOpen,
  MessageCircle,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  DollarSign,
  Calendar,
  CheckCircle,
  Users,
  GraduationCap,
  Award,
  X,
} from 'lucide-react';
import { tutorApi } from '../../../api/tutorApi';
import { reviewApi } from '../../../api/reviewApi';
import { useAuth } from '../../../shared/hooks/useAuth';
import { useAutoRefresh } from '../../../shared/hooks/useAutoRefresh';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subject {
  id: string;
  name: string;
  code?: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  profiles?: { first_name: string; last_name: string };
}

interface TutorDetail {
  id: string;
  name: string;
  bio: string;
  hourlyRate: number;
  rating: number;
  totalReviews: number;
  totalSessions: number;
  isAvailable: boolean;
  isVerified?: boolean;
  subjects: Subject[];
  recentReviews?: Review[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
};

const personName = (p?: { first_name: string; last_name: string }) =>
  p ? [p.first_name, p.last_name].filter(Boolean).join(' ') : 'Anonymous';

// ─── Star Rating Display ──────────────────────────────────────────────────────

const StarRating: React.FC<{ rating: number; size?: 'sm' | 'md' | 'lg' }> = ({
  rating,
  size = 'md',
}) => {
  const sizeClass = size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClass} ${
            star <= Math.round(rating)
              ? 'fill-amber-400 text-amber-400'
              : 'fill-gray-200 text-gray-200'
          }`}
        />
      ))}
    </div>
  );
};

// ─── Booking CTA Modal ────────────────────────────────────────────────────────

interface BookingPromptProps {
  tutor: TutorDetail;
  onClose: () => void;
}

const BookingPrompt: React.FC<BookingPromptProps> = ({ tutor, onClose }) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleBook = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/tutors/${tutor.id}` } });
    } else {
      navigate(`/dashboard/discover`, { state: { bookTutorId: tutor.id } });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Book a Session</h3>
            <p className="text-sm text-gray-500 mt-0.5">with {tutor.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-indigo-50 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-600">Rate</span>
            <span className="font-bold text-indigo-700 flex items-center gap-1">
              <DollarSign className="w-4 h-4" />
              {tutor.hourlyRate} tokens/hr
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Availability</span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                tutor.isAvailable
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  tutor.isAvailable ? 'bg-emerald-500' : 'bg-gray-400'
                }`}
              />
              {tutor.isAvailable ? 'Available now' : 'Not available'}
            </span>
          </div>
        </div>

        {!isAuthenticated && (
          <p className="text-xs text-gray-500 mb-4 text-center">
            You need an account to book a session.
          </p>
        )}

        <button
          onClick={handleBook}
          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200"
        >
          {isAuthenticated ? 'Book Session' : 'Sign in to Book'}
        </button>
      </motion.div>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

export const TutorPublicPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [tutor, setTutor] = useState<TutorDetail | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showBookingPrompt, setShowBookingPrompt] = useState(false);

  const loadTutor = useCallback(async (silent = false) => {
    if (!id) return;
    try {
      if (!silent) setIsLoading(true);
      setLoadError(null);
      const [tutorRes, reviewRes] = await Promise.all([
        tutorApi.getTutor(id),
        reviewApi.getTutorReviews(id).catch(() => ({ data: [] })),
      ]);
      setTutor(tutorRes.data as unknown as TutorDetail);
      setReviews((reviewRes as any).data ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load tutor profile');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTutor();
  }, [loadTutor]);

  useAutoRefresh(() => loadTutor(true), { enabled: Boolean(id), intervalMs: 30_000 });

  const handleBook = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/tutors/${id}` } });
    } else {
      setShowBookingPrompt(true);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="text-sm text-gray-500">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (loadError || !tutor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 max-w-md w-full p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">Tutor Not Found</h2>
          <p className="text-gray-500 text-sm mb-6">
            {loadError ?? 'This tutor profile does not exist or has been removed.'}
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const initial = tutor.name?.[0]?.toUpperCase() ?? 'T';

  return (
    <>
      {/* Sticky top nav */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Q-over-o
          </Link>
          <div className="flex items-center gap-2">
            {!isAuthenticated && (
              <Link
                to="/login"
                className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
              >
                Sign in
              </Link>
            )}
            <button
              onClick={handleBook}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm"
            >
              Book Session
            </button>
          </div>
        </div>
      </header>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
          <div className="grid lg:grid-cols-3 gap-8 items-start">

            {/* ── Main column ── */}
            <div className="lg:col-span-2 space-y-6">

              {/* Hero card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8"
              >
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                      {initial}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <h1 className="text-2xl font-bold text-gray-900 truncate">{tutor.name}</h1>
                      {tutor.isVerified && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold mt-0.5">
                          <CheckCircle className="w-3 h-3" />
                          Verified
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                      {/* Rating */}
                      <div className="flex items-center gap-1.5">
                        <StarRating rating={tutor.rating} />
                        <span className="font-bold text-gray-900 text-sm">
                          {Number(tutor.rating).toFixed(1)}
                        </span>
                        <span className="text-gray-400 text-sm">
                          ({tutor.totalReviews} reviews)
                        </span>
                      </div>

                      {/* Availability badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          tutor.isAvailable
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            tutor.isAvailable ? 'bg-emerald-500' : 'bg-gray-400'
                          }`}
                        />
                        {tutor.isAvailable ? 'Available' : 'Unavailable'}
                      </span>
                    </div>

                    {/* Subjects */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {tutor.subjects.map((subject) => (
                        <span
                          key={subject.id}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          {subject.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Rate */}
                <div className="mt-6 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl px-5 py-3">
                  <div className="flex items-center gap-2 text-indigo-700">
                    <DollarSign className="w-5 h-5" />
                    <span className="font-bold text-lg">{tutor.hourlyRate}</span>
                    <span className="text-gray-500 text-sm font-normal">tokens / hour</span>
                  </div>
                  <button
                    onClick={handleBook}
                    className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm"
                  >
                    Book Session
                  </button>
                </div>
              </motion.div>

              {/* Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="grid grid-cols-3 gap-4"
              >
                {[
                  {
                    icon: Calendar,
                    label: 'Sessions',
                    value: tutor.totalSessions,
                    color: 'indigo',
                  },
                  {
                    icon: MessageCircle,
                    label: 'Reviews',
                    value: tutor.totalReviews,
                    color: 'purple',
                  },
                  {
                    icon: Star,
                    label: 'Rating',
                    value: Number(tutor.rating).toFixed(1),
                    color: 'amber',
                  },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div
                    key={label}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center"
                  >
                    <div
                      className={`w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center bg-${color}-50`}
                    >
                      <Icon className={`w-5 h-5 text-${color}-600`} />
                    </div>
                    <p className={`text-2xl font-bold text-${color}-700`}>{value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </motion.div>

              {/* Bio */}
              {tutor.bio && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
                >
                  <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                    About {tutor.name.split(' ')[0]}
                  </h2>
                  <p className="text-gray-600 leading-relaxed">{tutor.bio}</p>
                </motion.div>
              )}

              {/* Subjects detail */}
              {tutor.subjects.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.16 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
                >
                  <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    Subjects Taught
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {tutor.subjects.map((subject) => (
                      <div
                        key={subject.id}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 rounded-xl border border-indigo-100"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span className="font-medium text-sm">{subject.name}</span>
                        {subject.code && (
                          <span className="text-indigo-400 text-xs">{subject.code}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Reviews */}
              {reviews.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
                >
                  <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500" />
                    Student Reviews
                    <span className="ml-auto text-xs font-normal text-gray-400">
                      {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                    </span>
                  </h2>
                  <div className="space-y-4">
                    {reviews.slice(0, 6).map((review, i) => (
                      <motion.div
                        key={review.id ?? i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.22 + i * 0.04 }}
                        className="flex gap-4 pb-4 border-b border-gray-50 last:border-0 last:pb-0"
                      >
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-300 to-purple-400 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                          {personName(review.profiles)[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">
                              {personName(review.profiles)}
                            </p>
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {formatRelative(review.created_at)}
                            </span>
                          </div>
                          <StarRating rating={review.rating} size="sm" />
                          {review.comment && (
                            <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
                              {review.comment}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Empty reviews */}
              {reviews.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center"
                >
                  <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-500">No reviews yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Be the first to book and leave a review!
                  </p>
                </motion.div>
              )}
            </div>

            {/* ── Sticky booking sidebar ── */}
            <div className="lg:sticky lg:top-24">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-lg p-6"
              >
                <div className="text-center mb-5">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold shadow mx-auto mb-3">
                    {initial}
                  </div>
                  <h3 className="font-bold text-gray-900">{tutor.name}</h3>
                  <StarRating rating={tutor.rating} size="sm" />
                  <p className="text-xs text-gray-400 mt-1">
                    {tutor.totalReviews} review{tutor.totalReviews !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Rate */}
                <div className="bg-indigo-50 rounded-xl px-4 py-3 mb-4 text-center">
                  <p className="text-2xl font-bold text-indigo-700">
                    {tutor.hourlyRate}{' '}
                    <span className="text-base font-normal text-gray-500">tokens</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">per hour</p>
                </div>

                {/* Availability */}
                <div className="flex items-center justify-center gap-2 mb-5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      tutor.isAvailable ? 'bg-emerald-500' : 'bg-gray-300'
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      tutor.isAvailable ? 'text-emerald-700' : 'text-gray-400'
                    }`}
                  >
                    {tutor.isAvailable ? 'Available for sessions' : 'Currently unavailable'}
                  </span>
                </div>

                {/* Subjects pills */}
                {tutor.subjects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-5 justify-center">
                    {tutor.subjects.slice(0, 4).map((s) => (
                      <span
                        key={s.id}
                        className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium"
                      >
                        {s.name}
                      </span>
                    ))}
                    {tutor.subjects.length > 4 && (
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs">
                        +{tutor.subjects.length - 4} more
                      </span>
                    )}
                  </div>
                )}

                <button
                  onClick={handleBook}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200 text-sm"
                >
                  Book a Session
                </button>

                {!isAuthenticated && (
                  <p className="text-center text-xs text-gray-400 mt-3">
                    Already have an account?{' '}
                    <Link to="/login" className="text-indigo-500 hover:underline">
                      Sign in
                    </Link>
                  </p>
                )}

                <div className="mt-5 pt-4 border-t border-gray-50">
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div>
                      <p className="text-lg font-bold text-gray-900">{tutor.totalSessions}</p>
                      <p className="text-xs text-gray-500">Sessions</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900">
                        {Number(tutor.rating).toFixed(1)}
                      </p>
                      <p className="text-xs text-gray-500">Avg Rating</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Booking prompt modal */}
      <AnimatePresence>
        {showBookingPrompt && (
          <BookingPrompt tutor={tutor} onClose={() => setShowBookingPrompt(false)} />
        )}
      </AnimatePresence>
    </>
  );
};
