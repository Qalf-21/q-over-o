
// backend/controllers/sessionController.js — FULL REPLACEMENT
//
// Changes to bookSession:
//  • Accepts optional notes and availability_slot_id in the request body
//  • After the atomic booking RPC succeeds, trims or splits the availability slot:
//      - If the session covers the entire slot → mark slot is_available = false
//      - If session starts at slot start but ends before slot end → shrink slot start forward
//      - If session ends at slot end but starts after slot start → shrink slot end backward
//      - If session is in the middle of the slot → delete original, insert two new slots
//  • Self-booking guard: tutee cannot book themselves as tutor

const supabase = require('../config/supabase');
const { AppError, asyncHandler } = require('../utils/errorHandler');
const { getTutorQualificationStatus } = require('../services/tutorQualificationService');
const { signJaasJwt } = require('../services/jaasService');
const { parseUtcDate, toUtcISOString } = require('../utils/dateTime');

const displayName = (profile) => [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
const SESSION_JOIN_EARLY_MINUTES = 5;
const SESSION_JOIN_LATE_MINUTES = 10;
const SESSION_EXPIRY_GRACE_MINUTES = 10;
const SESSION_BOOKING_LEAD_MINUTES = 10;
const MIN_SESSION_MINUTES = 30;
const SESSION_DURATION_INCREMENT_MINUTES = 30;
const MIN_SESSION_MS = MIN_SESSION_MINUTES * 60 * 1000;
const SESSION_DURATION_INCREMENT_MS = SESSION_DURATION_INCREMENT_MINUTES * 60 * 1000;
const TUTOR_EARNINGS_SHARE = 0.6;

const getCurrentBookableStart = (slotStart, now = new Date()) => {
  const start = parseUtcDate(slotStart);
  const earliestStart = new Date(now.getTime() + SESSION_BOOKING_LEAD_MINUTES * 60 * 1000);
  return start < earliestStart ? earliestStart : start;
};

// ── Slot trimming helper ───────────────────────────────────────────────────────
// Called after a successful booking to remove the booked window from the slot.
// This ensures the slot is no longer shown as available for that time.
const trimAvailabilitySlot = async (tutorId, slotId, sessionStart, sessionEnd) => {
  if (!slotId) return; // no slot id provided — skip (graceful degradation)

  const { data: slot, error: fetchErr } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('id', slotId)
    .eq('tutor_id', tutorId)
    .single();

  if (fetchErr || !slot) return; // slot not found or already gone — skip

  const slotStart = toUtcISOString(getCurrentBookableStart(slot.start_time));
  const slotEnd   = toUtcISOString(slot.end_time);

  const sessionStartsAtSlotStart = sessionStart <= slotStart;
  const sessionEndsAtSlotEnd     = sessionEnd   >= slotEnd;

  if (sessionStartsAtSlotStart && sessionEndsAtSlotEnd) {
    // Entire slot consumed → soft-delete
    await supabase
      .from('availability_slots')
      .update({ is_available: false, deleted_at: new Date().toISOString() })
      .eq('id', slotId);

  } else if (sessionStartsAtSlotStart) {
    // Session at the beginning → push slot start forward
    await supabase
      .from('availability_slots')
      .update({ start_time: sessionEnd })
      .eq('id', slotId);

  } else if (sessionEndsAtSlotEnd) {
    // Session at the end → push slot end backward
    await supabase
      .from('availability_slots')
      .update({ end_time: sessionStart })
      .eq('id', slotId);

  } else {
    // Session in the middle → split into two slots
    // Shrink the existing slot to the left portion
    await supabase
      .from('availability_slots')
      .update({ end_time: sessionStart })
      .eq('id', slotId);

    // Insert the right portion as a new slot
    await supabase
      .from('availability_slots')
      .insert({
        tutor_id:    tutorId,
        start_time:  sessionEnd,
        end_time:    slotEnd,
        is_available: true,
      });
  }
};

const createFreeSession = async ({ tuteeId, tutorId, subjectId, startTime, endTime }) => {
  const basePayload = {
    tutee_id: tuteeId,
    tutor_id: tutorId,
    subject_id: subjectId,
    start_time: startTime,
    end_time: endTime,
    status: 'pending',
  };

  const payloads = [
    { ...basePayload, token_amount: 0 },
    { ...basePayload, amount_tokens: 0 },
    { ...basePayload, cost_tokens: 0 },
    basePayload,
  ];

  let session = null;
  let error = null;
  for (const payload of payloads) {
    const result = await supabase
      .from('sessions')
      .insert(payload)
      .select('id')
      .single();
    session = result.data;
    error = result.error;
    if (!error && session) break;
  }

  if (error || !session) {
    throw new AppError(`Free session booking failed: ${error?.message || 'unknown error'}`, 500, 'FREE_BOOKING_FAILED');
  }

  const meetingLink = `/session/${session.id}/join`;
  const meetingUpdate = await supabase
    .from('sessions')
    .update({ meeting_url: meetingLink })
    .eq('id', session.id);
  if (meetingUpdate.error) {
    await supabase
      .from('sessions')
      .update({ meeting_link: meetingLink })
      .eq('id', session.id);
  }

  return session.id;
};

const updateSessionTopic = async (sessionId, topic) => {
  const normalizedTopic = typeof topic === 'string' ? topic.trim() : '';
  if (!normalizedTopic) return;

  const payloads = [
    { topic: normalizedTopic, notes: normalizedTopic },
    { topic: normalizedTopic },
    { notes: normalizedTopic },
  ];

  let lastError = null;
  for (const payload of payloads) {
    const { error } = await supabase
      .from('sessions')
      .update(payload)
      .eq('id', sessionId);

    if (!error) return;
    lastError = error;
  }

  throw new AppError(
    `Failed to save session topic: ${lastError?.message || 'unknown error'}`,
    500,
    'SESSION_TOPIC_SAVE_FAILED',
  );
};

const updateSessionStatus = async (sessionId, status) => {
  const { error } = await supabase
    .from('sessions')
    .update({ status })
    .eq('id', sessionId);

  if (error) {
    throw new AppError(`Failed to update session status: ${error.message}`, 500);
  }
};

const getSessionForActor = async (sessionId, actorId) => {
  const { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .or(`tutee_id.eq.${actorId},tutor_id.eq.${actorId}`)
    .maybeSingle();

  if (error) throw new AppError('Failed to load session', 500);
  if (!session) throw new AppError('Session not found', 404);
  return session;
};

const withinJoinWindow = (session, now = new Date()) => {
  const start = parseUtcDate(session.start_time);
  const end = parseUtcDate(session.end_time);
  const opensAt = new Date(start.getTime() - SESSION_JOIN_EARLY_MINUTES * 60 * 1000);
  const closesAt = new Date(end.getTime() + SESSION_JOIN_LATE_MINUTES * 60 * 1000);
  return now >= opensAt && now <= closesAt;
};

const getSessionMeetingLink = (session, now = new Date()) => {
  if (!['confirmed', 'in-progress'].includes(session.status)) return null;
  if (!withinJoinWindow(session, now)) return null;
  return `/session/${session.id}/join`;
};

const notifyUser = async ({ userId, type, title, message, linkUrl, data = {} }) => {
  if (!userId) return;

  const base = {
    type,
    title,
    message,
    data,
  };

  const payloads = [
    { ...base, user_id: userId, link_url: linkUrl, is_read: false },
    { ...base, user_id: userId, link: linkUrl, is_read: false },
    { ...base, recipient_id: userId, link_url: linkUrl, read: false },
  ];

  for (const payload of payloads) {
    const { error } = await supabase.from('notifications').insert(payload);
    if (!error) return;
  }
};

const expireOverdueSessions = async (userId = null) => {
  const cutoffMs = Date.now() - SESSION_EXPIRY_GRACE_MINUTES * 60 * 1000;
  let query = supabase
    .from('sessions')
    .select('id, tutor_id, tutee_id, status, end_time')
    .eq('status', 'pending');

  if (userId) {
    query = query.or(`tutee_id.eq.${userId},tutor_id.eq.${userId}`);
  }

  const { data: sessions } = await query;
  const expiredSessions = (sessions || []).filter((session) => (
    parseUtcDate(session.end_time).getTime() < cutoffMs
  ));

  if (!expiredSessions?.length) return;

  await supabase
    .from('sessions')
    .update({ status: 'cancelled' })
    .in('id', expiredSessions.map(session => session.id));
};

exports.expireOverdueSessions = expireOverdueSessions;

const resolveBookingSubjectId = async (tutorId, subjectId) => {
  const { data: tutorProfile, error: tutorProfileError } = await supabase
    .from('tutor_profiles')
    .select('id, user_id')
    .eq('user_id', tutorId)
    .maybeSingle();

  if (tutorProfileError) {
    console.error('[bookSession] tutor profile lookup failed:', JSON.stringify(tutorProfileError));
    throw new AppError('Failed to validate tutor profile', 500);
  }

  if (!tutorProfile?.id) {
    throw new AppError('Tutor profile is not ready for booking', 409, 'TUTOR_PROFILE_NOT_READY');
  }

  let query = supabase
    .from('tutor_subjects')
    .select('subject_id')
    .eq('tutor_id', tutorProfile.id);

  if (subjectId) {
    query = query.eq('subject_id', subjectId);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    console.error('[bookSession] subject validation failed:', JSON.stringify(error));
    throw new AppError('Failed to validate tutor subject', 500);
  }

  if (!data?.subject_id) {
    throw new AppError(
      subjectId
        ? 'Selected subject is not offered by this tutor'
        : 'This tutor has no approved subjects available for booking',
      400,
      'INVALID_BOOKING_SUBJECT',
    );
  }

  return data.subject_id;
};

// ── bookSession ────────────────────────────────────────────────────────────────
exports.bookSession = asyncHandler(async (req, res) => {
  const {
    tutor_id,
    subject_id,
    start_time,
    end_time,
    notes,
    topic,
    availability_slot_id,
  } = req.body;

  if (!tutor_id || !start_time || !end_time) {
    throw new AppError('tutor_id, start_time, and end_time are required', 400);
  }

  const requestedSubjectId = subject_id && subject_id !== '' ? subject_id : null;

  const requestedStart = parseUtcDate(start_time);
  const requestedEnd = parseUtcDate(end_time);
  const now = new Date();
  const earliestStart = new Date(now.getTime() + SESSION_BOOKING_LEAD_MINUTES * 60 * 1000);
  const durationMs = requestedEnd.getTime() - requestedStart.getTime();

  if (
    Number.isNaN(requestedStart.getTime()) ||
    Number.isNaN(requestedEnd.getTime()) ||
    requestedEnd <= requestedStart
  ) {
    throw new AppError('Session end time must be after start time', 400);
  }

  if (requestedStart < earliestStart) {
    throw new AppError('Session start time must be at least 10 minutes from now', 400, 'SESSION_TOO_SOON');
  }

  if (durationMs < MIN_SESSION_MS) {
    throw new AppError('Minimum session duration is 30 minutes', 400, 'SESSION_TOO_SHORT');
  }

  if (durationMs % SESSION_DURATION_INCREMENT_MS !== 0) {
    throw new AppError('Session duration must use 30-minute increments', 400, 'INVALID_SESSION_DURATION_INCREMENT');
  }

  // ── Self-booking guard ──────────────────────────────────────────────────────
  if (req.user.id === tutor_id) {
    throw new AppError('You cannot book a session with yourself', 400);
  }

  const resolvedSubjectId = await resolveBookingSubjectId(tutor_id, requestedSubjectId);

  if (availability_slot_id) {
    const { data: slot, error: slotError } = await supabase
      .from('availability_slots')
      .select('*')
      .eq('id', availability_slot_id)
      .eq('tutor_id', tutor_id)
      .eq('is_available', true)
      .single();

    if (slotError || !slot) {
      throw new AppError('Availability slot is no longer available', 409);
    }

    const slotEnd = parseUtcDate(slot.end_time);
    const bookableStart = getCurrentBookableStart(slot.start_time, now);

    if (slotEnd <= now || bookableStart >= slotEnd) {
      throw new AppError('Availability slot is no longer available', 409);
    }

    if (requestedStart < bookableStart || requestedEnd > slotEnd) {
      throw new AppError('Requested session is outside the available time slot', 409);
    }
  }

  const { data: overlappingTutorSession, error: tutorOverlapError } = await supabase
    .from('sessions')
    .select('id')
    .eq('tutor_id', tutor_id)
    .in('status', ['pending', 'confirmed', 'in-progress'])
    .lt('start_time', toUtcISOString(requestedEnd))
    .gt('end_time', toUtcISOString(requestedStart))
    .limit(1)
    .maybeSingle();

  if (tutorOverlapError) {
    console.error('[bookSession] tutor overlap validation failed:', JSON.stringify(tutorOverlapError));
    throw new AppError('Failed to validate tutor availability', 500);
  }

  if (overlappingTutorSession) {
    throw new AppError('This tutor already has a session during that time', 409, 'TUTOR_SESSION_OVERLAP');
  }

  const { data: overlappingTuteeSession, error: tuteeOverlapError } = await supabase
    .from('sessions')
    .select('id')
    .eq('tutee_id', req.user.id)
    .in('status', ['pending', 'confirmed', 'in-progress'])
    .lt('start_time', toUtcISOString(requestedEnd))
    .gt('end_time', toUtcISOString(requestedStart))
    .limit(1)
    .maybeSingle();

  if (tuteeOverlapError) {
    console.error('[bookSession] tutee overlap validation failed:', JSON.stringify(tuteeOverlapError));
    throw new AppError('Failed to validate your schedule', 500);
  }

  if (overlappingTuteeSession) {
    throw new AppError('You already have a session during that time', 409, 'TUTEE_SESSION_OVERLAP');
  }

  // ── Review gate ─────────────────────────────────────────────────────────────
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
      throw new AppError(
        'You must review completed tutor sessions before booking another session',
        409,
        'REVIEW_REQUIRED'
      );
    }
  }

  const qualification = await getTutorQualificationStatus(tutor_id);
  const normalizedStartTime = toUtcISOString(requestedStart);
  const normalizedEndTime = toUtcISOString(requestedEnd);

  const sessionId = await createFreeSession({
    tuteeId: req.user.id,
    tutorId: tutor_id,
    subjectId: resolvedSubjectId,
    startTime: normalizedStartTime,
    endTime: normalizedEndTime,
  });

  await updateSessionTopic(sessionId, topic ?? notes);

  // ── Trim the availability slot (best-effort, non-blocking) ───────────────────
  // We do this after the booking succeeds so a slot-trim failure doesn't
  // roll back a successful booking.
  try {
    await trimAvailabilitySlot(tutor_id, availability_slot_id, normalizedStartTime, normalizedEndTime);
  } catch (trimErr) {
    // Log but don't fail the request
    console.error('[bookSession] slot trim failed:', trimErr?.message ?? trimErr);
  }

  await notifyUser({
    userId: tutor_id,
    type: 'session_request',
    title: 'New session request',
    message: 'A tutee booked a session with you. Go to your sessions page to accept or decline it.',
    linkUrl: '/dashboard/sessions',
    data: { sessionId },
  });

  res.status(201).json({
    success: true,
    session_id: sessionId,
    data: {
      sessionId,
      paymentLocked: false,
      tokenAmount: 0,
      escrowAmount: 0,
      qualification,
    },
  });
});

