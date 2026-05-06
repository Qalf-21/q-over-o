import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Plus, Trash2, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import type { TimeSlot } from '../tutor';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const Availability: React.FC = () => {
  const [slots] = useState<TimeSlot[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [newSlot, setNewSlot] = useState({ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' });

  const groupedSlots = DAYS.map((day, index) => ({
    day,
    dayIndex: index,
    slots: slots.filter(s => s.dayOfWeek === index)
  }));

  const handleAddSlot = () => {
    setIsEditing(false);
  };

  const handleDeleteSlot = (_id: string) => {
    setIsEditing(false);
  };

  const handleToggleAvailability = () => {
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Availability</h1>
          <p className="text-gray-600 mt-1">Set when you're available for tutoring</p>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Currently Available</span>
          <button 
            onClick={handleToggleAvailability}
            className="w-12 h-6 bg-green-500 rounded-full relative transition-colors"
          >
            <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        Availability cannot be edited until the backend exposes an endpoint for it. No mock slots are displayed.
      </div>

      {/* Add New Slot */}
      <motion.div 
        initial={false}
        className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Add Time Slot</h3>
          {!isEditing ? (
            <button 
              disabled
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-500 rounded-lg cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Add Slot
            </button>
          ) : (
            <button 
              onClick={() => setIsEditing(false)}
              className="text-gray-500 hover:text-gray-700"
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Day</label>
                <select 
                  value={newSlot.dayOfWeek}
                  onChange={(e) => setNewSlot({...newSlot, dayOfWeek: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                >
                  {DAYS.map((day, i) => (
                    <option key={i} value={i}>{day}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                <input 
                  type="time"
                  value={newSlot.startTime}
                  onChange={(e) => setNewSlot({...newSlot, startTime: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                <input 
                  type="time"
                  value={newSlot.endTime}
                  onChange={(e) => setNewSlot({...newSlot, endTime: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>
            </div>
            <button 
              onClick={handleAddSlot}
              disabled
              className="w-full sm:w-auto px-6 py-2 bg-gray-200 text-gray-500 rounded-lg cursor-not-allowed font-medium"
            >
              Save Slot
            </button>
          </motion.div>
        )}
      </motion.div>

      {/* Weekly Schedule */}
      <div className="space-y-4">
        {groupedSlots.map(({ day, dayIndex, slots: daySlots }) => (
          <motion.div 
            key={day}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: dayIndex * 0.05 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="font-semibold text-gray-900">{day}</h3>
              {daySlots.length > 0 && (
                <span className="ml-auto text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Available
                </span>
              )}
            </div>

            {daySlots.length === 0 ? (
              <p className="text-gray-400 text-sm">No availability set</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {daySlots.map(slot => (
                  <div 
                    key={slot.id}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg"
                  >
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">{slot.startTime} - {slot.endTime}</span>
                    <button 
                      onClick={() => handleDeleteSlot(slot.id)}
                      className="ml-2 p-1 hover:bg-indigo-100 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};
