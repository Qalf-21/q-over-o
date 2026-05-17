// src/features/shared/components/TutorProfileModal.tsx
// Unified tutor public-profile popup. Used by:
//   1. Tutor's own "View public profile" button on /dashboard/profile
//   2. Tutee's "View Profile" button on a TutorCard in /discover
//
// Props:
//   tutorId     — id of the tutor whose profile to show
//   currentUserId — id of the logged-in user (hide book button if same as tutorId)
//   onClose     — close the modal
//   onBook      — called when the "Book Session" button is pressed (omit for tutors)

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Star,
  BookOpen,
  Award,
  GraduationCap,
  CheckCircle,
  Users,
  DollarSign,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { tutorApi } from '../../api/tutorApi';
import { reviewApi } from '../../api/reviewApi';
import type { TutorSearchResult } from '../../types/tutor';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

// ── Star renderer ─────────────────────────────────────────────────────────────

const StarRating: React.FC<{ rating: number; size?: 'sm' | 'md' }> = ({
  rating,
  size = 'md',
}) => {
  const px = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${px} ${
            s <= Math.round(rating)
              ? 'fill-amber-400 text-amber-400'
              : 'fill-gray-200 text-gray-200'
          }`}
        />
      ))}
    </div>
  );
};

const personName = (p: any) =>
  [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'Student';

const formatRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
  return `${Math.floor(months / 12)} year${Math.floor(months / 12) !== 1 ? 's' : ''} ago`;
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface TutorProfileModalProps {
  tutorId: string;
  currentUserId?: string;
  onClose: () => void;
  /** If provided, show the "Book Session" CTA */
  onBook?: (tutor: TutorSearchResult) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const TutorProfileModal: React.FC<TutorProfileModalProps> = ({
  tutorId,
  currentUserId,
  onClose,
  onBook,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  const [tutor, setTutor] = useState<TutorSearchResult | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Prevent body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setLoadError(null);
      const [tutorRes, reviewRes] = await Promise.all([
        tutorApi.getTutor(tutorId),
        reviewApi.getTutorReviews(tutorId),
      ]);
      setTutor(tutorRes.data);
      setReviews(reviewRes.data ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [tutorId]);

  useEffect(() => {
    load();
  }, [load]);

  useAutoRefresh(() => load(true), { intervalMs: 30_000 });

  // Viewing own profile → never show book button
  const isSelf = currentUserId === tutorId;
  const showBook = !!onBook && !isSelf && !!tutor;

  const initial =
    tutor?.name
      ?.split(' ')
      .map((w: string) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ?? '?';

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header bar ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Tutor Profile
            </p>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ── Body (scrollable) ── */}
          <div className="overflow-y-auto flex-1">
            {isLoading && (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            )}

            {loadError && (
              <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {loadError}
              </div>
            )}

            {!isLoading && !loadError && tutor && (
              <div className="p-6 space-y-5">

                {/* Hero card */}
                <div className="flex flex-col sm:flex-row items-start gap-5">
                  {/* Avatar */}
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg flex-shrink-0">
                    {initial}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start flex-wrap gap-2">
                      <h2 className="text-xl font-bold text-gray-900">{tutor.name}</h2>
                      {(tutor as any).isVerified && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                          <CheckCircle className="w-3 h-3" />
                          Verified
                        </span>
                      )}
                    </div>

                    {/* Rating row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                      <div className="flex items-center gap-1.5">
                        <StarRating rating={tutor.rating} size="sm" />
                        <span className="text-sm font-bold text-gray-900">
                          {Number(tutor.rating).toFixed(1)}
                        </span>
                        <span className="text-sm text-gray-400">
                          ({tutor.totalReviews} reviews)
                        </span>
                      </div>
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
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {tutor.subjects.map((s) => (
                        <span
                          key={s.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium"
                        >
                          <BookOpen className="w-3 h-3" />
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Rate + Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-indigo-700">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-xl font-bold">{tutor.hourlyRate}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">tokens / hr</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
                    <p className="text-xl font-bold text-gray-900">{tutor.totalSessions}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Sessions</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
                    <p className="text-xl font-bold text-gray-900">{tutor.totalReviews}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Reviews</p>
                  </div>
                </div>

                {/* Bio */}
                {tutor.bio && (
                  <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-indigo-600" />
                      About {tutor.name.split(' ')[0]}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{tutor.bio}</p>
                  </div>
                )}

                {/* Subjects detail */}
                {tutor.subjects.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-indigo-600" />
                      Subjects Taught
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {tutor.subjects.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 rounded-xl border border-indigo-100"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span className="text-sm font-medium">{s.name}</span>
                          {(s as any).code && (
                            <span className="text-indigo-400 text-xs">{(s as any).code}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reviews */}
                {reviews.length > 0 ? (
                  <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500" />
                      Student Reviews
                      <span className="ml-auto text-xs font-normal text-gray-400">
                        {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                      </span>
                    </h3>
                    <div className="space-y-3">
                      {reviews.slice(0, 5).map((review, i) => (
                        <div
                          key={review.id ?? i}
                          className="flex gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0"
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-300 to-purple-400 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                            {personName(review.profiles)[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-gray-900">
                                {personName(review.profiles)}
                              </p>
                              <span className="text-xs text-gray-400">
                                {formatRelative(review.created_at)}
                              </span>
                            </div>
                            <StarRating rating={review.rating} size="sm" />
                            {review.comment && (
                              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                                {review.comment}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-6 text-center">
                    <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No reviews yet</p>
                  </div>
                )}
              </div>
            )}
          </div>

 {/* ── Footer CTA ── */}
{showBook && (
  <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
    <button
      onClick={() => { onBook!(tutor!); onClose(); }}
      disabled={!tutor!.isAvailable}
      className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md shadow-indigo-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-500 disabled:shadow-none"
    >
      {tutor!.isAvailable
        ? `Book a Session with ${tutor!.name.split(' ')[0]}`
        : `${tutor!.name.split(' ')[0]} is Currently Unavailable`}
    </button>
  </div>
)}

          {/* Own profile — informational footer */}
          {isSelf && (
            <div className="flex-shrink-0 px-6 py-3 border-t border-gray-100 bg-indigo-50/60 text-center">
              <p className="text-xs text-indigo-500 font-medium">
                This is how students see your profile
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