// ── getSessions ────────────────────────────────────────────────────────────────
exports.getSessions = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  await expireOverdueSessions(userId);
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
      meeting_url: getSessionMeetingLink(session),
      token_amount: session.token_amount ?? session.amount_tokens ?? session.cost_tokens ?? 0,
      has_reviewed: Boolean(review),
      review
    };
  }));

  res.json({
    success: true,
    data: enriched
  });
});

// ── completeSession ────────────────────────────────────────────────────────────
exports.completeSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const session = await getSessionForActor(id, req.user.id);

  if (session.tutor_id !== req.user.id) {
    throw new AppError('Only the tutor can complete this session', 403);
  }

  if (!['confirmed', 'in-progress'].includes(session.status)) {
    throw new AppError('Only accepted sessions can be completed', 409);
  }

  const { data: escrow } = await supabase
    .from('escrow')
    .select('*')
    .eq('session_id', id)
    .maybeSingle();

  if (escrow?.amount_tokens > 0 && escrow.status === 'locked') {
    const tutorShare = Math.floor(Number(escrow.amount_tokens) * TUTOR_EARNINGS_SHARE);
    let { error } = await supabase.rpc('release_escrow_on_completion', {
      p_session_id: id,
      p_actor_id: req.user.id,
      p_tutor_share: tutorShare,
    });

    if (error?.message?.includes('function') || error?.message?.includes('p_tutor_share')) {
      const fallback = await supabase.rpc('release_escrow_on_completion', {
        p_session_id: id,
        p_actor_id: req.user.id,
      });
      error = fallback.error;
    }

    if (error) {
      throw new AppError(error.message, 400);
    }
  } else {
    await updateSessionStatus(id, 'completed');
  }

  res.json({
    success: true,
    message: 'Session completed and payment released'
  });
});

