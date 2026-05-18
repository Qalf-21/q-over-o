import React from 'react';
import { motion } from 'framer-motion';
import { Video, Clock, User, CheckCircle, XCircle, PlayCircle } from 'lucide-react';
import type { Session } from '../../../types/tutor';
import { parseUtcDate } from '../../../utils/dateTime';

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
  const scheduledDate = parseUtcDate(session.scheduledAt);
  const scheduledEndDate = session.scheduledEnd
    ? parseUtcDate(session.scheduledEnd)
    : new Date(scheduledDate.getTime() + session.duration * 60 * 1000);
  const now = new Date();
  const joinOpensAt = new Date(scheduledDate.getTime() - 5 * 60 * 1000);
  const joinClosesAt = new Date(scheduledEndDate.getTime() + 10 * 60 * 1000);
  const canJoin =
    (session.status === 'confirmed' || session.status === 'in-progress') &&
    Boolean(session.meetingLink) &&
    now >= joinOpensAt &&
    now <= joinClosesAt;
  
  const formattedDate = scheduledDate.toLocaleDateString('en-KE', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
  const formattedTime = scheduledDate.toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit'
  });
  const formattedEndTime = session.scheduledEnd
    ? scheduledEndDate.toLocaleTimeString('en-KE', {
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="app-card app-card-hover cursor-pointer p-5"
      onClick={() => onClick?.(session)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-bold text-lg">
            {session.tuteeName[0]}
          </div>
          <div>
            <h4 className="font-semibold text-slate-900">{session.tuteeName}</h4>
            <p className="text-sm text-gray-500">{session.subject}</p>
          </div>
        </div>
        <span className={`app-badge border capitalize ${statusColors[session.status]}`}>
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
          <span>{formattedDate} at {formattedEndTime ? `${formattedTime} - ${formattedEndTime}` : formattedTime}</span>
          <span className="text-gray-400">({session.duration} mins)</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <User className="w-4 h-4" />
          <span>Specific topic: {session.topic || 'Not provided'}</span>
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
                className="app-button-danger px-4 py-2"
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
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
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
                className="app-button-danger px-4 py-2"
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </button>

              {onComplete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onComplete(session.id);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  <CheckCircle className="w-4 h-4" />
                  Complete
                </button>
              )}
            </>
          )}
          
          {canJoin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onJoin?.(session);
              }}
              className="app-button-primary px-4 py-2"
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
