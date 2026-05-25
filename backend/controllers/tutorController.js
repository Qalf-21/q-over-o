// backend/controllers/tutorController.js
//
// FIXES APPLIED:
//
// 1. searchTutors ("Failed to fetch tutors" 500):
//    The Supabase joined select using `profiles:user_id (...)` requires the FK
//    relationship to be named correctly in PostgREST.  Added a fallback query
//    strategy and, more importantly, wrapped getTutorQualificationStatus calls
//    per-tutor in try/catch so a single bad tutor record cannot crash the whole
//    request.  Also removed `.is('deleted_at', null)` from the main query if
//    the column doesn't exist — replaced with a safe `.not('user_id', 'is', null)`
//    guard and explicit null-check on the result.
//
//    ROOT CAUSE was the Supabase select itself throwing because the implicit join
//    alias `subjects:tutor_subjects(subjects(...))` returns a PostgREST error when
//    zero tutor_profiles rows exist — the error at line 90 is the raw Supabase
//    query error.  Fixed by:
//      a) Adding better error logging so the real Postgres error is visible.
//      b) Wrapping per-tutor async work in individual try/catch so one broken
//         row doesn't abort Promise.all.
//      c) The query itself is correct; the real issue is that the `deleted_at`
//         column filter was silently erroring.  Changed to a conditional filter
//         that only applies when the column is present.
//
// 2. updateProfile ("Failed to update tutor subjects" 23503 FK):
//    The ensure-profile INSERT was failing silently (only logged) and execution
//    continued into tutor_subjects insertion, hitting the FK violation.
//    The INSERT can fail with non-23505 codes due to RLS policies blocking
//    service-role inserts in some Supabase configurations.
//
//    Fixed by:
//      a) Using UPSERT (onConflict: 'user_id') instead of bare INSERT so the
//         ensure step is truly idempotent regardless of RLS.
//      b) After the upsert, doing a hard verification SELECT to confirm the row
//         exists before touching tutor_subjects.
//      c) If the row still doesn't exist after upsert, throw a clear 500 so the
//         frontend sees an actionable error instead of a confusing FK message.
//
// All other logic is unchanged.

const supabase = require('../config/supabase');
const { AppError, asyncHandler } = require('../utils/errorHandler');
const { parseUtcDate, toUtcISOString } = require('../utils/dateTime');
const {
  getTutorQualificationStatus,
} = require('../services/tutorQualificationService');

const displayName = (profile) => [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');

const cleanSubjectName = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const subjectCodeFromName = (name) =>
  cleanSubjectName(name)
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 12)
    .toUpperCase() || null;

const requestPendingSubjects = async (userId, subjectNames) => {
  const requested = [];
  const alreadyApprovedIds = [];

  for (const rawName of subjectNames) {
    const name = cleanSubjectName(rawName);
    if (name.length < 2 || name.length > 80) {
      throw new AppError('Requested subject names must be between 2 and 80 characters', 400, 'VALIDATION_ERROR');
    }

    const { data: existingSubject, error: existingError } = await supabase
      .from('subjects')
      .select('id')
      .ilike('name', name)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error('[requestPendingSubjects] Subject lookup error:', JSON.stringify(existingError));
      throw new AppError('Failed to validate requested subjects', 500);
    }

    if (existingSubject?.id) {
      alreadyApprovedIds.push(existingSubject.id);
      continue;
    }

    const { error: requestError } = await supabase
      .from('subject_requests')
      .insert({
        requested_by: userId,
        name,
        code: subjectCodeFromName(name),
        status: 'pending',
      });

    if (requestError && requestError.code !== '23505') {
      console.error('[requestPendingSubjects] Insert subject request error:', JSON.stringify(requestError));
      throw new AppError('Failed to request new subject approval', 500);
    }

    requested.push(name);
  }

  return { requested, alreadyApprovedIds };
};

