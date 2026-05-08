// src/features/tutor/pages/Availability.tsx  — FULL REPLACEMENT
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Plus, Trash2, Calendar, CheckCircle2, Loader2, AlertCircle, X } from 'lucide-react';
import { tutorApi } from '../../../api/tutorApi';
import type { TimeSlot } from '../tutor';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIME_OPTIONS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00', '22:00',
];

const fmt12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
};

const toHHMM = (iso: string) => new Date(iso).toTimeString().slice(0, 5);

const normalizeSlot = (slot: any): TimeSlot => {
  const startRaw = slot.start_time ?? slot.startTime;
  const endRaw   = slot.end_time   ?? slot.endTime;
  if (startRaw && startRaw.includes('T')) {
    const start = new Date(startRaw);
    const end   = new Date(endRaw);
    return {
      id:          slot.id,
      dayOfWeek:   start.getDay(),
      startTime:   toHHMM(start.toISOString()),
      endTime:     toHHMM(end.toISOString()),
      isAvailable: slot.is_available ?? slot.isAvailable ?? true,
    };
  }
  return {
    id:          slot.id,
    dayOfWeek:   slot.dayOfWeek ?? slot.day_of_week ?? 0,
    startTime:   startRaw ?? '',
    endTime:     endRaw   ?? '',
    isAvailable: slot.isAvailable ?? slot.is_available ?? true,
  };
};

