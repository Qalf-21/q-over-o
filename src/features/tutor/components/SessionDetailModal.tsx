import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Calendar, BookOpen, Video, MessageSquare } from 'lucide-react';
import type { Session } from '../../../types/tutor';
import { parseUtcDate } from '../../../utils/dateTime';

interface SessionDetailModalProps {
  session: Session | null;
  onClose: () => void;
  onJoin?: (session: Session) => void;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
}

export const SessionDetailModal: React.FC<SessionDetailModalProps> = ({
  session,
  onClose,
  onJoin,
  onAccept,
  onDecline
}) => {
  if (!session) return null;

  const scheduledDate = parseUtcDate(session.scheduledAt);
  const formattedDate = scheduledDate.toLocaleDateString('en-KE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const formattedTime = scheduledDate.toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const statusColors = {
    'pending': 'bg-amber-100 text-amber-700',
    'confirmed': 'bg-green-100 text-green-700',
    'in-progress': 'bg-blue-100 text-blue-700',
    'completed': 'bg-gray-100 text-gray-700',
    'cancelled': 'bg-red-100 text-red-700',
    'declined': 'bg-gray-100 text-gray-500'
  };

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
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Session Details</h2>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <span
                className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                    statusColors[session.status]
                }`}
            >
              {session.status.replace('-', ' ')}
            </span>
          </div>

          <div className="p-6 space-y-6">
            {/* Tutee Info */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white text-xl font-bold">
                {session.tuteeName[0]}
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{session.tuteeName}</h3>
                <p className="text-gray-500">Student</p>
              </div>
            </div>

            {/* Session Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <BookOpen className="w-4 h-4" />
                  <span className="text-sm">Subject</span>
                </div>
                <p className="font-semibold text-gray-900">{session.subject}</p>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <MessageSquare className="w-4 h-4" />
                  <span className="text-sm">Topic</span>
                </div>
                <p className="font-semibold text-gray-900">{session.topic}</p>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">Date</span>
                </div>
                <p className="font-semibold text-gray-900">{formattedDate}</p>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Time</span>
                </div>
                <p className="font-semibold text-gray-900">{formattedTime} ({session.duration} mins)</p>
              </div>
            </div>

            {/* Payment Info */}
            <div className="bg-indigo-50 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-indigo-600 font-medium">Earnings</p>
                <p className="text-2xl font-bold text-indigo-700">{session.tokenAmount} tokens</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-indigo-600">≈ KES {(session.tokenAmount * 2).toLocaleString()}</p>
              </div>
            </div>

            {/* Notes */}
            {session.notes && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-500 mb-1">Student Notes</p>
                <p className="text-gray-700">{session.notes}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              {session.status === 'pending' && (
                <>
                  <button
                    onClick={() => onDecline?.(session.id)}
                    className="flex-1 py-3 border-2 border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50 transition-colors"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => onAccept?.(session.id)}
                    className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors"
                  >
                    Accept Session
                  </button>
                </>
              )}

              {(session.status === 'confirmed' || session.status === 'in-progress') && (
                <button
                  onClick={() => onJoin?.(session)}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Video className="w-5 h-5" />
                  Join Video Session
                </button>
              )}

              {session.status === 'completed' && (
                <div className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-center">
                  Session Completed
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