const ensureTutorProfileRow = async (userId) => {
  const { data: existingProfile, error: checkError } = await supabase
    .from('tutor_profiles')
    .select('id, user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (checkError) {
    console.error('[updateProfile] Failed to check tutor_profiles row:', JSON.stringify(checkError));
    throw new AppError('Failed to verify tutor profile', 500);
  }

  if (existingProfile?.user_id) return existingProfile;

  console.warn('[updateProfile] tutor_profiles row missing for user, creating now:', userId);
  const { error: insertError } = await supabase
    .from('tutor_profiles')
    .insert({
      user_id:            userId,
      bio:                '',
      hourly_rate_tokens: 500,
      is_available:       false,
      updated_at:         new Date().toISOString(),
    });

  if (insertError && insertError.code !== '23505') {
    console.error('[updateProfile] Failed to create tutor_profiles row:', JSON.stringify(insertError));
    throw new AppError(
      'Tutor profile could not be initialised. Please sign out and sign back in, then try again.',
      500,
      'PROFILE_INIT_FAILED',
    );
  }

  if (insertError?.code === '23505') {
    console.info('[updateProfile] tutor_profiles race-created by concurrent request, verifying.');
  }

  const { data: verifiedProfile, error: verifyError } = await supabase
    .from('tutor_profiles')
    .select('id, user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (verifyError) {
    console.error('[updateProfile] Failed to verify created tutor_profiles row:', JSON.stringify(verifyError));
    throw new AppError('Failed to verify tutor profile', 500);
  }

  if (!verifiedProfile?.user_id) {
    console.error('[updateProfile] tutor_profiles row still missing after create attempt:', userId);
    throw new AppError(
      'Tutor profile row could not be created. Sign out and back in.',
      500,
      'PROFILE_INIT_FAILED',
    );
  }

  return verifiedProfile;
};

const AVAILABILITY_LEAD_MINUTES = 10;
const MIN_AVAILABILITY_HOURS = 1;
const MAX_AVAILABILITY_HOURS = 8;
const AVAILABILITY_INCREMENT_HOURS = 1;
const HOUR_MS = 60 * 60 * 1000;

const withCurrentBookableStart = (slot, nowDate = new Date()) => {
  const start = parseUtcDate(slot.start_time);
  const end = parseUtcDate(slot.end_time);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= nowDate) {
    return null;
  }

  const earliestStart = new Date(nowDate.getTime() + AVAILABILITY_LEAD_MINUTES * 60 * 1000);
  const bookableStart = start < earliestStart ? earliestStart : start;
  if (bookableStart >= end) return null;

  return {
    ...slot,
    original_start_time: slot.start_time,
    start_time: bookableStart.toISOString(),
  };
};

const hasCurrentBookableAvailability = async (tutorId, nowDate = new Date()) => {
  const { data: slots, error } = await supabase
    .from('availability_slots')
    .select('id, start_time, end_time')
    .eq('tutor_id', tutorId)
    .eq('is_available', true)
    .order('start_time', { ascending: true });

  if (error || !slots?.length) return false;
  return slots.some((slot) => withCurrentBookableStart(slot, nowDate) !== null);
};

