// src/features/tutee/components/BookingModal.tsx — FULL REPLACEMENT
//
// Changes:
//  • Loads tutor's real availability slots via tutorApi.getAvailability()
//  • Shows slots grouped by date for the tutee to pick from
//  • Duration minimum is 60 min; options are 60/90/120/180 min
//  • When selected slot > duration, a start-time picker appears (hourly offsets
//    within the slot so the session fits entirely inside it)
//  • On confirm, sends the precise start/end ISO times to the backend
//  • After booking, the used portion of the slot is removed/trimmed on the backend
//    via the new PATCH /tutors/availability/:slotId/trim endpoint
//  • Self-booking is blocked (tutorId === currentUserId) — modal never opens
//  • Matches the style of BecomeTutorModal / WithdrawalModal (gradient bar, spring)

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Calendar, Clock, CreditCard, AlertCircle, CheckCircle2,
  Loader2, BookOpen, Lock,
} from 'lucide-react';
import type { TutorSearchResult, BookingRequest } from '../../../types/tutor';
import { sessionApi } from '../../../api/sessionApi';
import { tutorApi } from '../../../api/tutorApi';

interface AvailabilitySlot {
  id: string;
  start_time: string;   // ISO
  end_time: string;     // ISO
  slotMinutes: number;  // duration of the full slot
}

interface BookingModalProps {
  tutor: TutorSearchResult | null;
  currentUserId?: string;            // ← used to block self-booking
  userTokens: number;
  onClose: () => void;
  onConfirm: (booking: BookingRequest) => void | Promise<void>;
}

const DURATIONS = [60, 90, 120, 180];

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt12 = (iso: string) => {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

const minutesBetween = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);

const addMinutes = (iso: string, mins: number) =>
  new Date(new Date(iso).getTime() + mins * 60000).toISOString();

/** Group slots by calendar date (YYYY-MM-DD) */
const groupByDate = (slots: AvailabilitySlot[]): Record<string, AvailabilitySlot[]> => {
  return slots.reduce<Record<string, AvailabilitySlot[]>>((acc, s) => {
    const key = s.start_time.slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});
};

/** Build hourly start-time options within a slot for the chosen duration */
const buildStartOptions = (slot: AvailabilitySlot, durationMins: number): string[] => {
  const options: string[] = [];
  let cursor = new Date(slot.start_time).getTime();
  const latest = new Date(slot.end_time).getTime() - durationMins * 60000;
  while (cursor <= latest) {
    options.push(new Date(cursor).toISOString());
    cursor += 60 * 60000; // step 1 hour
  }
  return options;
};

// ── Component ─────────────────────────────────────────────────────────────────

