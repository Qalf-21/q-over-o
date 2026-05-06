const supabase = require('../config/supabase');
const { AppError, asyncHandler } = require('../utils/errorHandler');

const displayName = (profile) => [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');

exports.bookSession = asyncHandler(async (req, res) => {
  const { tutor_id, subject_id, start_time, end_time } = req.body;

  if (!tutor_id || !subject_id || !start_time || !end_time) {
    throw new AppError('tutor_id, subject_id, start_time, and end_time are required', 400);
  }

  const { data: completedSessions, error: completedError } = await supabase
    .from('sessions')
    .select('id, tutor_id, start_time')
    .eq('tutee_id', req.user.id)
    .eq('status', 'completed');

  if (completedError) throw new AppError('Failed to validate review requirements', 500);

  if (completedSessions?.length) {
    const sessionIds = completedSessions.map(session => session.id);
    const { data: reviews, error: reviewError } = await supabase
      .from('reviews')
      .select('session_id')
      .eq('reviewer_id', req.user.id)
      .eq('reviewee_role', 'tutor')
      .in('session_id', sessionIds);

    if (reviewError) throw new AppError('Failed to validate review requirements', 500);

    const reviewedSessionIds = new Set((reviews || []).map(review => review.session_id));
    const missingReview = completedSessions.find(session => !reviewedSessionIds.has(session.id));

    if (missingReview) {
      throw new AppError('You must review completed tutor sessions before booking another session', 409, 'REVIEW_REQUIRED');
    }
  }

  const { data, error } = await supabase.rpc('book_session_atomic', {
    p_tutee_id: req.user.id,
    p_tutor_id: tutor_id,
    p_subject_id: subject_id,
    p_start: start_time,
    p_end: end_time
  });

  if (error) {
    throw new AppError(error.message, 400);
  }

  res.status(201).json({
    success: true,
    session_id: data
  });
});

exports.getSessions = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const canTutor = req.user.role === 'tutor' || req.user.is_tutor;
  const requestedMode = req.query.mode;
  const isTutorMode = canTutor && requestedMode !== 'tutee';
  const filter = isTutorMode ? 'tutor_id' : 'tutee_id';

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select(`
      *,
      subjects:subject_id(id, name, code)
    `)
    .eq(filter, userId)
    .order('start_time', { ascending: false });

  if (error) throw new AppError('Failed to fetch sessions', 500);

  const enriched = await Promise.all((sessions || []).map(async (session) => {
    const otherUserId = isTutorMode ? session.tutee_id : session.tutor_id;
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', otherUserId)
      .single();

    let review = null;
    if (session.status === 'completed') {
      const { data: existingReview } = await supabase
        .from('reviews')
        .select('*')
        .eq('session_id', session.id)
        .eq('reviewer_id', userId)
        .is('deleted_at', null)
        .maybeSingle();

      review = existingReview || null;
    }

    return {
      ...session,
      subject: session.subjects?.name,
      otherPartyName: displayName(profile) || 'Unknown',
      has_reviewed: Boolean(review),
      review
    };
  }));

  res.json({
    success: true,
    data: enriched
  });
});

exports.completeSession = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase.rpc('release_escrow_on_completion', {
    p_session_id: id,
    p_actor_id: req.user.id
  });

  if (error) {
    throw new AppError(error.message, 400);
  }

  res.json({
    success: true,
    message: 'Session completed and payment released'
  });
});

exports.cancelSession = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase.rpc('refund_escrow_on_cancellation', {
    p_session_id: id,
    p_actor_id: req.user.id
  });

  if (error) {
    throw new AppError(error.message, 400);
  }

  res.json({
    success: true,
    message: 'Session cancelled and refund processed'
  });
});

exports.undoCancellation = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase.rpc('undo_session_cancellation', {
    p_session_id: id,
    p_actor_id: req.user.id
  });

  if (error) {
    throw new AppError(error.message, 400);
  }

  res.json({
    success: true,
    message: 'Session cancellation undone'
  });
});
