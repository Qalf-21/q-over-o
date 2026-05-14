
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
const { generateMeetingLink } = require('../utils/meetingGenerator');

const displayName = (profile) => [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');

const ceilToNextHour = (date) => {
  const rounded = new Date(date);
  if (
    rounded.getMinutes() === 0 &&
    rounded.getSeconds() === 0 &&
    rounded.getMilliseconds() === 0
  ) {
    return rounded;
  }
  rounded.setHours(rounded.getHours() + 1, 0, 0, 0);
  return rounded;
};

const getCurrentBookableStart = (slotStart, now = new Date()) => {
  const start = new Date(slotStart);
  return start <= now ? ceilToNextHour(now) : start;
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

  const slotStart = getCurrentBookableStart(slot.start_time).toISOString();
  const slotEnd   = slot.end_time;

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

  const meetingLink = generateMeetingLink(session.id);
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
    availability_slot_id,
  } = req.body;

  if (!tutor_id || !start_time || !end_time) {
    throw new AppError('tutor_id, start_time, and end_time are required', 400);
  }

  const requestedSubjectId = subject_id && subject_id !== '' ? subject_id : null;

  const requestedStart = new Date(start_time);
  const requestedEnd = new Date(end_time);
  const now = new Date();

  if (
    Number.isNaN(requestedStart.getTime()) ||
    Number.isNaN(requestedEnd.getTime()) ||
    requestedEnd <= requestedStart
  ) {
    throw new AppError('Session end time must be after start time', 400);
  }

  if (requestedStart <= now) {
    throw new AppError('Cannot book a time slot that has already started', 400);
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

    const slotEnd = new Date(slot.end_time);
    const bookableStart = getCurrentBookableStart(slot.start_time, now);

    if (slotEnd <= now || bookableStart >= slotEnd) {
      throw new AppError('Availability slot is no longer available', 409);
    }

    if (requestedStart < bookableStart || requestedEnd > slotEnd) {
      throw new AppError('Requested session is outside the available time slot', 409);
    }
  }

  const { data: overlappingSession, error: overlapError } = await supabase
    .from('sessions')
    .select('id')
    .eq('tutor_id', tutor_id)
    .in('status', ['pending', 'confirmed'])
    .lt('start_time', requestedEnd.toISOString())
    .gt('end_time', requestedStart.toISOString())
    .limit(1)
    .maybeSingle();

  if (overlapError) {
    console.error('[bookSession] overlap validation failed:', JSON.stringify(overlapError));
    throw new AppError('Failed to validate tutor availability', 500);
  }

  if (overlappingSession) {
    throw new AppError('This time slot has already been booked', 409, 'SLOT_ALREADY_BOOKED');
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
  let sessionId;

  if (qualification.qualified) {
    // ── Atomic booking (escrow + session insert) ───────────────────────────────
    const { data, error } = await supabase.rpc('book_session_atomic', {
      p_tutee_id: req.user.id,
      p_tutor_id: tutor_id,
      p_subject_id: resolvedSubjectId,
      p_start: start_time,
      p_end: end_time,
    });

    if (error) {
      throw new AppError(error.message, 400);
    }
    sessionId = data;
  } else {
    sessionId = await createFreeSession({
      tuteeId: req.user.id,
      tutorId: tutor_id,
      subjectId: resolvedSubjectId,
      startTime: start_time,
      endTime: end_time,
    });
  }

  // ── Trim the availability slot (best-effort, non-blocking) ───────────────────
  // We do this after the booking succeeds so a slot-trim failure doesn't
  // roll back a successful booking.
  try {
    await trimAvailabilitySlot(tutor_id, availability_slot_id, start_time, end_time);
  } catch (trimErr) {
    // Log but don't fail the request
    console.error('[bookSession] slot trim failed:', trimErr?.message ?? trimErr);
  }

  res.status(201).json({
    success: true,
    session_id: sessionId,
    data: {
      sessionId,
      paymentLocked: !qualification.qualified,
      tokenAmount: qualification.qualified ? undefined : 0,
      qualification,
    },
  });
});

// ── getSessions ────────────────────────────────────────────────────────────────
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

// ── completeSession ────────────────────────────────────────────────────────────
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

// ── cancelSession ──────────────────────────────────────────────────────────────
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
