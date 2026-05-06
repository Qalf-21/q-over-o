import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Plus, Trash2, AlertCircle } from 'lucide-react';
import { AuthButton } from '../../../shared/components/AuthButton';
import type { TimeSlot } from '../../../types/tutor';

interface AvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingSlots: TimeSlot[];
  onSave: (slots: TimeSlot[]) => void;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const AvailabilityModal: React.FC<AvailabilityModalProps> = ({
  isOpen,
  onClose,
  existingSlots,
  onSave
}) => {
  const [slots, setSlots] = useState<TimeSlot[]>(existingSlots);
  const [isEditing, setIsEditing] = useState(false);
  const [newSlot, setNewSlot] = useState({
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '17:00'
  });
  const [error, setError] = useState<string | null>(null);

  const handleAddSlot = () => {
    // Check for conflicts
    const hasConflict = slots.some(slot => 
      slot.dayOfWeek === newSlot.dayOfWeek &&
      ((newSlot.startTime >= slot.startTime && newSlot.startTime < slot.endTime) ||
       (newSlot.endTime > slot.startTime && newSlot.endTime <= slot.endTime))
    );

    if (hasConflict) {
      setError('This time slot conflicts with an existing slot');
      return;
    }

    const slot: TimeSlot = {
      id: Date.now().toString(),
      ...newSlot,
      isAvailable: true
    };

    setSlots([...slots, slot]);
    setIsEditing(false);
    setError(null);
  };

  const handleDeleteSlot = (id: string) => {
    setSlots(slots.filter(s => s.id !== id));
  };

  const handleSave = () => {
    onSave(slots);
    onClose();
  };

  const groupedSlots = DAYS.map((day, index) => ({
    day,
    dayIndex: index,
    daySlots: slots.filter(s => s.dayOfWeek === index)
  }));

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-auto shadow-2xl"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Manage Availability</h2>
                <p className="text-sm text-gray-500 mt-1">Set when students can book you</p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Add New Slot */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Add Time Slot</h3>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Slot
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setError(null);
                      }}
                      className="text-gray-500 hover:text-gray-700 text-sm"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {isEditing && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                        <select
                          value={newSlot.dayOfWeek}
                          onChange={(e) => setNewSlot({...newSlot, dayOfWeek: parseInt(e.target.value)})}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-indigo-500 outline-none"
                        >
                          {DAYS.map((day, i) => (
                            <option key={i} value={i}>{day}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
                        <input
                          type="time"
                          value={newSlot.startTime}
                          onChange={(e) => setNewSlot({...newSlot, startTime: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
                        <input
                          type="time"
                          value={newSlot.endTime}
                          onChange={(e) => setNewSlot({...newSlot, endTime: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-indigo-500 outline-none"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleAddSlot}
                      className="w-full py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                    >
                      Save Slot
                    </button>
                  </motion.div>
                )}
              </div>

              {/* Current Schedule */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">Your Schedule</h3>
                
                {slots.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <Clock className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">No availability set</p>
                    <p className="text-sm text-gray-400">Add time slots so students can book you</p>
                  </div>
                ) : (
                  groupedSlots.map(({ day, dayIndex, daySlots }) => (
                    daySlots.length > 0 && (
                      <div key={dayIndex} className="bg-white border border-gray-100 rounded-xl p-4">
                        <h4 className="font-medium text-gray-900 mb-3">{day}</h4>
                        <div className="flex flex-wrap gap-2">
                          {daySlots.map(slot => (
                            <div
                              key={slot.id}
                              className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm"
                            >
                              <Clock className="w-4 h-4" />
                              <span className="font-medium">{slot.startTime} - {slot.endTime}</span>
                              <button
                                onClick={() => handleDeleteSlot(slot.id)}
                                className="ml-1 p-1 hover:bg-indigo-100 rounded transition-colors"
                              >
                                <Trash2 className="w-3 h-3 text-red-500" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  ))
                )}
              </div>

              {/* Save Button */}
              <div className="sticky bottom-0 bg-white pt-4 border-t">
                <AuthButton onClick={handleSave}>
                  Save Availability
                </AuthButton>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};