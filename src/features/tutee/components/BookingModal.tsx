import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, CreditCard, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { TutorSearchResult, BookingRequest } from '../../../types/tutor';
import { AuthButton } from '../../../shared/components/AuthButton';
import { sessionApi } from '../../../api/sessionApi';

interface BookingModalProps {
  tutor: TutorSearchResult | null;
  userTokens: number;
  onClose: () => void;
  onConfirm: (booking: BookingRequest) => void | Promise<void>;
}

const TIME_SLOTS = [
  '09:00', '10:00', '11:00', '12:00',
  '14:00', '15:00', '16:00', '17:00', '18:00'
];

const DURATIONS = [30, 45, 60, 90, 120];

export const BookingModal: React.FC<BookingModalProps> = ({ 
  tutor, 
  userTokens, 
  onClose, 
  onConfirm 
}) => {
  const [step, setStep] = useState<'select' | 'confirm' | 'success'>('select');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [duration, setDuration] = useState<number>(60);
  const [topic, setTopic] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!tutor) return null;

  const totalCost = tutor.hourlyRate * (duration / 60);
  const hasEnoughTokens = userTokens >= totalCost;

  const handleConfirm = async () => {
    setIsProcessing(true);
    setError(null);
    const startTime = new Date(`${selectedDate}T${selectedTime}`).toISOString();
    const endTime = new Date(new Date(startTime).getTime() + duration * 60000).toISOString();
    
    const booking: BookingRequest = {
      tutorId: tutor.id,
      tutorName: tutor.name,
      subjectId: tutor.subjects[0]?.id || '',
      subject: tutor.subjects[0]?.name || 'General',
      scheduledAt: startTime,
      duration,
      tokenAmount: totalCost,
      notes: topic
    };

    try {
      await sessionApi.bookSession({
        tutor_id: tutor.id,
        subject_id: booking.subjectId || booking.subject,
        start_time: startTime,
        end_time: endTime
      });
      await onConfirm(booking);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const canProceed = selectedDate && selectedTime && topic.trim();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto shadow-2xl"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {step === 'success' ? 'Booking Confirmed!' : `Book with ${tutor.name}`}
              </h2>
              {step !== 'success' && (
                <p className="text-sm text-gray-500 mt-1">{tutor.subjects[0]?.name} • {tutor.hourlyRate} tokens/hour</p>
              )}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="p-6">
            {step === 'select' && (
              <div className="space-y-6">
                {/* Date Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Select Date
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>

                {/* Time Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Select Time
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {TIME_SLOTS.map(time => (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                          selectedTime === time
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Duration</label>
                  <div className="flex gap-2">
                    {DURATIONS.map(dur => (
                      <button
                        key={dur}
                        onClick={() => setDuration(dur)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                          duration === dur
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {dur}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* Topic */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">What do you need help with?</label>
                  <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., Integration by parts, Chapter 5 problems..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
                  />
                </div>

                {/* Cost Summary */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">{duration} minutes @ {tutor.hourlyRate} tokens/hr</span>
                    <span className="font-semibold">{totalCost} tokens</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="font-semibold text-gray-900">Total Cost</span>
                    <span className="text-xl font-bold text-indigo-600">{totalCost} tokens</span>
                  </div>
                </div>

                {!hasEnoughTokens && (
                  <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl text-sm">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>Insufficient tokens. You have {userTokens} tokens. Please top up.</span>
                  </div>
                )}

                <AuthButton
                  onClick={() => setStep('confirm')}
                  disabled={!canProceed || !hasEnoughTokens}
                >
                  Continue to Payment
                </AuthButton>
              </div>
            )}

            {step === 'confirm' && (
              <div className="space-y-6">
                <div className="bg-indigo-50 rounded-xl p-6 text-center">
                  <CreditCard className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
                  <h3 className="font-bold text-gray-900 mb-2">Confirm Payment</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    {totalCost} tokens will be deducted from your balance and held in escrow until the session is completed.
                  </p>
                  <div className="text-sm text-gray-500">
                    Your balance after booking: <span className="font-semibold text-gray-900">{userTokens - totalCost} tokens</span>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl text-sm">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tutor</span>
                    <span className="font-medium">{tutor.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date & Time</span>
                    <span className="font-medium">{selectedDate} at {selectedTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration</span>
                    <span className="font-medium">{duration} minutes</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('select')}
                    className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <AuthButton
                    onClick={handleConfirm}
                    isLoading={isProcessing}
                    disabled={isProcessing}
                  >
                    Confirm Booking
                  </AuthButton>
                </div>
              </div>
            )}

            {step === 'success' && (
              <div className="text-center py-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
                >
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </motion.div>
                
                <h3 className="text-xl font-bold text-gray-900 mb-2">Booking Confirmed!</h3>
                <p className="text-gray-600 mb-6">
                  Your session with {tutor.name} has been scheduled. You will receive a confirmation email and reminder before the session.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
                  >
                    View My Sessions
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
