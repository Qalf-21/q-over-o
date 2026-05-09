const supabase = require('../config/supabase');
const { AppError, asyncHandler } = require('../utils/errorHandler');

const displayName = (profile) => [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');

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

  if (minPrice) {
    query = query.gte('hourly_rate_tokens', minPrice);
  }

  if (maxPrice) {
    query = query.lte('hourly_rate_tokens', maxPrice);
  }

  const { data: tutors, error } = await query;

  if (error) throw new AppError('Failed to fetch tutors', 500);

  // Filter by search query
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

  // Format response
  const formatted = results.map(t => ({
    id: t.user_id,
    firstName: t.profiles?.first_name,
    lastName: t.profiles?.last_name,
    name: displayName(t.profiles),
    bio: t.bio,
    hourlyRate: t.hourly_rate_tokens,
    rating: t.rating_avg,
    totalReviews: t.total_reviews,
    isVerified: t.is_verified,
    rankReason: hasFilter ? 'filtered' : 'rating',
    subjects: t.subjects?.map(s => ({
      id: s.subjects.id,
      name: s.subjects.name,
      code: s.subjects.code
    })) || []
  }));

  res.json({
    success: true,
    data: formatted
  });
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

  if (error || !tutor) {
    throw new AppError('Tutor not found', 404);
  }

  // Get reviews
  const { data: reviews } = await supabase
    .from('reviews')
    .select('rating, comment, created_at, profiles:reviewer_id(first_name, last_name)')
    .eq('tutor_id', id)
    .eq('reviewee_role', 'tutor')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5);

  res.json({
    success: true,
    data: {
      id: tutor.user_id,
      firstName: tutor.profiles?.first_name,
      lastName: tutor.profiles?.last_name,
      name: displayName(tutor.profiles),
      bio: tutor.bio,
      hourlyRate: tutor.hourly_rate_tokens,
      rating: tutor.rating_avg,
      totalReviews: tutor.total_reviews,
      isVerified: tutor.is_verified,
      subjects: tutor.subjects?.map(s => ({
        id: s.subjects.id,
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
    .select(`
      *,
      profiles:reviewer_id (first_name, last_name)
    `)
    .eq('tutor_id', id)
    .eq('reviewee_role', 'tutor')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('Failed to fetch reviews', 500);

  res.json({
    success: true,
    data: reviews
  });
});

exports.getTutorAvailability = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const now = new Date().toISOString();
 
  const { data: slots, error } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('tutor_id', id)
    .eq('is_available', true)
    .gt('end_time', now)          // ← only future slots
    .order('start_time', { ascending: true });
 
  if (error) throw new AppError('Failed to fetch availability', 500);
 
  res.json({
    success: true,
    data: { slots: slots || [] }
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
    .gt('end_time', now)          // ← only future / in-progress slots
    .order('start_time', { ascending: true });
 
  if (error) throw new AppError('Failed to fetch availability', 500);
  res.json({ success: true, data: slots || [] });
});


exports.createAvailability = asyncHandler(async (req, res) => {
  const tutorId = req.user.id;
  const { startTime, endTime, start_time, end_time } = req.body;
  const slotStart = startTime || start_time;
  const slotEnd = endTime || end_time;

  if (!slotStart || !slotEnd) {
    throw new AppError('startTime and endTime are required', 400);
  }

  const start = new Date(slotStart);
  const end = new Date(slotEnd);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw new AppError('Availability end time must be after start time', 400);
  }

  if (start <= new Date()) {
    throw new AppError('Availability must be in the future', 400);
  }

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
    .insert({
      tutor_id: tutorId,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      is_available: true
    })
    .select()
    .single();

  if (error) throw new AppError('Failed to create availability', 500);

  res.status(201).json({
    success: true,
    message: 'Availability created',
    data: slot
  });
});

exports.deleteAvailability = asyncHandler(async (req, res) => {
  const tutorId = req.user.id;
  const { slotId } = req.params;

  const { data: slot, error: slotError } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('id', slotId)
    .single();

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
  if (count > 0) {
    throw new AppError('Cannot delete availability with active booked sessions', 409);
  }

  const { error } = await supabase
    .from('availability_slots')
    .update({
      is_available: false,
      deleted_at: new Date().toISOString()
    })
    .eq('id', slotId);

  if (error) throw new AppError('Failed to delete availability', 500);

  res.json({
    success: true,
    message: 'Availability deleted'
  });
});

exports.toggleAvailability = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { isAvailable } = req.body;

  if (typeof isAvailable !== 'boolean') {
    throw new AppError('isAvailable must be a boolean', 400);
  }

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
      profiles:user_id (first_name, last_name, email)
    `)
    .eq('user_id', userId)
    .single();

  if (error) {
    throw new AppError('Tutor profile not found', 404);
  }

  // Get subjects
  const { data: subjects } = await supabase
    .from('tutor_subjects')
    .select('subject_id, subjects(id, name, code)')
    .eq('tutor_id', userId);

  res.json({
    success: true,
    data: {
      ...profile,
      subjects: subjects?.map(s => s.subjects) || []
    }
  });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { bio, hourlyRate, hourly_rate_tokens, subjects } = req.body;
  const rate = hourlyRate ?? hourly_rate_tokens;

  if (rate !== undefined && (!Number.isFinite(Number(rate)) || Number(rate) <= 0)) {
    throw new AppError('Hourly rate must be a positive number', 400);
  }

  // Update tutor profile
  const { data, error } = await supabase
    .from('tutor_profiles')
    .update({
      bio,
      hourly_rate_tokens: rate,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new AppError('Failed to update profile', 500);

  // Update subjects if provided
  if (subjects && Array.isArray(subjects)) {
    // Delete existing
    await supabase
      .from('tutor_subjects')
      .delete()
      .eq('tutor_id', userId);

    // Insert new
    if (subjects.length > 0) {
      const subjectInserts = subjects.map(subjectId => ({
        tutor_id: userId,
        subject_id: subjectId
      }));

      await supabase.from('tutor_subjects').insert(subjectInserts);
    }
  }

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data
  });
});

exports.revertTutorApplication = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  if (req.user.role !== 'tutor') {
    throw new AppError('Only tutors can revert a tutor application', 400);
  }

  const { count: activeSessions, error: sessionError } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('tutor_id', userId)
    .in('status', ['pending', 'confirmed', 'in-progress']);

  if (sessionError) throw new AppError('Failed to validate tutor sessions', 500);
  if (activeSessions > 0) {
    throw new AppError('Cannot revert tutor account while active sessions exist', 409);
  }

  const { count: lockedEscrow, error: escrowError } = await supabase
    .from('escrow')
    .select('*', { count: 'exact', head: true })
    .eq('payee_id', userId)
    .in('status', ['locked', 'pending_eligibility']);

  if (escrowError) throw new AppError('Failed to validate tutor escrow', 500);
  if (lockedEscrow > 0) {
    throw new AppError('Cannot revert tutor account while escrow is locked or pending', 409);
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      role: 'tutee',
      is_tutor: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (profileError) throw new AppError('Failed to revert tutor application', 500);

  await supabase
    .from('tutor_profiles')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  res.json({
    success: true,
    message: 'Tutor application reverted; account is now a tutee account'
  });
});

// NEW: Get all subjects
exports.getSubjects = asyncHandler(async (req, res) => {
  const { data: subjects, error } = await supabase
    .from('subjects')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw new AppError('Failed to fetch subjects', 500);

  res.json({
    success: true,
    data: subjects
  });
});

// NEW: Tutor dashboard stats
exports.getDashboardStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Total earnings (released escrow)
  const { data: earnings } = await supabase
    .from('transactions')
    .select('amount_tokens')
    .eq('user_id', userId)
    .eq('type', 'credit');

  const totalEarnings = earnings?.reduce((sum, t) => sum + t.amount_tokens, 0) || 0;

  // Sessions completed
  const { count: completedSessions } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('tutor_id', userId)
    .eq('status', 'completed');

  // Current rating
  const { data: tutorProfile } = await supabase
    .from('tutor_profiles')
    .select('rating_avg, total_reviews')
    .eq('user_id', userId)
    .single();

  // Upcoming sessions
  const { count: upcomingSessions } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('tutor_id', userId)
    .in('status', ['pending', 'confirmed'])
    .gte('start_time', new Date().toISOString());

  res.json({
    success: true,
    data: {
      totalEarnings,
      completedSessions: completedSessions || 0,
      upcomingSessions: upcomingSessions || 0,
      rating: tutorProfile?.rating_avg || 0,
      totalReviews: tutorProfile?.total_reviews || 0
    }
  });
});
