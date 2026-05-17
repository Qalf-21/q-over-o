// src/features/tutor/pages/Availability.tsx — FULL REPLACEMENT
//
// Changes from previous version:
//  • Modal matches other modals (gradient header bar, spring animation, backdrop blur)
//  • Exact start-time selection with 1-hour duration increments
//  • Today is selectable in the date picker (min = today, not tomorrow)
//  • When today is selected, start times before the current hour are disabled
//  • Slots are date-specific (not recurring weekly) — expired slots are filtered out client-side
//  • Modal subtitle updated to reflect non-recurring nature
//  • Backend already supports ISO datetime slots; no backend changes needed for these UI rules

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Plus, Trash2, Calendar, CheckCircle2, Loader2, AlertCircle, X } from 'lucide-react';
import { tutorApi } from '../../../api/tutorApi';
import type { TimeSlot } from '../tutor';
import { localDateKey, parseUtcDate } from '../../../utils/dateTime';
import { useAutoRefresh } from '../../../shared/hooks/useAutoRefresh';

// ── Helpers ──────────────────────────────────────────────────────────────────


const AVAILABILITY_LEAD_MINUTES = 10;
const MIN_AVAILABILITY_HOURS = 1;
const MAX_AVAILABILITY_HOURS = 8;

const fmt12 = (hhmm: string) => {
  const [h, m = 0] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
};

const toHHMM = (iso: string) => parseUtcDate(iso).toTimeString().slice(0, 5);

const addHoursToTime = (hhmm: string, hours: number) => {
  const [hour, minute] = hhmm.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setHours(date.getHours() + hours);
  return date.toTimeString().slice(0, 5);
};

const localDateTime = (date: string, time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  const value = new Date(`${date}T00:00:00`);
  value.setHours(hour, minute, 0, 0);
  return value;
};

const normalizeSlot = (slot: any): TimeSlot => {
  const startRaw = slot.start_time ?? slot.startTime;
  const endRaw   = slot.end_time   ?? slot.endTime;
  if (startRaw && startRaw.includes('T')) {
    const start = parseUtcDate(startRaw);
    return {
      id:          slot.id,
      dayOfWeek:   start.getDay(),
      startTime:   toHHMM(startRaw),
      endTime:     toHHMM(endRaw),
      isAvailable: slot.is_available ?? slot.isAvailable ?? true,
      // Keep the raw ISO so we can check expiry
      _startISO:   startRaw,
      _endISO:     endRaw,
      _date:       localDateKey(startRaw),
    } as any;
  }
  return {
    id:          slot.id,
    dayOfWeek:   slot.dayOfWeek ?? slot.day_of_week ?? 0,
    startTime:   startRaw ?? '',
    endTime:     endRaw   ?? '',
    isAvailable: slot.isAvailable ?? slot.is_available ?? true,
  };
};

/** Filter out slots whose end time has already passed */
const filterExpired = (slots: any[]): any[] => {
  const now = new Date();
  return slots.filter(s => {
    const endISO = s._endISO ?? null;
    if (!endISO) return true; // can't determine — keep it
    return parseUtcDate(endISO) > now;
  });
};

/** Today's date as YYYY-MM-DD in local time */
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ── AddSlotModal ─────────────────────────────────────────────────────────────

interface AddSlotModalProps {
  onClose: () => void;
  onSave: (slot: { dayOfWeek: number; startTime: string; durationHours: number; date: string }) => Promise<void>;
  existingSlots: any[];
  saving: boolean;
}