const nextOccurrence = (targetDay: number, time: string): string => {
  const [hh, mm] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  const daysAhead = (targetDay - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString();
};

interface AddSlotModalProps {
  onClose: () => void;
  onSave: (slot: { dayOfWeek: number; startTime: string; endTime: string; date?: string }) => Promise<void>;
  existingSlots: TimeSlot[];
  saving: boolean;
}

const AddSlotModal: React.FC<AddSlotModalProps> = ({ onClose, onSave, existingSlots, saving }) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [startTime, setStart]           = useState('');
  const [endTime, setEnd]               = useState('');
  const [modalError, setModalError]     = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Min date = tomorrow (slots must be in the future per backend)
  const minDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  const dayOfWeek = selectedDate ? new Date(selectedDate + 'T12:00:00').getDay() : -1;
  const endOptions = startTime ? TIME_OPTIONS.filter(t => t > startTime) : TIME_OPTIONS;

  const handleSave = async () => {
    if (!selectedDate)          { setModalError('Please select a date.'); return; }
    if (!startTime || !endTime) { setModalError('Please select both a start and end time.'); return; }
    if (startTime >= endTime)   { setModalError('Start time must be before end time.'); return; }
    const conflict = existingSlots.some(
      s => s.dayOfWeek === dayOfWeek &&
        ((startTime >= s.startTime && startTime < s.endTime) ||
         (endTime > s.startTime && endTime <= s.endTime) ||
         (startTime <= s.startTime && endTime >= s.endTime))
    );
    if (conflict) { setModalError('This time overlaps with an existing slot on that day.'); return; }
    setModalError(null);
    try {
      await onSave({ dayOfWeek, startTime, endTime, date: selectedDate });
    } catch (err: any) {
      // Surface any API-level rejection back into the modal
      setModalError(err?.message ?? 'Failed to save the time slot. Please try again.');
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Add Availability Slot</h2>
            <p className="text-sm text-gray-500 mt-0.5">Set a recurring weekly window when you're free</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Date picker */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" /> Select Date
            </p>
            <input
              type="date"
              min={minDate}
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-gray-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            />
            {selectedDate && (
              <p className="mt-2 text-xs text-indigo-600 font-medium">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}
          </div>

          {/* Start time */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" /> Start Time
            </p>
            <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
              {TIME_OPTIONS.filter(t => !endTime || t < endTime).map(t => (
                <button key={t} onClick={() => { setStart(t); if (endTime && endTime <= t) setEnd(''); }}
                  className={`py-2 rounded-xl text-sm font-medium transition-all ${
                    startTime === t ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-50 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600'
                  }`}
                >
                  {fmt12(t)}
                </button>
              ))}
            </div>
          </div>

          {/* End time */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" /> End Time
              {!startTime && <span className="text-xs text-gray-400 font-normal">(pick a start first)</span>}
            </p>
            <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
              {endOptions.map(t => (
                <button key={t} onClick={() => setEnd(t)} disabled={!startTime}
                  className={`py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    endTime === t ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-50 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600'
                  }`}
                >
                  {fmt12(t)}
                </button>
              ))}
            </div>
          </div>

          {/* Summary pill */}
          {selectedDate && startTime && endTime && (
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-indigo-700 font-medium">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <span className="text-sm font-bold text-indigo-900">{fmt12(startTime)} – {fmt12(endTime)}</span>
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
        <div className="px-6 pb-6">
          <button onClick={handleSave} disabled={saving || !selectedDate || !startTime || !endTime}
            className="w-full py-3 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : 'Save Slot'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export const Availability: React.FC = () => {
  const [slots, setSlots]               = useState<TimeSlot[]>([]);
  const [isAvailable, setIsAvailable]   = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [error, setError]               = useState<string | null>(null);

  const fetchAvailability = useCallback(async () => {
    setLoading(true);
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
      if (res.success) setSlots((res.data as any[] ?? []).map(normalizeSlot));
    } else {
      setError('Could not load your saved time slots. You can still add new ones.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAvailability(); }, [fetchAvailability]);

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

  const handleSaveSlot = async (newSlot: { dayOfWeek: number; startTime: string; endTime: string; date?: string }) => {
    setSaving(true);
    try {
      const buildISO = (date: string | undefined, day: number, time: string) => {
        if (date) {
          const [hh, mm] = time.split(':').map(Number);
          const d = new Date(date + 'T00:00:00');
          d.setHours(hh, mm, 0, 0);
          return d.toISOString();
        }
        return nextOccurrence(day, time);
      };
      const startISO = buildISO(newSlot.date, newSlot.dayOfWeek, newSlot.startTime);
      const endISO   = buildISO(newSlot.date, newSlot.dayOfWeek, newSlot.endTime);
      const res = await tutorApi.createAvailability({ dayOfWeek: newSlot.dayOfWeek, startTime: startISO, endTime: endISO });
      if (res.success && res.data) {
        setSlots(prev => [...prev, normalizeSlot(res.data)]);
      } else {
        // Optimistic fallback if backend didn't return the slot
        setSlots(prev => [...prev, { id: Date.now().toString(), ...newSlot, isAvailable: true }]);
      }
      setShowModal(false);
    } catch (err: any) {
      // Re-throw so AddSlotModal can display the message inline
      throw new Error(err?.response?.data?.message ?? err?.message ?? 'Failed to save the time slot. Please try again.');
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

  // ── Only render days that have at least one slot ───────────────────────────
  const daysWithSlots = DAYS
    .map((day, index) => ({ day, dayIndex: index, slots: slots.filter(s => s.dayOfWeek === index) }))
    .filter(({ slots: daySlots }) => daySlots.length > 0);

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
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

        {/* Weekly schedule — only days with slots are shown */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 gap-3">
            <Loader2 className="w-6 h-6 animate-spin" /><span>Loading your schedule…</span>
          </div>
        ) : daysWithSlots.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 border border-gray-100 shadow-sm flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-indigo-400" />
            </div>
            <p className="font-semibold text-gray-700">No availability set yet</p>
            <p className="text-sm text-gray-400">Click "+ Add Slot" to set your first available time window.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {daysWithSlots.map(({ day, dayIndex, slots: daySlots }) => (
              <motion.div
                key={day}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: dayIndex * 0.04 }}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{day}</h3>
                  <span className="ml-auto text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Available
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {daySlots.map(slot => (
                    <div key={slot.id} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl">
                      <Clock className="w-4 h-4" />
                      <span className="font-medium text-sm">{fmt12(slot.startTime)} – {fmt12(slot.endTime)}</span>
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
