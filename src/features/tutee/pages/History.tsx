import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { BarChart3, BookOpen, Clock, Loader2, TrendingUp } from 'lucide-react';
import type { TuteeSession } from '../tutor';
import { sessionApi } from '../../../api/sessionApi';
import { useAutoRefresh } from '../../../shared/hooks/useAutoRefresh';

export const History: React.FC = () => {
  const [sessions, setSessions] = useState<TuteeSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);
      const response = await sessionApi.getTuteeSessions();
      setSessions(response.data.filter(session => session.status === 'completed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load learning history');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useAutoRefresh(() => loadHistory(true), { intervalMs: 30_000 });

  const history = useMemo(() => {
    const totalHours = sessions.reduce((sum, session) => sum + session.duration / 60, 0);
    const totalSpent = sessions.reduce((sum, session) => sum + session.tokenAmount, 0);
    const subjectMap = new Map<string, { name: string; hours: number; sessions: number }>();

    sessions.forEach(session => {
      const current = subjectMap.get(session.subject) || { name: session.subject, hours: 0, sessions: 0 };
      current.hours += session.duration / 60;
      current.sessions += 1;
      subjectMap.set(session.subject, current);
    });

    return {
      totalSessions: sessions.length,
      totalHours,
      totalSpent,
      subjects: Array.from(subjectMap.values())
    };
  }, [sessions]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Learning History</h1>
        <p className="text-gray-600 mt-1">Track your progress and achievements</p>
        <Link
          to="/dashboard/reports/sessions"
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          <BarChart3 className="h-4 w-4" />
          Session Reports
        </Link>
      </div>

      {/* Stats Grid */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
      <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Sessions', value: history.totalSessions, icon: BookOpen, color: 'indigo' },
          { label: 'Hours Learned', value: history.totalHours.toFixed(1), icon: Clock, color: 'purple' },
          { label: 'Tokens Spent', value: history.totalSpent, icon: TrendingUp, color: 'green' }
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <div className={`w-10 h-10 rounded-xl bg-${stat.color}-100 flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-sm text-gray-500">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Subjects Breakdown */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-6">Learning by Subject</h3>
        <div className="space-y-4">
          {history.subjects.map((subject, index) => (
            <div key={subject.name}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-gray-900">{subject.name}</span>
                <span className="text-sm text-gray-500">{subject.sessions} sessions • {subject.hours.toFixed(1)} hours</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${history.totalHours ? (subject.hours / history.totalHours) * 100 : 0}%` }}
                  transition={{ delay: 0.5 + index * 0.1, duration: 0.5 }}
                  className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      </>
      )}
    </div>
  );
};
