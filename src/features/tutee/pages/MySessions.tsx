import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, Filter, Loader2, Search, Video, CheckCircle2, Star, XCircle } from 'lucide-react';
import { ReviewModal } from '../components/ReviewModal';
import type { TuteeSession, ReviewSubmission } from '../../../types/tutor';
import { reviewApi } from '../../../api/reviewApi';
import { sessionApi } from '../../../api/sessionApi';

export const MySessions: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'declined'>('all');
  const [searchQuery, setSearchQuery] = useState('');
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

  const filters: { value: typeof activeFilter; label: string }[] = [
    { value: 'all', label: 'All Sessions' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'declined', label: 'Declined' },
  ];

  const filteredSessions = sessions.filter(session => {
    const matchesFilter = activeFilter === 'all' || session.status === activeFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      session.tutorName.toLowerCase().includes(query) ||
      session.subject.toLowerCase().includes(query) ||
      session.topic.toLowerCase().includes(query) ||
      session.status.replace('-', ' ').includes(query);
    return matchesFilter && matchesSearch;
  });

  const handleJoinSession = (session: TuteeSession) => {
    if (session.meetingLink) {
      window.open(session.meetingLink, '_blank');
    }
  };

  const canJoinSession = (session: TuteeSession) => {
    const scheduledAt = new Date(session.scheduledAt);
    const now = new Date();
    return (
      ['confirmed', 'in-progress'].includes(session.status) &&
      Boolean(session.meetingLink) &&
      now >= new Date(scheduledAt.getTime() - 5 * 60 * 1000) &&
      now <= new Date(scheduledAt.getTime() + 10 * 60 * 1000)
    );
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
      'completed': 'bg-gray-100 text-gray-700',
      'cancelled': 'bg-red-100 text-red-700',
      'declined': 'bg-gray-100 text-gray-500'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Sessions</h1>
        <p className="text-gray-600 mt-1">Track and manage your tutoring appointments</p>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>{filteredSessions.length} sessions</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
          <Filter className="w-4 h-4" />
          Filters
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {filters.map(filter => (
            <button
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeFilter === filter.value
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
          />
        </div>
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
            <h3 className="text-lg font-medium text-gray-900">No sessions found</h3>
            <p className="text-gray-500">Try adjusting your filters or search query</p>
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
                          {session.scheduledEnd
                            ? `${new Date(session.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(session.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : new Date(session.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                  {canJoinSession(session) && (
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
