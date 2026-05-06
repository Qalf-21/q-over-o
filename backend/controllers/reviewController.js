const supabase = require('../config/supabase');
const { AppError, asyncHandler } = require('../utils/errorHandler');

const recalculateTutorRating = async (tutorId) => {
  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('rating')
    .eq('tutor_id', tutorId)
    .eq('reviewee_role', 'tutor')
    .is('deleted_at', null);

  if (error) throw new AppError('Failed to recalculate tutor rating', 500);

  const totalReviews = reviews?.length || 0;
  const avgRating = totalReviews
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
    : 0;

  const { error: updateError } = await supabase
    .from('tutor_profiles')
    .update({
      rating_avg: Math.round(avgRating * 10) / 10,
      total_reviews: totalReviews,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', tutorId);

  if (updateError) throw new AppError('Failed to update tutor rating', 500);
};

exports.createReview = asyncHandler(async (req, res) => {
  const { sessionId, tutorId, revieweeId, rating, comment } = req.body;
  const reviewerId = req.user.id;

  // Validate rating
  if (!rating || rating < 1 || rating > 5) {
    throw new AppError('Rating must be between 1 and 5', 400);
  }

  // Verify session exists and is completed
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    throw new AppError('Session not found', 404);
  }

  if (session.status !== 'completed') {
    throw new AppError('Can only review completed sessions', 400);
  }

  // Verify reviewer participated
  if (![session.tutee_id, session.tutor_id].includes(reviewerId)) {
    throw new AppError('Only session participants can review', 403);
  }

  const reviewerIsTutee = session.tutee_id === reviewerId;
  const targetUserId = reviewerIsTutee ? session.tutor_id : session.tutee_id;
  const targetRole = reviewerIsTutee ? 'tutor' : 'tutee';

  if (reviewerIsTutee && tutorId && tutorId !== session.tutor_id) {
    throw new AppError('Tutor does not match this session', 400);
  }

  if (!reviewerIsTutee && revieweeId && revieweeId !== session.tutee_id) {
    throw new AppError('Reviewee does not match this session', 400);
  }

  // Check if already reviewed
  const { data: existingReview } = await supabase
    .from('reviews')
    .select('id')
    .eq('session_id', sessionId)
    .eq('reviewer_id', reviewerId)
    .eq('reviewee_id', targetUserId)
    .is('deleted_at', null)
    .maybeSingle();

  if (existingReview) {
    throw new AppError('Session already reviewed by this participant', 400);
  }

  // Create review
  const { data: review, error: reviewError } = await supabase
    .from('reviews')
    .insert({
      session_id: sessionId,
      reviewer_id: reviewerId,
      reviewee_id: targetUserId,
      reviewee_role: targetRole,
      tutor_id: targetRole === 'tutor' ? targetUserId : session.tutor_id,
      rating,
      comment
    })
    .select()
    .single();

  if (reviewError) throw new AppError('Failed to create review', 500);

  if (targetRole === 'tutor') {
    await recalculateTutorRating(targetUserId);
  }

  res.status(201).json({
    success: true,
    message: 'Review submitted successfully',
    data: review
  });
});

exports.updateReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;

  if (rating !== undefined && (rating < 1 || rating > 5)) {
    throw new AppError('Rating must be between 1 and 5', 400);
  }

  const { data: existingReview, error: fetchError } = await supabase
    .from('reviews')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !existingReview) throw new AppError('Review not found', 404);
  if (existingReview.reviewer_id !== req.user.id) {
    throw new AppError('Cannot update another user review', 403);
  }

  const updatePayload = {
    updated_at: new Date().toISOString()
  };

  if (rating !== undefined) updatePayload.rating = rating;
  if (comment !== undefined) updatePayload.comment = comment;

  const { data: review, error } = await supabase
    .from('reviews')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('Failed to update review', 500);

  if (existingReview.reviewee_role === 'tutor') {
    await recalculateTutorRating(existingReview.reviewee_id || existingReview.tutor_id);
  }

  res.json({
    success: true,
    message: 'Review updated successfully',
    data: review
  });
});

exports.deleteReview = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: existingReview, error: fetchError } = await supabase
    .from('reviews')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !existingReview) throw new AppError('Review not found', 404);
  if (existingReview.reviewer_id !== req.user.id) {
    throw new AppError('Cannot delete another user review', 403);
  }

  const { error } = await supabase
    .from('reviews')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) throw new AppError('Failed to delete review', 500);

  if (existingReview.reviewee_role === 'tutor') {
    await recalculateTutorRating(existingReview.reviewee_id || existingReview.tutor_id);
  }

  res.json({
    success: true,
    message: 'Review deleted'
  });
});

exports.getTutorReviews = asyncHandler(async (req, res) => {
  const { tutorId } = req.params;

  const { data: reviews, error } = await supabase
    .from('reviews')
    .select(`
      *,
      profiles:reviewer_id (first_name, last_name)
    `)
    .eq('tutor_id', tutorId)
    .eq('reviewee_role', 'tutor')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('Failed to fetch reviews', 500);

  res.json({
    success: true,
    data: reviews
  });
});
