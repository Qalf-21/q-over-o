// backend/controllers/tutorController.js — FULL REPLACEMENT
//
// Fixes:
//   • searchTutors:  formatted response now includes `isAvailable: t.is_available`
//                    + availableNow filter is now actually applied
//   • getTutorById:  response now includes `isAvailable: tutor.is_available`
// All other functions unchanged.

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

  if (error) {
    console.error('[hasCurrentBookableAvailability] Supabase error:', error.message, error.details);
    return false;
  }

  return (slots || []).some(slot => Boolean(withCurrentBookableStart(slot, nowDate)));
};

exports.searchTutors = asyncHandler(async (req, res) => {
  const {
    q,
    subject,
    minRating = 0,
    minPrice,
    maxPrice,
    availableNow = 'false'
  } = req.query;

  let query = supabase
    .from('tutor_profiles')
    .select(`
      *,
      profiles:user_id (first_name, last_name, id),
      subjects:tutor_subjects(subject_id, subjects(id, name, code))
    `)
    .gte('rating_avg', minRating);

  if (minPrice) query = query.gte('hourly_rate_tokens', minPrice);
  if (maxPrice) query = query.lte('hourly_rate_tokens', maxPrice);

  const { data: tutors, error } = await query;
  if (error) throw new AppError('Failed to fetch tutors', 500);

  let results = tutors || [];

  if (q) {
    const searchLower = q.toLowerCase();
    results = results.filter(t =>
      displayName(t.profiles).toLowerCase().includes(searchLower) ||
      t.subjects?.some(s => s.subjects?.name?.toLowerCase().includes(searchLower))
    );
  }

  if (subject) {
    results = results.filter(t =>
      t.subjects?.some(s =>
        s.subjects?.name?.toLowerCase().includes(subject.toLowerCase()) ||
        s.subjects?.code?.toLowerCase() === subject.toLowerCase() ||
        s.subjects?.id === subject
      )
    );
  }

  const hasFilter = Boolean(subject || minPrice || maxPrice || Number(minRating) > 0 || availableNow === 'true');
  results.sort((a, b) => {
    if (subject) return (b.rating_avg || 0) - (a.rating_avg || 0);
    if (minPrice || maxPrice) return (a.hourly_rate_tokens || 0) - (b.hourly_rate_tokens || 0);
    if (Number(minRating) > 0) return (b.rating_avg || 0) - (a.rating_avg || 0);
    return (b.rating_avg || 0) - (a.rating_avg || 0);
  });

  let formatted = await Promise.all(results.map(async t => {
    const qualification = await getTutorQualificationStatus(t.user_id);
    const hasBookableSlots = await hasCurrentBookableAvailability(t.user_id);
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
      isVerified:   t.is_verified,
      isAvailable:  hasBookableSlots,
      qualification,
      rankReason:   hasFilter ? 'filtered' : 'rating',
      subjects:     t.subjects?.map(s => ({
        id:   s.subjects.id,
        name: s.subjects.name,
        code: s.subjects.code
      })) || []
    };
  }));

  if (availableNow === 'true') {
    formatted = formatted.filter(t => t.isAvailable);
  }

  res.json({ success: true, data: formatted });
});

exports.getTutorById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: tutor, error } = await supabase
    .from('tutor_profiles')
    .select(`
      *,
      profiles:user_id (first_name, last_name, id),
      subjects:tutor_subjects(subject_id, subjects(id, name, code))
    `)
    .eq('user_id', id)
    .single();

  if (error || !tutor) throw new AppError('Tutor not found', 404);

  const { data: reviews } = await supabase
    .from('reviews')
    .select('rating, comment, created_at, profiles:reviewer_id(first_name, last_name)')
    .eq('tutor_id', id)
    .eq('reviewee_role', 'tutor')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5);

  const qualification = await getTutorQualificationStatus(id);
  const hasBookableSlots = await hasCurrentBookableAvailability(id);

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
  res.json({
    success: true,
    data: {
      slots: (slots || [])
        .map(slot => withCurrentBookableStart(slot, nowDate))
        .filter(Boolean),
    },
  });
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
    .select(`*, profiles:user_id (first_name, last_name, email)`)
    .eq('user_id', userId)
    .single();

  if (error || !profile) throw new AppError('Tutor profile not found', 404);

  const qualification = await getTutorQualificationStatus(userId);

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

    const { error: deleteError } = await supabase
      .from('tutor_subjects')
      .delete()
      .eq('tutor_id', userId);
    if (deleteError) throw new AppError('Failed to update tutor subjects', 500);

    if (subjects.length) {
      const rows = subjects.map((subjectId) => ({ tutor_id: userId, subject_id: subjectId }));
      const { error: insertError } = await supabase.from('tutor_subjects').insert(rows);
      if (insertError) throw new AppError('Failed to update tutor subjects', 500);
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
    .select('id, name, code, category')
    .order('name');

  if (error) throw new AppError('Failed to fetch subjects', 500);
  res.json({ success: true, data: subjects || [] });
});
