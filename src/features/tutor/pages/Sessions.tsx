import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SessionCard } from '../../dashboard/components/SessionCard';
import { Calendar, Filter, Loader2, Search, Video } from 'lucide-react';
import type { Session } from '../tutor';
import { sessionApi } from '../../../api/sessionApi';
import { useAutoRefresh } from '../../../shared/hooks/useAutoRefresh';

type SessionFilter = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'declined';

export const Sessions: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<SessionFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);
      const response = await sessionApi.getTutorSessions();
      setSessions(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useAutoRefresh(() => loadSessions(true), { intervalMs: 15_000 });

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
    <div className="app-page">
      <div className="app-page-header">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <h1 className="app-page-title">My Sessions</h1>
            <p className="app-page-subtitle">Review requests, join confirmed sessions, and close completed tutoring work.</p>
          </div>
        </div>
        <span className="app-badge bg-slate-100 text-slate-600">{filteredSessions.length} sessions</span>
      </div>

      {/* Filters and Search */}
      <div className="app-panel flex flex-col gap-4 sm:flex-row sm:items-center">
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
                  ? 'app-filter-chip-active'
                  : 'app-filter-chip'
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
            className="app-input pl-10"
          />
        </div>
      </div>

      {/* Sessions List */}
      {error && (
        <div className="app-alert-error">{error}</div>
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
            className="app-empty-state"
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
