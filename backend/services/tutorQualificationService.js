'use strict';

const supabase = require('../config/supabase');
const { AppError } = require('../utils/errorHandler');

const QUALIFICATION_REQUIREMENTS = Object.freeze({
  hours: 30,
  rating: 3,
  reviewers: 20,
});

const QUALIFICATION_STATES = Object.freeze({
  NOT_QUALIFIED: 'NOT_QUALIFIED',
  IN_PROGRESS: 'IN_PROGRESS',
  QUALIFIED: 'QUALIFIED',
});

const hoursBetween = (start, end) => {
  if (!start || !end) return 0;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  return (endMs - startMs) / 36e5;
};

const roundOne = (value) => Math.round(value * 10) / 10;

async function getTutorQualificationStatus(tutorId) {
  if (!tutorId) {
    throw new AppError('Tutor ID is required', 400, 'VALIDATION_ERROR');
  }

  const [{ data: sessions, error: sessionsError }, { data: reviews, error: reviewsError }] = await Promise.all([
    supabase
      .from('sessions')
      .select('id, start_time, end_time')
      .eq('tutor_id', tutorId)
      .eq('status', 'completed'),
    supabase
      .from('reviews')
      .select('rating, reviewer_id, profiles:reviewer_id(id)')
      .eq('tutor_id', tutorId)
      .eq('reviewee_role', 'tutor')
      .is('deleted_at', null),
  ]);

  if (sessionsError) {
    throw new AppError('Failed to calculate completed tutor hours', 500, 'QUALIFICATION_QUERY_FAILED');
  }
  if (reviewsError) {
    throw new AppError('Failed to calculate tutor reviews', 500, 'QUALIFICATION_QUERY_FAILED');
  }

  const completedSessions = sessions || [];
  const validReviews = (reviews || []).filter((review) =>
    review.reviewer_id &&
    review.profiles?.id &&
    Number.isFinite(Number(review.rating)) &&
    Number(review.rating) >= 1 &&
    Number(review.rating) <= 5
  );

  const hoursCompleted = roundOne(
    completedSessions.reduce((sum, session) => sum + hoursBetween(session.start_time, session.end_time), 0)
  );
  const averageRating = validReviews.length
    ? roundOne(validReviews.reduce((sum, review) => sum + Number(review.rating), 0) / validReviews.length)
    : 0;
  const uniqueReviewerCount = new Set(validReviews.map((review) => review.reviewer_id)).size;

  const hoursRemaining = Math.max(0, roundOne(QUALIFICATION_REQUIREMENTS.hours - hoursCompleted));
  const reviewersRemaining = Math.max(0, QUALIFICATION_REQUIREMENTS.reviewers - uniqueReviewerCount);
  const ratingRemaining = Math.max(0, roundOne(QUALIFICATION_REQUIREMENTS.rating - averageRating));

  const hasRequiredHours = hoursCompleted >= QUALIFICATION_REQUIREMENTS.hours;
  const hasRequiredReviewers = uniqueReviewerCount >= QUALIFICATION_REQUIREMENTS.reviewers;
  const hasRequiredRating = averageRating >= QUALIFICATION_REQUIREMENTS.rating;
  const qualified = hasRequiredHours && hasRequiredReviewers && hasRequiredRating;

  const progressParts = [
    Math.min(1, hoursCompleted / QUALIFICATION_REQUIREMENTS.hours),
    Math.min(1, uniqueReviewerCount / QUALIFICATION_REQUIREMENTS.reviewers),
    hasRequiredRating ? 1 : Math.min(1, averageRating / QUALIFICATION_REQUIREMENTS.rating),
  ];
  const progressPercentage = Math.min(
    100,
    Math.round((progressParts.reduce((sum, value) => sum + value, 0) / progressParts.length) * 100)
  );

  const hasProgress = hoursCompleted > 0 || uniqueReviewerCount > 0 || averageRating > 0;
  const state = qualified
    ? QUALIFICATION_STATES.QUALIFIED
    : hasProgress
    ? QUALIFICATION_STATES.IN_PROGRESS
    : QUALIFICATION_STATES.NOT_QUALIFIED;

  return {
    state,
    qualified,
    requirements: QUALIFICATION_REQUIREMENTS,
    hoursCompleted,
    hoursRemaining,
    averageRating,
    ratingRemaining,
    uniqueReviewerCount,
    reviewersRemaining,
    completedSessions: completedSessions.length,
    progressPercentage,
  };
}

module.exports = {
  QUALIFICATION_REQUIREMENTS,
  QUALIFICATION_STATES,
  getTutorQualificationStatus,
};