export const BookingModal: React.FC<BookingModalProps> = ({
  tutor,
  currentUserId,
  userTokens,
  onClose,
  onConfirm,
}) => {
  // ── ALL hooks first — no early returns before this block ───────────────────
  const [step, setStep] = useState<'select' | 'confirm' | 'success'>('select');
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [duration, setDuration] = useState<number>(60);
  const [sessionStart, setSessionStart] = useState<string>('');
  const [topic, setTopic] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);

  // Load availability — safe because tutorId is null when tutor is null
  useEffect(() => {
    const tutorId = tutor?.id;
    if (!tutorId) return;
    let cancelled = false;
    setLoadingSlots(true);
    setSlotsError(null);
    setSlots([]);
    tutorApi.getAvailability(tutorId)
      .then(res => {
        if (cancelled) return;
        const raw: any[] = (res as any)?.data?.slots ?? (res as any)?.data ?? [];
        const now = new Date();
        const normalized: AvailabilitySlot[] = raw
          .filter(s => new Date(s.end_time ?? s.endTime) > now)
          .map(s => ({
            id: s.id,
            start_time: s.start_time ?? s.startTime,
            end_time:   s.end_time   ?? s.endTime,
            slotMinutes: minutesBetween(s.start_time ?? s.startTime, s.end_time ?? s.endTime),
          }))
          .sort((a, b) => a.start_time.localeCompare(b.start_time));
        setSlots(normalized);
      })
      .catch(() => {
        if (!cancelled) setSlotsError('Could not load tutor availability. Please try again.');
      })
      .finally(() => { if (!cancelled) setLoadingSlots(false); });
    return () => { cancelled = true; };
  }, [tutor?.id]);

  // Reset sessionStart when slot or duration changes
  useEffect(() => {
    if (!selectedSlot) { setSessionStart(''); return; }
    const options = buildStartOptions(selectedSlot, duration);
    setSessionStart(options.length === 1 ? options[0] : '');
  }, [selectedSlot?.id, duration]);

  // ── Guards (after ALL hooks) ────────────────────────────────────────────────
  if (!tutor) return null;
  if (currentUserId && currentUserId === tutor.id) return null;

  // ── Derived values ──────────────────────────────────────────────────────────
  const isPaymentLocked = tutor.qualification ? !tutor.qualification.qualified : tutor.hourlyRate <= 0;
  const totalCost = isPaymentLocked ? 0 : Math.round(tutor.hourlyRate * (duration / 60));
  const hasEnoughTokens = userTokens >= totalCost;

  const startOptions = selectedSlot ? buildStartOptions(selectedSlot, duration) : [];
  const needsStartPicker = startOptions.length > 1;
  const effectiveStart = sessionStart || (startOptions.length === 1 ? startOptions[0] : '');
  const effectiveEnd   = effectiveStart ? addMinutes(effectiveStart, duration) : '';

  const canProceed =
    !!selectedSlot &&
    !!effectiveStart &&
    !!topic.trim() &&
    hasEnoughTokens;

  const dateGroups = groupByDate(slots);
  const sortedDates = Object.keys(dateGroups).sort();

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSlotSelect = (slot: AvailabilitySlot) => {
    // Only selectable if the slot can fit at least the minimum duration
    if (slot.slotMinutes < 60) return;
    // If current duration no longer fits, reset to 60
    const newDuration = slot.slotMinutes >= duration ? duration : 60;
    setSelectedSlot(slot);
    setDuration(newDuration);
    setBookingError(null);
  };

  const handleDurationChange = (mins: number) => {
    if (!selectedSlot || selectedSlot.slotMinutes < mins) return;
    setDuration(mins);
  };

  const handleConfirm = async () => {
    if (!effectiveStart || !effectiveEnd || !selectedSlot) return;
    setIsProcessing(true);
    setBookingError(null);
    try {
      await sessionApi.bookSession({
        tutor_id:   tutor.id,
        subject_id: tutor.subjects[0]?.id || '',
        start_time: effectiveStart,
        end_time:   effectiveEnd,
        notes:      topic,
        availability_slot_id: selectedSlot.id,
      });
      await onConfirm({
        tutorId:     tutor.id,
        tutorName:   tutor.name,
        subjectId:   tutor.subjects[0]?.id || '',
        subject:     tutor.subjects[0]?.name || 'General',
        scheduledAt: effectiveStart,
        duration,
        tokenAmount: totalCost,
        notes:       topic,
      });
      setStep('success');
    } catch (err: any) {
      setBookingError(err?.response?.data?.message ?? err?.message ?? 'Booking failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      >
        {/* Backdrop */}
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Panel */}
        <motion.div
          key="modal"
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
          className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Gradient accent bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 flex-shrink-0" />

          {/* Close button */}
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40 z-10"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
            {step === 'success' ? (
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Booking Confirmed!</h2>
                  <p className="text-sm text-gray-500">Your session has been scheduled</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Book with {tutor.name}</h2>
                  <p className="text-sm text-gray-500">
                    {tutor.subjects[0]?.name ?? 'Tutoring'} • {isPaymentLocked ? 'Free until paid tutoring unlocks' : `${tutor.hourlyRate} tokens/hr`}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-6 py-5">

            {/* ── STEP: select ──────────────────────────────────────────────── */}
            {step === 'select' && (
              <div className="space-y-6">

                {/* Available slots */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-500" /> Available Time Slots
                  </p>

                  {loadingSlots ? (
                    <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Loading availability…</span>
                    </div>
                  ) : slotsError ? (
                    <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" /> {slotsError}
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-500">No available slots</p>
                      <p className="text-xs text-gray-400 mt-1">This tutor hasn't added availability yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sortedDates.map(dateKey => (
                        <div key={dateKey}>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            {fmtDate(dateKey + 'T12:00:00')}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {dateGroups[dateKey].map(slot => {
                              const fits = slot.slotMinutes >= 60;
                              const isSelected = selectedSlot?.id === slot.id;
                              return (
                                <button
                                  key={slot.id}
                                  onClick={() => handleSlotSelect(slot)}
                                  disabled={!fits}
                                  title={!fits ? 'Slot is too short (< 60 min)' : undefined}
                                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                      : fits
                                      ? 'bg-gray-50 text-gray-700 border-gray-200 hover:border-indigo-400 hover:text-indigo-600'
                                      : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                                  }`}
                                >
                                  {fmt12(slot.start_time)} – {fmt12(slot.end_time)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Duration — only show when a slot is selected */}
                {selectedSlot && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-3">Duration (minimum 60 min)</p>
                    <div className="flex gap-2 flex-wrap">
                      {DURATIONS.map(d => {
                        const fits = selectedSlot.slotMinutes >= d;
                        return (
                          <button
                            key={d}
                            onClick={() => handleDurationChange(d)}
                            disabled={!fits}
                            className={`flex-1 min-w-[60px] py-2 rounded-xl text-sm font-medium transition-all ${
                              duration === d
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : fits
                                ? 'bg-gray-50 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600'
                                : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                            }`}
                          >
                            {d}m
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Start time picker — only when slot is longer than duration */}
                {selectedSlot && needsStartPicker && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-500" /> Choose Start Time
                      <span className="text-xs font-normal text-gray-400">
                        (session ends {duration} min later)
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {startOptions.map(opt => (
                        <button
                          key={opt}
                          onClick={() => setSessionStart(opt)}
                          className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                            sessionStart === opt
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-indigo-400 hover:text-indigo-600'
                          }`}
                        >
                          {fmt12(opt)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Session summary pill */}
                {effectiveStart && effectiveEnd && (
                  <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-indigo-700 font-medium">
                      {fmtDate(effectiveStart)}
                    </span>
                    <span className="text-sm font-bold text-indigo-900">
                      {fmt12(effectiveStart)} – {fmt12(effectiveEnd)}
                    </span>
                  </div>
                )}

                {/* Topic */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    What do you need help with?
                  </label>
                  <textarea
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="e.g., Integration by parts, Chapter 5 problems…"
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none text-sm"
                  />
                </div>

                {/* Cost summary */}
                {selectedSlot && (
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                    {isPaymentLocked && (
                      <div className="mb-3 flex items-start gap-2 rounded-xl border border-indigo-100 bg-white px-3 py-2 text-indigo-700">
                        <Lock className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <span>
                          You unlock paid tutoring after: 30 session hours, 20 student reviews,
                          and maintaining a 3.0+ rating.
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">
                        {duration} min {isPaymentLocked ? 'qualification session' : `@ ${tutor.hourlyRate} tokens/hr`}
                      </span>
                      <span className="font-semibold">{totalCost} tokens</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                      <span className="font-semibold text-gray-900">Total Cost</span>
                      <span className="text-lg font-bold text-indigo-600">{totalCost} tokens</span>
                    </div>
                  </div>
                )}

                {!hasEnoughTokens && selectedSlot && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    You have {userTokens} tokens but need {totalCost}. Please top up.
                  </div>
                )}
              </div>
            )}

            {/* ── STEP: confirm ─────────────────────────────────────────────── */}
            {step === 'confirm' && (
              <div className="space-y-5">
                <div className="bg-indigo-50 rounded-xl p-6 text-center">
                  <CreditCard className="w-12 h-12 text-indigo-600 mx-auto mb-3" />
                  <h3 className="font-bold text-gray-900 mb-2">Confirm Payment</h3>
                  <p className="text-gray-600 text-sm">
                    {isPaymentLocked
                      ? 'This booking is free while the tutor completes paid-tutoring requirements.'
                      : `${totalCost} tokens will be held in escrow and released when the session completes.`}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Balance after booking:{' '}
                    <span className="font-semibold text-gray-900">{userTokens - totalCost} tokens</span>
                  </p>
                </div>

                {bookingError && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {bookingError}
                  </div>
                )}

                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                  {[
                    ['Tutor',     tutor.name],
                    ['Date',      fmtDate(effectiveStart)],
                    ['Time',      `${fmt12(effectiveStart)} – ${fmt12(effectiveEnd)}`],
                    ['Duration',  `${duration} minutes`],
                    ['Subject',   tutor.subjects[0]?.name ?? 'General'],
                    ['Topic',     topic],
                    ['Cost',      isPaymentLocked ? 'Free' : `${totalCost} tokens`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-medium text-gray-900 text-right max-w-[55%] truncate">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── STEP: success ─────────────────────────────────────────────── */}
            {step === 'success' && (
              <div className="text-center py-6 space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto"
                >
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </motion.div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">You're all set!</h3>
                  <p className="text-gray-500 text-sm">
                    Your session with <span className="font-medium text-gray-700">{tutor.name}</span> is
                    confirmed for {fmtDate(effectiveStart)} at {fmt12(effectiveStart)}.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer buttons */}
          <div className="px-6 pb-6 pt-2 flex-shrink-0 border-t border-gray-100">
            {step === 'select' && (
              <button
                onClick={() => setStep('confirm')}
                disabled={!canProceed}
                className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-md shadow-indigo-200"
              >
                Continue to Payment
              </button>
            )}

            {step === 'confirm' && (
              <div className="flex gap-3">
                <button
                  onClick={() => { setStep('select'); setBookingError(null); }}
                  disabled={isProcessing}
                  className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isProcessing}
                  className="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md shadow-indigo-200"
                >
                  {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isProcessing ? 'Confirming…' : 'Confirm Booking'}
                </button>
              </div>
            )}

            {step === 'success' && (
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all active:scale-[0.98]"
              >
                View My Sessions
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
