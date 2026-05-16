import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SessionCard } from '../../dashboard/components/SessionCard';
import { Calendar, Filter, Loader2, Search, Video } from 'lucide-react';
import type { Session } from '../tutor';
import { sessionApi } from '../../../api/sessionApi';

type SessionFilter = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'declined';

export const Sessions: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<SessionFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await sessionApi.getTutorSessions();
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

  const filters: { value: SessionFilter; label: string }[] = [
    { value: 'all', label: 'All Sessions' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'declined', label: 'Declined' }
  ];

  const filteredSessions = sessions.filter(session => {
    const matchesFilter = activeFilter === 'all' || session.status === activeFilter;
    const matchesSearch = session.tuteeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         session.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleComplete = async (id: string) => {
    try {
      await sessionApi.completeSession(id);
      await loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete session');
    }
  };

  const handleAccept = async (id: string) => {
    try {
      await sessionApi.acceptSession(id);
      await loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept session');
    }
  };

  const handleDecline = async (id: string) => {
    try {
      await sessionApi.declineSession(id);
      await loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline session');
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await sessionApi.cancelSession(id);
      await loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel session');
    }
  };

  const handleJoin = (session: Session) => {
    if (session.meetingLink) {
      window.open(session.meetingLink, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Video className="w-6 h-6 text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-900">My Sessions</h1>
        <p className="text-gray-600 mt-1">Manage your tutoring appointments</p>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>{filteredSessions.length} sessions</span>
      </div>

      {/* Filters and Search */}
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">No sessions found</h3>
            <p className="text-gray-500">Try adjusting your filters or search query</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {filteredSessions.map(session => (
              <SessionCard
                key={session.id}
                session={session}
                onAccept={handleAccept}
                onDecline={handleDecline}
                onComplete={handleComplete}
                onCancel={handleCancel}
                onJoin={handleJoin}
              />
            ))}
          </div>
        )}
      </AnimatePresence>
      )}
    </div>
  );
};