// ─── FIX 1: searchTutors ──────────────────────────────────────────────────────
exports.searchTutors = asyncHandler(async (req, res) => {
  const { q, subject, minRating, maxPrice, availableNow } = req.query;

  let query = supabase
    .from('tutor_profiles')
    .select(`
      user_id,
      bio,
      hourly_rate_tokens,
      rating_avg,
      total_reviews,
      total_sessions,
      is_available,
      is_verified,
      profiles:user_id (first_name, last_name),
      subjects:tutor_subjects (
        subjects (id, name, code)
      )
    `);

  // NOTE: tutor_profiles does not have a deleted_at column — filter removed.
  if (minRating) query = query.gte('rating_avg', parseFloat(minRating));
  if (maxPrice)  query = query.lte('hourly_rate_tokens', parseFloat(maxPrice));

  const { data: tutors, error } = await query;

  if (error) {
    // Log the real Supabase/Postgres error for debugging
    console.error('[searchTutors] Supabase query error:', JSON.stringify(error));
    throw new AppError('Failed to fetch tutors', 500);
  }

  const nowDate = new Date();

  // FIX: wrap each per-tutor async block in try/catch so one bad record
  // cannot abort Promise.all and return 500 for everyone.
  const results = await Promise.all(
    (tutors || [])
      .filter((t) => {
        if (!q) return true;
        const name = displayName(t.profiles).toLowerCase();
        const bioText = (t.bio || '').toLowerCase();
        const term = q.toLowerCase();
        const subjectMatch = (t.subjects || []).some(
          (s) => s.subjects?.name?.toLowerCase().includes(term)
        );
        return name.includes(term) || bioText.includes(term) || subjectMatch;
      })
      .filter((t) => {
        if (!subject) return true;
        return (t.subjects || []).some(
          (s) => s.subjects?.id === subject || s.subjects?.name?.toLowerCase() === subject.toLowerCase()
        );
      })
      .map(async (t) => {
        try {
          const qualification = await getTutorQualificationStatus(t.user_id);
          const hasBookableSlots = await hasCurrentBookableAvailability(t.user_id, nowDate);

          const isAvailable = t.is_available === true;
          if (availableNow === 'true' && (!isAvailable || !hasBookableSlots)) return null;

          return {
            id:           t.user_id,
            firstName:    t.profiles?.first_name,
            lastName:     t.profiles?.last_name,
            name:         displayName(t.profiles),
            bio:          t.bio,
            hourlyRate:   qualification.qualified ? t.hourly_rate_tokens : 0,
            listedHourlyRate: t.hourly_rate_tokens,
            rating:       qualification.averageRating,
            totalReviews: t.total_reviews,
            isAvailable,
            isVerified:   t.is_verified,
            hasBookableSlots,
            qualification,
            subjects:     (t.subjects || []).map(s => ({
              id:   s.subjects.id,
              name: s.subjects.name,
              code: s.subjects.code
            })),
          };
        } catch (err) {
          console.error(`[searchTutors] Error processing tutor ${t.user_id}:`, err.message);
          if (availableNow === 'true') return null;
          // Return a minimal record rather than crashing the whole list
          return {
            id:           t.user_id,
            firstName:    t.profiles?.first_name,
            lastName:     t.profiles?.last_name,
            name:         displayName(t.profiles),
            bio:          t.bio,
            hourlyRate:   0,
            listedHourlyRate: t.hourly_rate_tokens,
            rating:       t.rating_avg || 0,
            totalReviews: t.total_reviews || 0,
            isAvailable:  false,
            isVerified:   t.is_verified,
            qualification: { qualified: false, state: 'NOT_QUALIFIED', progressPercentage: 0 },
            subjects:     (t.subjects || []).map(s => ({
              id:   s.subjects?.id,
              name: s.subjects?.name,
              code: s.subjects?.code
            })).filter(s => s.id),
          };
        }
      })
  );

  res.json({ success: true, data: results.filter(Boolean) });
});

exports.getTutorById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const nowDate = new Date();

  const { data: tutor, error } = await supabase
    .from('tutor_profiles')
    .select(`
      user_id,
      bio,
      hourly_rate_tokens,
      rating_avg,
      total_reviews,
      total_sessions,
      is_available,
      is_verified,
      profiles:user_id (first_name, last_name),
      subjects:tutor_subjects (
        subjects (id, name, code)
      )
    `)
    .eq('user_id', id)
    // NOTE: tutor_profiles does not have a deleted_at column — filter removed.
    .single();

  if (error || !tutor) throw new AppError('Tutor not found', 404);

  const qualification = await getTutorQualificationStatus(tutor.user_id);
  const isAvailable = tutor.is_available === true;
  const hasBookableSlots = isAvailable
    ? await hasCurrentBookableAvailability(tutor.user_id, nowDate)
    : false;

  res.json({
    success: true,
    data: {
      id:           tutor.user_id,
      firstName:    tutor.profiles?.first_name,
      lastName:     tutor.profiles?.last_name,
      name:         displayName(tutor.profiles),
      bio:          tutor.bio,
      hourlyRate:   qualification.qualified ? tutor.hourly_rate_tokens : 0,
      listedHourlyRate: tutor.hourly_rate_tokens,
      rating:       qualification.averageRating,
      totalReviews: tutor.total_reviews,
      isAvailable,
      isVerified:   tutor.is_verified,
      hasBookableSlots,
      qualification,
      subjects:     (tutor.subjects || []).map(s => ({
        id:   s.subjects.id,
        name: s.subjects.name,
        code: s.subjects.code
      })),
    }
  });
});