// ── acceptSession ─────────────────────────────────────────────────────────────
exports.acceptSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const session = await getSessionForActor(id, req.user.id);

  if (session.tutor_id !== req.user.id) {
    throw new AppError('Only the tutor can accept this session', 403);
  }

  if (session.status !== 'pending') {
    throw new AppError('Only pending sessions can be accepted', 409);
  }

  if (parseUtcDate(session.end_time).getTime() + SESSION_EXPIRY_GRACE_MINUTES * 60 * 1000 < Date.now()) {
    await updateSessionStatus(id, 'cancelled');
    throw new AppError('This session has expired and was cancelled automatically', 409);
  }

  await updateSessionStatus(id, 'confirmed');

  await notifyUser({
    userId: session.tutee_id,
    type: 'booking_confirmed',
    title: 'Session accepted',
    message: 'Your tutor accepted your session request.',
    linkUrl: '/dashboard/my-sessions',
    data: { sessionId: id },
  });

  res.json({ success: true, message: 'Session accepted' });
});

// ── declineSession ────────────────────────────────────────────────────────────
exports.declineSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const session = await getSessionForActor(id, req.user.id);

  if (session.tutor_id !== req.user.id) {
    throw new AppError('Only the tutor can decline this session', 403);
  }

  if (session.status !== 'pending') {
    throw new AppError('Only pending sessions can be declined', 409);
  }

  await updateSessionStatus(id, 'declined');

  await notifyUser({
    userId: session.tutee_id,
    type: 'booking_declined',
    title: 'Session declined',
    message: 'Your tutor declined your session request.',
    linkUrl: '/dashboard/my-sessions',
    data: { sessionId: id },
  });

  res.json({ success: true, message: 'Session declined' });
});

