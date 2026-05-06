const supabase = require('../config/supabase');
const { AppError, asyncHandler } = require('../utils/errorHandler');

exports.becomeTutor = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { confirm, bio = '', hourlyRate = 500, subjects = [] } = req.body;

  if (confirm !== true) {
    throw new AppError('Confirmation is required to become a tutor', 400, 'CONFIRMATION_REQUIRED');
  }

  if (!Number.isFinite(Number(hourlyRate)) || Number(hourlyRate) <= 0) {
    throw new AppError('hourlyRate must be a positive number', 400, 'VALIDATION_ERROR');
  }

  if (subjects !== undefined && !Array.isArray(subjects)) {
    throw new AppError('subjects must be an array of subject ids', 400, 'VALIDATION_ERROR');
  }

  const { data, error } = await supabase.rpc('become_tutor_atomic', {
    p_user_id: userId,
    p_bio: String(bio || '').trim(),
    p_hourly_rate_tokens: Number(hourlyRate),
    p_subject_ids: subjects
  });

  if (error) {
    throw new AppError(error.message, 400);
  }

  res.status(201).json({
    success: true,
    message: 'Tutor profile created successfully',
    data
  });
});
