import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, Loader2, Video, CheckCircle2, Star, XCircle } from 'lucide-react';
import { ReviewModal } from '../components/ReviewModal';
import type { TuteeSession, ReviewSubmission } from '../../../types/tutor';
import { reviewApi } from '../../../api/reviewApi';
import { sessionApi } from '../../../api/sessionApi';

export const MySessions: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed'>('upcoming');
  const [sessions, setSessions] = useState<TuteeSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewSession, setReviewSession] = useState<TuteeSession | null>(null);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await sessionApi.getTuteeSessions();
      setSessions(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const filteredSessions = sessions.filter(session => {
    if (activeTab === 'upcoming') {
      return ['pending', 'confirmed', 'in-progress'].includes(session.status);
    }
    return session.status === 'completed';
  });

  const handleJoinSession = (session: TuteeSession) => {
    if (session.meetingLink) {
      window.open(session.meetingLink, '_blank');
    }
  };

  const handleCancel = async (sessionId: string) => {
    try {
      await sessionApi.cancelSession(sessionId);
      await loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel session');
    }
  };

  const handleReviewSubmit = async (review: ReviewSubmission) => {
    await reviewApi.createReview(review);
    await loadSessions();
    setReviewSession(null);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-amber-100 text-amber-700',
      'confirmed': 'bg-green-100 text-green-700',
      'in-progress': 'bg-blue-100 text-blue-700',
      'completed': 'bg-gray-100 text-gray-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Sessions</h1>
        <p className="text-gray-600 mt-1">Track and manage your tutoring appointments</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit">
        {(['upcoming', 'completed'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded-lg font-medium capitalize transition-all ${
              activeTab === tab
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Sessions List */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
      <AnimatePresence mode="popLayout">
        {filteredSessions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300"
          >
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No {activeTab} sessions</h3>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {filteredSessions.map(session => (
              <motion.div
                key={session.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-bold">
                      {session.tutorName[0]}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{session.tutorName}</h3>
                      <p className="text-sm text-gray-500">{session.subject} • {session.topic}</p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(session.scheduledAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(session.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${getStatusColor(session.status)}`}>
                      {session.status.replace('-', ' ')}
                    </span>
                    <span className="font-bold text-indigo-600">{session.tokenAmount} tokens</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
                  {session.status === 'confirmed' && (
                    <button
                      onClick={() => handleJoinSession(session)}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-md transition-all"
                    >
                      <Video className="w-4 h-4" />
                      Join Session
                    </button>
                  )}
                  
                  {session.status === 'completed' && !session.hasReviewed && (
                    <button
                      onClick={() => setReviewSession(session)}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg font-medium hover:bg-amber-200 transition-colors"
                    >
                      <Star className="w-4 h-4" />
                      Leave Review
                    </button>
                  )}

                  {session.hasReviewed && (
                    <span className="flex items-center gap-2 px-4 py-2 text-green-600 text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      Reviewed
                    </span>
                  )}

                  {['pending', 'confirmed'].includes(session.status) && (
                    <button
                      onClick={() => handleCancel(session.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg font-medium hover:bg-red-100 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      Cancel
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
      )}

      <ReviewModal
        session={reviewSession}
        onClose={() => setReviewSession(null)}
        onSubmit={handleReviewSubmit}
      />
    </div>
  );
};