// ── getSessionJoinInfo ───────────────────────────────────────────────────────
exports.getSessionJoinInfo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const session = await getSessionForActor(id, req.user.id);

  if (!['confirmed', 'in-progress'].includes(session.status)) {
    throw new AppError('Only accepted sessions can be joined', 409, 'SESSION_NOT_JOINABLE');
  }

  if (!withinJoinWindow(session)) {
    throw new AppError('This session is not currently joinable', 409, 'SESSION_OUTSIDE_JOIN_WINDOW');
  }

  const isTutor = session.tutor_id === req.user.id;
  const joinInfo = signJaasJwt({
    sessionId: id,
    user: req.user,
    moderator: isTutor,
  });

  res.json({
    success: true,
    data: joinInfo,
  });
});

// ── cancelSession ──────────────────────────────────────────────────────────────
exports.cancelSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const session = await getSessionForActor(id, req.user.id);

  if (!['pending', 'confirmed', 'in-progress'].includes(session.status)) {
    throw new AppError('Only active sessions can be cancelled', 409);
  }

  const { data: escrow } = await supabase
    .from('escrow')
    .select('*')
    .eq('session_id', id)
    .maybeSingle();

  if (escrow?.amount_tokens > 0 && escrow.status === 'locked') {
    const { error } = await supabase.rpc('refund_escrow_on_cancellation', {
      p_session_id: id,
      p_actor_id: req.user.id
    });

    if (error) {
      throw new AppError(error.message, 400);
    }
  } else {
    await updateSessionStatus(id, 'cancelled');
  }

  const recipientId = req.user.id === session.tutor_id ? session.tutee_id : session.tutor_id;
  await notifyUser({
    userId: recipientId,
    type: 'session_cancelled',
    title: 'Session cancelled',
    message: 'A booked session was cancelled.',
    linkUrl: req.user.id === session.tutor_id ? '/dashboard/my-sessions' : '/dashboard/sessions',
    data: { sessionId: id },
  });

  res.json({
    success: true,
    message: 'Session cancelled'
  });
});

// ── undoCancellation ───────────────────────────────────────────────────────────
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
