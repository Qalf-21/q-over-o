import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, CheckCircle2 } from 'lucide-react';
import type { TuteeSession, ReviewSubmission } from '../../../types/tutor';
import { AuthButton } from '../../../shared/components/AuthButton';

interface ReviewModalProps {
  session: TuteeSession | null;
  onClose: () => void;
  onSubmit: (review: ReviewSubmission) => void | Promise<void>;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ session, onClose, onSubmit }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!session) return null;

  const handleSubmit = async () => {
    if (rating === 0) return;
    
    setIsSubmitting(true);
    
    const review: ReviewSubmission = {
      sessionId: session.id,
      tutorId: session.tutorId,
      rating,
      comment
    };

    try {
      await onSubmit(review);
      setIsSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="app-modal-backdrop"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="app-modal-panel max-w-md"
        >
          <div className="app-modal-accent" />
          {!isSuccess ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-100 p-6">
                <h2 className="text-xl font-bold text-gray-900">Rate Your Session</h2>
                <button onClick={onClose} className="app-icon-button">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="text-center">
                  <p className="text-gray-600 mb-4">
                    How was your session with <span className="font-semibold text-gray-900">{session.tutorName}</span>?
                  </p>
                  
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 transition-transform hover:scale-110"
                      >
                        <Star
                          className={`w-10 h-10 ${
                            star <= (hoverRating || rating)
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    {rating === 0 ? 'Select a rating' : 
                     rating === 1 ? 'Poor' :
                     rating === 2 ? 'Fair' :
                     rating === 3 ? 'Good' :
                     rating === 4 ? 'Very Good' : 'Excellent'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Feedback (Optional)
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="What went well? What could be improved?"
                    rows={4}
                    className="app-input resize-none py-3"
                  />
                </div>

                <AuthButton
                  onClick={handleSubmit}
                  isLoading={isSubmitting}
                  disabled={rating === 0 || isSubmitting}
                >
                  Submit Review
                </AuthButton>
              </div>
            </>
          ) : (
            <div className="p-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </motion.div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Thank You!</h3>
              <p className="text-gray-600 mb-6">Your feedback helps other students find great tutors.</p>
              <button
                onClick={onClose}
                className="app-button-primary w-full py-3"
              >
                Close
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
