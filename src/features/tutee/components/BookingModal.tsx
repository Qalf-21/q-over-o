// src/features/tutee/components/BookingModal.tsx — FULL REPLACEMENT
//
// Changes:
//  • Loads tutor's real availability slots via tutorApi.getAvailability()
//  • Shows slots grouped by date for the tutee to pick from
//  • Duration minimum is 30 min and increases in 30-minute increments
//  • Start time can be any minute inside the slot if it is at least 10 minutes away
//  • On confirm, sends the precise start/end ISO times to the backend
//  • After booking, the used portion of the slot is removed/trimmed on the backend
//    via the new PATCH /tutors/availability/:slotId/trim endpoint
//  • Self-booking is blocked (tutorId === currentUserId) — modal never opens
//  • Matches the style of BecomeTutorModal / WithdrawalModal (gradient bar, spring)

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  X, Calendar, Clock, CreditCard, AlertCircle, CheckCircle2,
  Loader2, BookOpen, Lock,
} from 'lucide-react';
import type { TutorSearchResult, BookingRequest } from '../../../types/tutor';
import { sessionApi } from '../../../api/sessionApi';
import { tutorApi } from '../../../api/tutorApi';
import { localDateKey, parseUtcDate } from '../../../utils/dateTime';

interface AvailabilitySlot {
  id: string;
  start_time: string;   // ISO
  end_time: string;     // ISO
  slotMinutes: number;  // duration of the full slot
}

type RawAvailabilitySlot = {
  id?: string;
  start_time?: string;
  startTime?: string;
  end_time?: string;
  endTime?: string;
};

type AvailabilityResponse = {
  data?: RawAvailabilitySlot[] | { slots?: RawAvailabilitySlot[] };
};

interface BookingModalProps {
  tutor: TutorSearchResult | null;
  currentUserId?: string;            // ← used to block self-booking
  userTokens: number;
  onClose: () => void;
  onConfirm: (booking: BookingRequest) => void | Promise<void>;
}

