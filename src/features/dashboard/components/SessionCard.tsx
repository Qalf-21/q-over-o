import React from 'react';
import { motion } from 'framer-motion';
import { Video, Clock, User, CheckCircle, XCircle, PlayCircle } from 'lucide-react';
import type { Session } from '../../../types/tutor';

interface SessionCardProps {
  session: Session;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onComplete?: (id: string) => void;
  onCancel?: (id: string) => void;
  onJoin?: (session: Session) => void;
  onClick?: (session: Session) => void;
}

export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  onAccept,
  onDecline,
  onComplete,
  onCancel,
  onJoin,
  onClick
}) => {
  const statusColors = {
    'pending': 'bg-amber-100 text-amber-700 border-amber-200',
    'confirmed': 'bg-green-100 text-green-700 border-green-200',
    'in-progress': 'bg-blue-100 text-blue-700 border-blue-200',
    'completed': 'bg-gray-100 text-gray-700 border-gray-200',
    'cancelled': 'bg-red-100 text-red-700 border-red-200',
    'declined': 'bg-gray-100 text-gray-500 border-gray-200'
  };

  const isPending = session.status === 'pending';
  const isConfirmed = session.status === 'confirmed';
  const scheduledDate = new Date(session.scheduledAt);
  const now = new Date();
  const canJoin =
    (session.status === 'confirmed' || session.status === 'in-progress') &&
    Math.abs(now.getTime() - scheduledDate.getTime()) <= 15 * 60 * 1000;
  
  const formattedDate = scheduledDate.toLocaleDateString('en-KE', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
  const formattedTime = scheduledDate.toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
      onClick={() => onClick?.(session)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-bold text-lg">
            {session.tuteeName[0]}
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">{session.tuteeName}</h4>
            <p className="text-sm text-gray-500">{session.subject}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border capitalize ${statusColors[session.status]}`}>
          {session.status.replace('-', ' ')}
        </span>
        {isConfirmed && (
          <p className="text-xs text-green-600 mt-1 font-medium">
            Ready to start
           </p>
        )}
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="w-4 h-4" />
          <span>{formattedDate} at {formattedTime}</span>
          <span className="text-gray-400">({session.duration} mins)</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <User className="w-4 h-4" />
          <span>Topic: {session.topic}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Video className="w-4 h-4" />
          <span>Video session</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center gap-1">
          <span className="text-lg font-bold text-indigo-600">{session.tokenAmount}</span>
          <span className="text-sm text-gray-500">tokens</span>
        </div>

        <div className="flex gap-2">
          {isPending && (onAccept || onDecline || onCancel) && (
            <>
             {(onDecline || onCancel) && (
               <button
                 onClick={(e) => {
                  e.stopPropagation();
                  (onDecline || onCancel)?.(session.id);
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
               >
                <XCircle className="w-4 h-4" />
                {onDecline ? 'Decline' : 'Cancel'}
               </button>
             )}

             {onAccept && (
               <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAccept(session.id);
                 }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Accept
                </button>
             )}
           </>
          )}

          {isConfirmed && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel?.(session.id);
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onComplete?.(session.id);
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Complete
              </button>
            </>
          )}
          
          {canJoin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onJoin?.(session);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-md rounded-lg transition-all"
            >
              <PlayCircle className="w-4 h-4" />
              Join Session
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