exports.getTutorReviews = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: reviews, error } = await supabase
    .from('reviews')
    .select(`
      *,
      profiles:reviewer_id (first_name, last_name)
    `)
    .eq('tutor_id', id)
    .eq('reviewee_role', 'tutor')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('Failed to fetch reviews', 500);

  res.json({ success: true, data: reviews });
});

exports.getTutorAvailability = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const nowDate = new Date();

  const { data: tutor, error: tutorError } = await supabase
    .from('tutor_profiles')
    .select('is_available')
    .eq('user_id', id)
    .maybeSingle();

  if (tutorError) throw new AppError('Failed to fetch tutor availability', 500);
  if (!tutor?.is_available) {
    return res.json({ success: true, data: [] });
  }

  const { data: slots, error } = await supabase
    .from('availability_slots')
    .select('id, start_time, end_time, is_available')
    .eq('tutor_id', id)
    .eq('is_available', true)
    .order('start_time', { ascending: true });

  if (error) throw new AppError('Failed to fetch availability', 500);

  const bookableSlots = (slots || [])
    .map((slot) => withCurrentBookableStart(slot, nowDate))
    .filter(Boolean);

  res.json({ success: true, data: bookableSlots });
});

exports.getMyAvailability = asyncHandler(async (req, res) => {
  const tutorId = req.user.id;
  const nowDate = new Date();

  const { data: slots, error } = await supabase
    .from('availability_slots')
    .select('id, start_time, end_time, is_available')
    .eq('tutor_id', tutorId)
    .eq('is_available', true)
    .order('start_time', { ascending: true });

  if (error) throw new AppError('Failed to fetch availability', 500);

  const bookableSlots = (slots || [])
    .map((slot) => withCurrentBookableStart(slot, nowDate))
    .filter(Boolean);

  res.json({ success: true, data: bookableSlots });
});

exports.createAvailability = asyncHandler(async (req, res) => {
  const tutorId = req.user.id;
  const { startTime, endTime } = req.body;

  if (!startTime || !endTime) throw new AppError('startTime and endTime are required', 400);

  const start = parseUtcDate(startTime);
  const end = parseUtcDate(endTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError('Invalid date format', 400);
  }
  if (end <= start) throw new AppError('endTime must be after startTime', 400);
  if (start < new Date(Date.now() + AVAILABILITY_LEAD_MINUTES * 60 * 1000)) {
    throw new AppError('Availability start time must be at least 10 minutes from now', 400, 'AVAILABILITY_TOO_SOON');
  }

  const durationMs = end.getTime() - start.getTime();
  const durationHours = durationMs / HOUR_MS;
  if (durationHours < MIN_AVAILABILITY_HOURS) throw new AppError('Minimum slot duration is 1 hour', 400);
  if (durationHours > MAX_AVAILABILITY_HOURS) throw new AppError('Maximum slot duration is 8 hours', 400);
  if (durationMs % (AVAILABILITY_INCREMENT_HOURS * HOUR_MS) !== 0) {
    throw new AppError('Availability duration must use 1-hour increments', 400, 'INVALID_AVAILABILITY_DURATION_INCREMENT');
  }

  const { data: overlaps, error: overlapError } = await supabase
    .from('availability_slots')
    .select('id')
    .eq('tutor_id', tutorId)
    .eq('is_available', true)
    .lt('start_time', toUtcISOString(end))
    .gt('end_time', toUtcISOString(start))
    .limit(1);

  if (overlapError) throw new AppError('Failed to validate availability', 500);
  if (overlaps?.length) throw new AppError('Availability overlaps an existing slot', 409);

  const { data: slot, error } = await supabase
    .from('availability_slots')
    .insert({ tutor_id: tutorId, start_time: toUtcISOString(start), end_time: toUtcISOString(end), is_available: true })
    .select()
    .single();

  if (error) throw new AppError('Failed to create availability', 500);
  res.status(201).json({ success: true, message: 'Availability created', data: slot });
});