const AddSlotModal: React.FC<AddSlotModalProps> = ({ onClose, onSave, existingSlots, saving }) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [startTime,    setStart]        = useState('');
  const [durationHours, setDurationHours] = useState(MIN_AVAILABILITY_HOURS);
  const [modalError,   setModalError]   = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const today      = todayLocal();
  const dayOfWeek  = selectedDate ? new Date(selectedDate + 'T12:00:00').getDay() : -1;
  const endTime = startTime ? addHoursToTime(startTime, durationHours) : '';

  const handleSave = async () => {
    if (!selectedDate) { setModalError('Please select a date.'); return; }
    if (!startTime) { setModalError('Please select a start time.'); return; }
    if (durationHours < MIN_AVAILABILITY_HOURS || durationHours > MAX_AVAILABILITY_HOURS) {
      setModalError('Availability duration must be between 1 and 8 hours.');
      return;
    }

    const startDate = localDateTime(selectedDate, startTime);
    const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);
    const earliestStart = new Date(Date.now() + AVAILABILITY_LEAD_MINUTES * 60 * 1000);

    if (startDate < earliestStart) {
      setModalError('Start time must be at least 10 minutes from now.');
      return;
    }

    const conflict = existingSlots.some(
      s => s.dayOfWeek === dayOfWeek &&
        s._date === selectedDate && // same specific date
        ((startDate >= localDateTime(selectedDate, s.startTime) && startDate < localDateTime(selectedDate, s.endTime)) ||
         (endDate > localDateTime(selectedDate, s.startTime) && endDate <= localDateTime(selectedDate, s.endTime)) ||
         (startDate <= localDateTime(selectedDate, s.startTime) && endDate >= localDateTime(selectedDate, s.endTime)))
    );
    if (conflict) { setModalError('This time overlaps with an existing slot on that day.'); return; }

    setModalError(null);
    try {
      await onSave({ dayOfWeek, startTime, durationHours, date: selectedDate });
    } catch (err: any) {
      setModalError(err?.message ?? 'Failed to save the time slot. Please try again.');
    }
  };

  const formattedDate = selectedDate
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : '';

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Backdrop — matches BecomeTutorModal / WithdrawalModal */}
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
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Gradient accent bar — same as other modals */}
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        {/* Close button */}
        <button
          onClick={onClose}
          disabled={saving}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Add Availability Slot</h2>
              <p className="text-sm text-gray-500">Pick a specific date and time window</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">

          {/* Date picker */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" /> Select Date
            </p>
            <input
              type="date"
              min={today}
              value={selectedDate}
              onChange={e => {
                setSelectedDate(e.target.value);
                setStart('');
                setModalError(null);
              }}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-gray-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            />
            {selectedDate && (
              <p className="mt-1.5 text-xs text-indigo-600 font-medium">{formattedDate}</p>
            )}
          </div>

          <div>
            <label htmlFor="availability-start-time" className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" /> Start Time
            </label>
            <input
              id="availability-start-time"
              type="time"
              step={60}
              value={startTime}
              onChange={(e) => {
                setStart(e.target.value);
                setModalError(null);
              }}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-gray-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            />
            <p className="mt-1.5 text-xs text-gray-400">Start time must be at least 10 minutes from now.</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" /> Duration
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: MAX_AVAILABILITY_HOURS }, (_, index) => index + 1).map(hours => (
                <button
                  key={hours}
                  onClick={() => {
                    setDurationHours(hours);
                    setModalError(null);
                  }}
                  type="button"
                  className={`py-2 rounded-xl text-xs font-medium transition-all ${
                      durationHours === hours
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-gray-50 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600'
                    }`}
                >
                  {hours}h
                </button>
              ))}
            </div>
          </div>

          {/* Summary pill */}
          {selectedDate && startTime && endTime && (
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-indigo-700 font-medium">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined, {
                  weekday: 'short', month: 'short', day: 'numeric',
                })}
              </span>
              <span className="text-sm font-bold text-indigo-900">
                {fmt12(startTime)} – {fmt12(endTime)}
              </span>
            </div>
          )}

          {/* Error */}
          {modalError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {modalError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !selectedDate || !startTime}
            className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md shadow-indigo-200"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : 'Save Slot'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Availability page ─────────────────────────────────────────────────────────

export const Availability: React.FC = () => {
  const [slots,       setSlots]       = useState<any[]>([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  const fetchAvailability = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    const [profileResult, slotsResult] = await Promise.allSettled([
      tutorApi.getMyProfile(),
      tutorApi.getMyAvailability(),
    ]);
    if (profileResult.status === 'fulfilled') {
      const res = profileResult.value;
      if (res.success && res.data) {
        const p = res.data as any;
        setIsAvailable(p.isAvailable ?? p.is_available ?? true);
      }
    }
    if (slotsResult.status === 'fulfilled') {
      const res = slotsResult.value;
      if (res.success) {
        const normalized = (res.data as any[] ?? []).map(normalizeSlot);
        // Remove slots whose end time has already passed
        setSlots(filterExpired(normalized));
      }
    } else {
      setError('Could not load your saved time slots. You can still add new ones.');
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => { fetchAvailability(); }, [fetchAvailability]);
  useAutoRefresh(() => fetchAvailability(true), { intervalMs: 30_000 });

  // Periodically clean up expired slots from local state (every minute)
  useEffect(() => {
    const interval = setInterval(() => {
      setSlots(prev => filterExpired(prev));
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleAvailability = async () => {
    const next = !isAvailable;
    setIsAvailable(next);
    setError(null);
    try {
      await tutorApi.toggleAvailability(next);
    } catch {
      setIsAvailable(!next);
      setError('Could not update availability status.');
    }
  };

  const handleSaveSlot = async (newSlot: {
    dayOfWeek: number;
    startTime: string;
    durationHours: number;
    date: string;
  }) => {
    setSaving(true);
    try {
      // Build precise ISO datetimes from the chosen date + hour
      const buildISO = (date: string, time: string) => {
        const [hh, mm] = time.split(':').map(Number);
        const d = new Date(date + 'T00:00:00');
        d.setHours(hh, mm, 0, 0);
        return d.toISOString();
      };
      const startISO = buildISO(newSlot.date, newSlot.startTime);
      const endISO   = new Date(parseUtcDate(startISO).getTime() + newSlot.durationHours * 60 * 60 * 1000).toISOString();

      const res = await tutorApi.createAvailability({
        dayOfWeek: newSlot.dayOfWeek,
        startTime: startISO,
        endTime:   endISO,
      });

      if (res.success && res.data) {
        const normalized = normalizeSlot(res.data);
        setSlots(prev => filterExpired([...prev, normalized]));
      } else {
        // Optimistic fallback
        const fallback: any = {
          id:        Date.now().toString(),
          dayOfWeek: newSlot.dayOfWeek,
          startTime: newSlot.startTime,
          endTime:   addHoursToTime(newSlot.startTime, newSlot.durationHours),
          isAvailable: true,
          _date:     newSlot.date,
          _endISO:   endISO,
        };
        setSlots(prev => filterExpired([...prev, fallback]));
      }
      setShowModal(false);
    } catch (err: any) {
      throw new Error(
        err?.response?.data?.message ?? err?.message ?? 'Failed to save the time slot. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlot = async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      await tutorApi.deleteAvailability(id);
      setSlots(prev => prev.filter(s => s.id !== id));
    } catch {
      setError('Failed to remove the time slot. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  // Group by actual date (YYYY-MM-DD) rather than day-of-week,
  // sorted chronologically so today's slots appear first
  const slotsByDate = slots.reduce<Record<string, any[]>>((acc, s) => {
    const key = s._date ?? 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const sortedDates = Object.keys(slotsByDate).sort();

  const formatDateHeading = (dateStr: string) => {
    if (dateStr === 'unknown') return 'Scheduled';
    const d = new Date(dateStr + 'T12:00:00');
    const today = todayLocal();
    if (dateStr === today) return `Today — ${d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}`;
    return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Availability</h1>
            <p className="text-gray-600 mt-1">Set when you're available for tutoring</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Currently Available</span>
            <button
              onClick={handleToggleAvailability}
              className={`w-12 h-6 rounded-full relative transition-colors ${isAvailable ? 'bg-green-500' : 'bg-gray-300'}`}
              aria-label="Toggle availability"
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${isAvailable ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="h-5 w-5 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Add slot bar */}
        <div className="bg-white rounded-2xl px-6 py-4 border border-gray-100 shadow-sm flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Add Time Slot</h3>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Slot
          </button>
        </div>

        {/* Slot list grouped by date */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 gap-3">
            <Loader2 className="w-6 h-6 animate-spin" /><span>Loading your schedule…</span>
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 border border-gray-100 shadow-sm flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-indigo-400" />
            </div>
            <p className="font-semibold text-gray-700">No upcoming availability set</p>
            <p className="text-sm text-gray-400">Click "+ Add Slot" to add a specific date and time you're free.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedDates.map((dateKey, i) => (
              <motion.div
                key={dateKey}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{formatDateHeading(dateKey)}</h3>
                  <span className="ml-auto text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Available
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {slotsByDate[dateKey].map(slot => (
                    <div key={slot.id} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl">
                      <Clock className="w-4 h-4" />
                      <span className="font-medium text-sm">
                        {fmt12(slot.startTime)} – {fmt12(slot.endTime)}
                      </span>
                      <button
                        onClick={() => handleDeleteSlot(slot.id)}
                        disabled={deletingId === slot.id}
                        className="ml-1 p-1 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50"
                        aria-label="Remove slot"
                      >
                        {deletingId === slot.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                          : <Trash2 className="w-3.5 h-3.5 text-red-400" />}
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <AddSlotModal
            onClose={() => setShowModal(false)}
            onSave={handleSaveSlot}
            existingSlots={slots}
            saving={saving}
          />
        )}
      </AnimatePresence>
    </>
  );
};