const MIN_BOOKING_LEAD_MINUTES = 10;
const MIN_SESSION_MINUTES = 30;
const SESSION_DURATION_INCREMENT_MINUTES = 30;

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt12 = (iso: string) => {
  const d = parseUtcDate(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
};

const fmtDate = (iso: string) =>
  parseUtcDate(iso).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

const minutesBetween = (a: string, b: string) =>
  Math.round((parseUtcDate(b).getTime() - parseUtcDate(a).getTime()) / 60000);

const addMinutes = (iso: string, mins: number) =>
  new Date(parseUtcDate(iso).getTime() + mins * 60000).toISOString();

const ceilToNextMinute = (date: Date) => {
  const rounded = new Date(date);
  if (rounded.getSeconds() === 0 && rounded.getMilliseconds() === 0) return rounded;
  rounded.setMinutes(rounded.getMinutes() + 1, 0, 0);
  return rounded;
};

const currentBookableStart = (startIso: string, now: Date) => {
  const start = parseUtcDate(startIso);
  const earliestStart = ceilToNextMinute(new Date(now.getTime() + MIN_BOOKING_LEAD_MINUTES * 60000));
  return start < earliestStart ? earliestStart : start;
};

const toTimeValue = (iso: string) => parseUtcDate(iso).toTimeString().slice(0, 5);

const localDateTimeToIso = (dateKey: string, time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date(`${dateKey}T00:00:00`);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

const durationOptionsFor = (slot: AvailabilitySlot | null, startTime: string) => {
  if (!slot || !startTime) return [];
  const start = parseUtcDate(localDateTimeToIso(localDateKey(slot.start_time), startTime));
  const end = parseUtcDate(slot.end_time);
  const maxDuration = Math.floor((end.getTime() - start.getTime()) / 60000 / SESSION_DURATION_INCREMENT_MINUTES) * SESSION_DURATION_INCREMENT_MINUTES;
  if (maxDuration < MIN_SESSION_MINUTES) return [];
  return Array.from(
    { length: Math.floor(maxDuration / SESSION_DURATION_INCREMENT_MINUTES) },
    (_, index) => (index + 1) * SESSION_DURATION_INCREMENT_MINUTES,
  );
};

/** Group slots by calendar date (YYYY-MM-DD) */
const groupByDate = (slots: AvailabilitySlot[]): Record<string, AvailabilitySlot[]> => {
  return slots.reduce<Record<string, AvailabilitySlot[]>>((acc, s) => {
    const key = localDateKey(s.start_time);
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});
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
  const [duration, setDuration] = useState<number>(MIN_SESSION_MINUTES);
  const [sessionStart, setSessionStart] = useState<string>('');
  const [topic, setTopic] = useState('');

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

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
        const response = res as AvailabilityResponse;
        const raw = Array.isArray(response.data)
          ? response.data
          : response.data?.slots ?? [];
        const now = new Date();
        const normalized: AvailabilitySlot[] = raw
          .filter(s => parseUtcDate(s.end_time ?? s.endTime ?? '') > now)
          .map(s => {
            const start = currentBookableStart(s.start_time ?? s.startTime ?? '', now).toISOString();
            const end = s.end_time ?? s.endTime ?? '';
            return {
              id: s.id || '',
              start_time: start,
              end_time:   end,
              slotMinutes: minutesBetween(start, end),
            };
          })
          .filter(s => s.slotMinutes >= MIN_SESSION_MINUTES)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));
        setSlots(normalized);
      })
      .catch(() => {
        if (!cancelled) setSlotsError('Could not load tutor availability. Please try again.');
      })
      .finally(() => { if (!cancelled) setLoadingSlots(false); });
    return () => { cancelled = true; };
  }, [tutor?.id]);

  // Auto-select first subject when tutor loads
  useEffect(() => {
    if (tutor?.subjects?.length) {
      setSelectedSubjectId(tutor.subjects[0].id);
    } else {
      setSelectedSubjectId('');
    }
  }, [tutor?.subjects]);

  // Reset start and duration when the selected slot changes.
  useEffect(() => {
    if (!selectedSlot) { setSessionStart(''); return; }
    const nextStart = toTimeValue(selectedSlot.start_time);
    const options = durationOptionsFor(selectedSlot, nextStart);
    setSessionStart(nextStart);
    setDuration(options[0] ?? MIN_SESSION_MINUTES);
  }, [selectedSlot]);

  useEffect(() => {
    if (!selectedSlot || !sessionStart) return;
    const options = durationOptionsFor(selectedSlot, sessionStart);
    if (!options.includes(duration)) {
      setDuration(options[0] ?? MIN_SESSION_MINUTES);
    }
  }, [selectedSlot, sessionStart, duration]);

  // ── Guards (after ALL hooks) ────────────────────────────────────────────────
  if (!tutor) return null;
  if (currentUserId && currentUserId === tutor.id) return null;

  // ── Derived values ──────────────────────────────────────────────────────────
  const isPaymentLocked = tutor.qualification ? !tutor.qualification.qualified : tutor.hourlyRate <= 0;
  const totalCost = isPaymentLocked ? 0 : Math.round(tutor.hourlyRate * (duration / 60));
  const hasEnoughTokens = userTokens >= totalCost;

  const durationOptions = selectedSlot ? durationOptionsFor(selectedSlot, sessionStart) : [];
  const effectiveStart = selectedSlot && sessionStart ? localDateTimeToIso(localDateKey(selectedSlot.start_time), sessionStart) : '';
  const effectiveEnd   = effectiveStart ? addMinutes(effectiveStart, duration) : '';
  const startIsInsideSlot = Boolean(
    selectedSlot &&
    effectiveStart &&
    parseUtcDate(effectiveStart) >= parseUtcDate(selectedSlot.start_time) &&
    parseUtcDate(effectiveStart) < parseUtcDate(selectedSlot.end_time)
  );
  const endIsInsideSlot = Boolean(
    selectedSlot &&
    effectiveEnd &&
    parseUtcDate(effectiveEnd) <= parseUtcDate(selectedSlot.end_time)
  );

  const canProceed =
    !!selectedSlot &&
    !!effectiveStart &&
    startIsInsideSlot &&
    endIsInsideSlot &&
    durationOptions.includes(duration) &&
    hasEnoughTokens;
    // Note: selectedSubjectId is optional — backend falls back to first tutor subject

  const dateGroups = groupByDate(slots);
  const sortedDates = Object.keys(dateGroups).sort();

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSlotSelect = (slot: AvailabilitySlot) => {
    if (slot.slotMinutes < MIN_SESSION_MINUTES) return;
    setSelectedSlot(slot);
    setBookingError(null);
  };

  const handleDurationChange = (mins: number) => {
    if (!selectedSlot || !durationOptions.includes(mins)) return;
    setDuration(mins);
  };

  const handleViewSessions = () => {
    onClose();
    navigate(location.pathname.startsWith('/dashboard/learn') ? '/dashboard/learn/sessions' : '/dashboard/my-sessions');
  };

  const handleConfirm = async () => {
    if (!effectiveStart || !effectiveEnd || !selectedSlot) return;
    if (!canProceed) {
      setBookingError('Choose a valid start time and duration inside the selected availability slot.');
      return;
    }
    setIsProcessing(true);
    setBookingError(null);
    const activeSubject = tutor.subjects?.find(s => s.id === selectedSubjectId)
      ?? tutor.subjects?.[0];
    try {
      await sessionApi.bookSession({
        tutor_id:   tutor.id,
        subject_id: activeSubject?.id,  // undefined when no subject — backend resolves
        start_time: effectiveStart,
        end_time:   effectiveEnd,
        topic,
        notes:      topic,
        availability_slot_id: selectedSlot.id,
      });
      await onConfirm({
        tutorId:     tutor.id,
        tutorName:   tutor.name,
        subjectId:   activeSubject?.id || '',
        subject:     activeSubject?.name || 'General',
        scheduledAt: effectiveStart,
        duration,
        tokenAmount: totalCost,
        notes:       topic,
      });
      setStep('success');
    } catch (err) {
      const maybeApiError = err as { response?: { data?: { message?: string } }; message?: string };
      setBookingError(maybeApiError.response?.data?.message ?? maybeApiError.message ?? 'Booking failed. Please try again.');
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
          className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Panel */}
        <motion.div
          key="modal"
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
          className="app-modal-panel flex max-h-[90vh] max-w-lg flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Gradient accent bar */}
          <div className="app-modal-accent flex-shrink-0" />

          {/* Close button */}
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="app-icon-button absolute right-4 top-4 z-10 h-8 w-8"
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
                  <h2 className="text-lg font-bold text-gray-900">Request Sent</h2>
                  <p className="text-sm text-gray-500">Your tutor can now accept or decline it</p>
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
                    <div className="app-alert-error">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" /> {slotsError}
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="app-empty-state py-8">
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
                              const fits = slot.slotMinutes >= MIN_SESSION_MINUTES;
                              const isSelected = selectedSlot?.id === slot.id;
                              return (
                                <button
                                  key={slot.id}
                                  onClick={() => handleSlotSelect(slot)}
                                  disabled={!fits}
                                  title={!fits ? 'Slot is too short (< 30 min)' : undefined}
                                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${
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

                {selectedSlot && (
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2" htmlFor="session-start-time">
                      <Clock className="w-4 h-4 text-indigo-500" /> Start Time
                    </label>
                    <input
                      id="session-start-time"
                      type="time"
                      step={60}
                      min={toTimeValue(selectedSlot.start_time)}
                      max={toTimeValue(addMinutes(selectedSlot.end_time, -MIN_SESSION_MINUTES))}
                      value={sessionStart}
                      onChange={e => {
                        setSessionStart(e.target.value);
                        setBookingError(null);
                      }}
                      className="app-input"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Earliest start is {fmt12(selectedSlot.start_time)}. Sessions must start at least 10 minutes from now.
                    </p>
                  </div>
                )}

                {selectedSlot && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-3">Duration (minimum 30 min)</p>
                    <div className="flex gap-2 flex-wrap">
                      {durationOptions.length === 0 ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                          Pick an earlier start time to fit a 30-minute session.
                        </div>
                      ) : durationOptions.map(d => (
                        <button
                          key={d}
                          onClick={() => handleDurationChange(d)}
                          className={`flex-1 min-w-[64px] py-2 rounded-xl text-sm font-medium transition-all ${
                            duration === d
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-gray-50 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600'
                          }`}
                        >
                          {d}m
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

                {/* Subject selector — shown when tutor has multiple subjects */}
                {(tutor.subjects?.length ?? 0) > 1 && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Subject
                    </label>
                    <select
                      value={selectedSubjectId}
                      onChange={e => setSelectedSubjectId(e.target.value)}
                      className="app-select w-full"
                    >
                      {tutor.subjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
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
                    className="app-input resize-none py-3"
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
                  <div className="app-alert-error">
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
                  <div className="app-alert-error">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {bookingError}
                  </div>
                )}

                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                  {[
                    ['Tutor',     tutor.name],
                    ['Date',      fmtDate(effectiveStart)],
                    ['Time',      `${fmt12(effectiveStart)} – ${fmt12(effectiveEnd)}`],
                    ['Duration',  `${duration} minutes`],
                    ['Subject',   (tutor.subjects?.find(s => s.id === selectedSubjectId) ?? tutor.subjects?.[0])?.name ?? 'General'],
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
                  <h3 className="text-xl font-bold text-gray-900 mb-1">Session request sent</h3>
                  <p className="text-gray-500 text-sm">
                    Your request with <span className="font-medium text-gray-700">{tutor.name}</span> is
                    pending for {fmtDate(effectiveStart)} at {fmt12(effectiveStart)}.
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
                className="app-button-primary w-full py-3"
              >
                Continue to Payment
              </button>
            )}

            {step === 'confirm' && (
              <div className="flex gap-3">
                <button
                  onClick={() => { setStep('select'); setBookingError(null); }}
                  disabled={isProcessing}
                className="app-button-secondary flex-1 py-3"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isProcessing}
                  className="app-button-primary flex-1 py-3"
                >
                  {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isProcessing ? 'Confirming…' : 'Confirm Booking'}
                </button>
              </div>
            )}

            {step === 'success' && (
              <button
                onClick={handleViewSessions}
                className="app-button-primary w-full py-3"
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