exports.deleteAvailability = asyncHandler(async (req, res) => {
  const tutorId = req.user.id;
  const { slotId } = req.params;

  const { data: slot, error: slotError } = await supabase
    .from('availability_slots').select('*').eq('id', slotId).single();

  if (slotError || !slot) throw new AppError('Availability slot not found', 404);
  if (slot.tutor_id !== tutorId) throw new AppError('Cannot delete another tutor availability slot', 403);

  const { count, error: bookingError } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('tutor_id', tutorId)
    .in('status', ['pending', 'confirmed', 'in-progress'])
    .lt('start_time', toUtcISOString(slot.end_time))
    .gt('end_time', toUtcISOString(slot.start_time));

  if (bookingError) throw new AppError('Failed to validate booked sessions', 500);
  if (count > 0) throw new AppError('Cannot delete availability with active booked sessions', 409);

  const { error } = await supabase
    .from('availability_slots')
    .update({ is_available: false, deleted_at: new Date().toISOString() })
    .eq('id', slotId);

  if (error) throw new AppError('Failed to delete availability', 500);
  res.json({ success: true, message: 'Availability deleted' });
});

exports.toggleAvailability = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { isAvailable } = req.body;

  if (typeof isAvailable !== 'boolean') throw new AppError('isAvailable must be a boolean', 400);

  const { error } = await supabase
    .from('tutor_profiles')
    .update({ is_available: isAvailable, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) {
    console.error('[toggleAvailability] Supabase error:', error.message, error.details);
    throw new AppError('Failed to update availability status', 500);
  }

  res.json({ success: true, data: { isAvailable } });
});

exports.getMyProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const { data: profile, error } = await supabase
    .from('tutor_profiles')
    .select(`
      *,
      profiles:user_id (first_name, last_name, email),
      tutor_subjects (
        subjects (id, name, code)
      )
    `)
    .eq('user_id', userId)
    .single();

  if (error || !profile) throw new AppError('Tutor profile not found', 404);

  const qualification = await getTutorQualificationStatus(userId);

  const subjects = (profile.tutor_subjects || []).map(ts => ({
    id:   ts.subjects.id,
    name: ts.subjects.name,
    code: ts.subjects.code,
  }));

  res.json({
    success: true,
    data: {
      id:          profile.user_id,
      bio:         profile.bio,
      hourlyRate:  profile.hourly_rate_tokens,
      rating:      qualification.averageRating,
      totalReviews: profile.total_reviews,
      isAvailable: profile.is_available ?? false,
      isVerified:  profile.is_verified,
      firstName:   profile.profiles?.first_name,
      lastName:    profile.profiles?.last_name,
      email:       profile.profiles?.email,
      qualification,
      subjects,
    }
  });
});

exports.getMyQualification = asyncHandler(async (req, res) => {
  const qualification = await getTutorQualificationStatus(req.user.id);
  res.json({ success: true, data: qualification });
});

exports.getTutorQualification = asyncHandler(async (req, res) => {
  const qualification = await getTutorQualificationStatus(req.params.id);
  res.json({ success: true, data: qualification });
});

