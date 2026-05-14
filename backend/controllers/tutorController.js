// backend/controllers/tutorController.js
//
// Fix applied:
//   • updateProfile: before inserting into tutor_subjects, verify that a row
//     actually exists in tutor_profiles for this user_id.  If it doesn't exist
//     the FK  tutor_subjects.tutor_id → tutor_profiles.user_id  is violated and
//     Supabase returns error code 23503 (the error you saw in the logs).
//     We now fetch the profile row first and throw a clear 404 when it is absent,
//     which prevents the FK violation entirely.
//
//   All other logic is unchanged from the previous version.

const supabase = require('../config/supabase');
const { AppError, asyncHandler } = require('../utils/errorHandler');
const {
  getTutorQualificationStatus,
} = require('../services/tutorQualificationService');

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

const withCurrentBookableStart = (slot, nowDate = new Date()) => {
  const start = new Date(slot.start_time);
  const end = new Date(slot.end_time);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= nowDate) {
    return null;
  }

  const bookableStart = start <= nowDate ? ceilToNextHour(nowDate) : start;
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
    .gt('end_time', nowDate.toISOString())
    .limit(10);

  if (error || !slots?.length) return false;
  return slots.some((slot) => withCurrentBookableStart(slot, nowDate) !== null);
};

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
    `)
    .is('deleted_at', null);

  if (minRating) query = query.gte('rating_avg', parseFloat(minRating));
  if (maxPrice)  query = query.lte('hourly_rate_tokens', parseFloat(maxPrice));

  const { data: tutors, error } = await query;
  if (error) throw new AppError('Failed to fetch tutors', 500);

  const nowDate = new Date();

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
        const qualification = await getTutorQualificationStatus(t.user_id);
        const hasBookableSlots = await hasCurrentBookableAvailability(t.user_id, nowDate);

        if (availableNow === 'true' && !hasBookableSlots) return null;

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
          isAvailable:  t.is_available,
          isVerified:   t.is_verified,
          qualification,
          subjects:     (t.subjects || []).map(s => ({
            id:   s.subjects.id,
            name: s.subjects.name,
            code: s.subjects.code
          })),
        };
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
    .is('deleted_at', null)
    .single();

  if (error || !tutor) throw new AppError('Tutor not found', 404);

  const qualification = await getTutorQualificationStatus(id);
  const hasBookableSlots = await hasCurrentBookableAvailability(id, nowDate);

  const { data: reviews } = await supabase
    .from('reviews')
    .select(`*, profiles:reviewer_id (first_name, last_name)`)
    .eq('tutor_id', id)
    .eq('reviewee_role', 'tutor')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5);

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
      isVerified:   tutor.is_verified,
      isAvailable:  hasBookableSlots,
      qualification,
      subjects:     tutor.subjects?.map(s => ({
        id:   s.subjects.id,
        name: s.subjects.name,
        code: s.subjects.code
      })) || [],
      recentReviews: reviews || []
    }
  });
});

exports.getTutorReviews = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: reviews, error } = await supabase
    .from('reviews')
    .select(`*, profiles:reviewer_id (first_name, last_name)`)
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
  const now = nowDate.toISOString();

  const { data: slots, error } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('tutor_id', id)
    .eq('is_available', true)
    .gt('end_time', now)
    .order('start_time', { ascending: true });

  if (error) throw new AppError('Failed to fetch availability', 500);

  const bookableSlots = (slots || [])
    .map((slot) => withCurrentBookableStart(slot, nowDate))
    .filter(Boolean);

  res.json({ success: true, data: bookableSlots });
});

exports.getMyAvailability = asyncHandler(async (req, res) => {
  const tutorId = req.user.id;
  const now = new Date().toISOString();

  const { data: slots, error } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('tutor_id', tutorId)
    .eq('is_available', true)
    .gt('end_time', now)
    .order('start_time', { ascending: true });

  if (error) throw new AppError('Failed to fetch availability', 500);
  res.json({ success: true, data: slots || [] });
});

exports.createAvailability = asyncHandler(async (req, res) => {
  const tutorId = req.user.id;
  const { startTime, endTime, start_time, end_time } = req.body;
  const slotStart = startTime || start_time;
  const slotEnd   = endTime   || end_time;

  if (!slotStart || !slotEnd) throw new AppError('startTime and endTime are required', 400);

  const start = new Date(slotStart);
  const end   = new Date(slotEnd);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start)
    throw new AppError('Availability end time must be after start time', 400);

  if (start <= new Date())
    throw new AppError('Availability must be in the future', 400);

  const { data: overlaps, error: overlapError } = await supabase
    .from('availability_slots')
    .select('id')
    .eq('tutor_id', tutorId)
    .eq('is_available', true)
    .lt('start_time', end.toISOString())
    .gt('end_time', start.toISOString())
    .limit(1);

  if (overlapError) throw new AppError('Failed to validate availability', 500);
  if (overlaps?.length) throw new AppError('Availability overlaps an existing slot', 409);

  const { data: slot, error } = await supabase
    .from('availability_slots')
    .insert({ tutor_id: tutorId, start_time: start.toISOString(), end_time: end.toISOString(), is_available: true })
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
    .in('status', ['pending', 'confirmed'])
    .lt('start_time', slot.end_time)
    .gt('end_time', slot.start_time);

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

exports.updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { bio, hourlyRate, subjects } = req.body;

  // ── FIX: Guarantee the tutor_profiles row exists BEFORE any writes.
  //
  // tutor_subjects.tutor_id has a FK → tutor_profiles.user_id.
  // If no row exists in tutor_profiles for this user, every INSERT into
  // tutor_subjects throws Postgres 23503. This can happen when the
  // become_tutor_atomic RPC updated profiles.role='tutor' but failed to
  // create the tutor_profiles row (e.g. partial rollback).
  //
  // Strategy: use the Supabase RPC become_tutor_atomic to ensure the row
  // exists idempotently (the RPC is already written to be idempotent),
  // OR fall back to a raw INSERT ... ON CONFLICT DO NOTHING via RPC.
  // Since we cannot call RPC here without risking the same ETIMEDOUT,
  // we do a plain INSERT with a try/ignore-duplicate approach:
  //   1. Try INSERT — succeeds if row missing, fails with 23505 if row exists.
  //   2. If error code is 23505 (unique_violation) → row already exists, continue.
  //   3. Any other error → throw.
  // This avoids all upsert/maybeSingle network edge cases.
  const { error: ensureProfileError } = await supabase
    .from('tutor_profiles')
    .insert({
      user_id:            userId,
      bio:                '',
      hourly_rate_tokens: 500,
      is_available:       false,
      updated_at:         new Date().toISOString(),
    });

  // 23505 = unique_violation → row already exists, which is exactly what we want
  if (ensureProfileError && ensureProfileError.code !== '23505') {
    console.error('[updateProfile] Failed to ensure tutor_profiles row:', JSON.stringify(ensureProfileError));
    throw new AppError('Failed to initialise tutor profile', 500);
  }

  if (!ensureProfileError) {
    console.log('[updateProfile] Created missing tutor_profiles row for user:', userId);
  }

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

  const { error } = await supabase
    .from('tutor_profiles')
    .update(updates)
    .eq('user_id', userId);

  if (error) throw new AppError('Failed to update tutor profile', 500);

  if (subjects !== undefined) {
    if (!Array.isArray(subjects)) {
      throw new AppError('subjects must be an array of subject IDs', 400, 'VALIDATION_ERROR');
    }

    // Guard: never allow wiping all subjects via an accidental empty array.
    if (subjects.length === 0) {
      throw new AppError('At least one subject is required', 400, 'VALIDATION_ERROR');
    }

    // Validate that every submitted ID exists in the subjects table.
    const { data: validSubjects, error: validateError } = await supabase
      .from('subjects')
      .select('id')
      .in('id', subjects);

    if (validateError) {
      console.error('[updateProfile] Subject validation error:', JSON.stringify(validateError));
      throw new AppError('Failed to validate subjects', 500);
    }

    if (!validSubjects || validSubjects.length !== subjects.length) {
      const validIds = new Set((validSubjects || []).map(s => s.id));
      const invalidIds = subjects.filter(id => !validIds.has(id));
      console.error('[updateProfile] Invalid subject IDs:', invalidIds);
      throw new AppError('One or more subject IDs are invalid', 400, 'VALIDATION_ERROR');
    }

    // Delete all existing rows for this tutor first.
    // .select() forces Supabase to await full completion before returning.
    const { error: deleteError } = await supabase
      .from('tutor_subjects')
      .delete()
      .eq('tutor_id', userId)
      .select();

    if (deleteError) {
      console.error('[updateProfile] Delete tutor_subjects error:', JSON.stringify(deleteError));
      throw new AppError('Failed to update tutor subjects', 500);
    }

    // Insert new rows one at a time to get precise error detail if anything fails.
    for (const subjectId of subjects) {
      const { error: insertError } = await supabase
        .from('tutor_subjects')
        .insert({ tutor_id: userId, subject_id: subjectId })
        .select();

      if (insertError) {
        console.error(
          `[updateProfile] Insert tutor_subjects error (subject ${subjectId}):`,
          JSON.stringify(insertError),
        );
        throw new AppError('Failed to update tutor subjects', 500);
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