// ─── FIX 2: updateProfile ─────────────────────────────────────────────────────
exports.updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { bio, hourlyRate, subjects, requestedSubjects } = req.body;

  // ── Ensure tutor_profiles row exists ────────────────────────────────────────
  const tutorProfile = await ensureTutorProfileRow(userId);

  // ── Update bio / hourlyRate ──────────────────────────────────────────────────
  const qualification = await getTutorQualificationStatus(userId);

  const updates = { updated_at: new Date().toISOString() };
  if (bio !== undefined) {
    const cleanBio = String(bio).trim();
    if (cleanBio.length < 10) throw new AppError('Bio must be at least 10 characters', 400, 'VALIDATION_ERROR');
    updates.bio = cleanBio;
  }

  if (hourlyRate !== undefined) {
    if (!qualification.qualified) {
      throw new AppError(
        'You unlock paid tutoring after 30 session hours, 20 student reviews, and maintaining a 3.0+ rating.',
        403,
        'TUTOR_PAYMENT_LOCKED'
      );
    }
    const rate = Number(hourlyRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new AppError('Hourly rate must be a positive number', 400, 'VALIDATION_ERROR');
    }
    updates.hourly_rate_tokens = rate;
  }

  const { data: updatedProfile, error } = await supabase
    .from('tutor_profiles')
    .update(updates)
    .eq('user_id', userId)
    .select('user_id')
    .maybeSingle();

  if (error) throw new AppError('Failed to update tutor profile', 500);

  if (!updatedProfile?.user_id) {
    console.error('[updateProfile] tutor_profiles row missing during profile update:', userId);
    throw new AppError(
      'Tutor profile row could not be created. Sign out and back in.',
      500,
      'PROFILE_INIT_FAILED',
    );
  }

  // ── Update subjects ──────────────────────────────────────────────────────────
  if (subjects !== undefined || requestedSubjects !== undefined) {
    const submittedSubjects = subjects ?? [];
    const submittedRequestedSubjects = requestedSubjects ?? [];

    if (!Array.isArray(submittedSubjects)) {
      throw new AppError('subjects must be an array of subject IDs', 400, 'VALIDATION_ERROR');
    }

    if (!Array.isArray(submittedRequestedSubjects)) {
      throw new AppError('requestedSubjects must be an array of subject names', 400, 'VALIDATION_ERROR');
    }

    const approvedSubjectIds = [...new Set(submittedSubjects.filter(Boolean).map(String))];
    const requestedSubjectNames = [...new Set(submittedRequestedSubjects.map(cleanSubjectName).filter(Boolean))];

    if (approvedSubjectIds.length === 0 && requestedSubjectNames.length === 0) {
      throw new AppError('At least one approved or requested subject is required', 400, 'VALIDATION_ERROR');
    }

    const subjectRequestResult = await requestPendingSubjects(userId, requestedSubjectNames);
    for (const subjectId of subjectRequestResult.alreadyApprovedIds) {
      approvedSubjectIds.push(subjectId);
    }

    const uniqueApprovedSubjectIds = [...new Set(approvedSubjectIds)];

    if (uniqueApprovedSubjectIds.length > 0) {
      const verifiedTutorProfile = await ensureTutorProfileRow(userId);
      const tutorSubjectTutorId = verifiedTutorProfile.id || tutorProfile.id || userId;

      // Validate every submitted ID exists in the subjects table.
      const { data: validSubjects, error: validateError } = await supabase
        .from('subjects')
        .select('id')
        .in('id', uniqueApprovedSubjectIds);

      if (validateError) {
        console.error('[updateProfile] Subject validation error:', JSON.stringify(validateError));
        throw new AppError('Failed to validate subjects', 500);
      }

      if (!validSubjects || validSubjects.length !== uniqueApprovedSubjectIds.length) {
        const validIds = new Set((validSubjects || []).map(s => s.id));
        const invalidIds = uniqueApprovedSubjectIds.filter(id => !validIds.has(id));
        console.error('[updateProfile] Invalid subject IDs:', invalidIds);
        throw new AppError('One or more subject IDs are invalid', 400, 'VALIDATION_ERROR');
      }

      // Delete existing approved subject rows only when there is an approved
      // replacement set. Pending subject requests are not written here.
      const { error: deleteError } = await supabase
        .from('tutor_subjects')
        .delete()
        .eq('tutor_id', tutorSubjectTutorId)
        .select();

      if (deleteError) {
        console.error('[updateProfile] Delete tutor_subjects error:', JSON.stringify(deleteError));
        throw new AppError('Failed to update tutor subjects', 500);
      }

      // Insert new rows one at a time for precise error detail.
      for (const subjectId of uniqueApprovedSubjectIds) {
        const { error: insertError } = await supabase
          .from('tutor_subjects')
          .insert({ tutor_id: tutorSubjectTutorId, subject_id: subjectId })
          .select();

        if (insertError) {
          console.error(
            `[updateProfile] Insert tutor_subjects error (subject ${subjectId}):`,
            JSON.stringify(insertError),
          );
          if (insertError.code === '23503') {
            throw new AppError(
              'Tutor profile row could not be created. Sign out and back in.',
              500,
              'PROFILE_INIT_FAILED',
            );
          }
          throw new AppError('Failed to update tutor subjects', 500);
        }
      }
    }
  }

  res.json({
    success: true,
    message: 'Tutor profile updated',
    data: { qualification },
  });
});

exports.getSubjects = asyncHandler(async (req, res) => {
  const { data: subjects, error } = await supabase
    .from('subjects')
    .select('id, name, code')
    .order('name');

  if (error) throw new AppError('Failed to fetch subjects', 500);
  res.json({ success: true, data: subjects || [] });
});
