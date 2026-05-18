import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import { StatCard } from '../../dashboard/components/StatCard';
import { SessionCard } from '../../dashboard/components/SessionCard';
import { TokenDisplay } from '../../dashboard/components/TokenDisplay';
import { Calendar, Clock, Loader2, Star, Users, TrendingUp, DollarSign, Lock, BarChart3 } from 'lucide-react';
import type { Session } from '../tutor';
import type { TutorQualification } from '../../../types/tutor';
import { sessionApi } from '../../../api/sessionApi';
import { walletApi } from '../../../api/walletApi';
import { tutorApi } from '../../../api/tutorApi';
import { useAutoRefresh } from '../../../shared/hooks/useAutoRefresh';

export const Overview: React.FC = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [balance, setBalance] = useState(0);
  const [qualification, setQualification] = useState<TutorQualification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);
      const [sessionResponse, walletResponse, qualificationResponse] = await Promise.all([
        sessionApi.getTutorSessions(),
        walletApi.getWallet(),
        tutorApi.getMyQualification()
      ]);
      setSessions(sessionResponse.data);
      setBalance(walletResponse.data.balance);
      setQualification(qualificationResponse.data as TutorQualification);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useAutoRefresh(() => loadOverview(true), { intervalMs: 30_000 });

  const stats = useMemo(() => {
    const active = sessions.filter(session => ['pending', 'confirmed', 'in-progress'].includes(session.status));
    const uniqueStudents = new Set(sessions.map(session => session.tuteeId).filter(Boolean));
    const totalFinished = sessions.filter(session => ['completed', 'cancelled', 'declined'].includes(session.status)).length;
    const completedCount = qualification?.completedSessions ?? sessions.filter(session => session.status === 'completed').length;

    return {
      totalSessions: sessions.length,
      totalStudents: uniqueStudents.size,
      rating: qualification?.averageRating ?? 0,
      upcomingSessions: active.length,
      completionRate: totalFinished ? Math.round((completedCount / totalFinished) * 100) : 0,
      hoursTutored: qualification?.hoursCompleted ?? 0,
      completedSessions: completedCount
    };
  }, [sessions, qualification]);

  const upcomingSessions = sessions
    .filter(session => ['pending', 'confirmed', 'in-progress'].includes(session.status))
    .slice(0, 3);

  const handleComplete = async (id: string) => {
    try {
      await sessionApi.completeSession(id);
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete session');
    }
  };

  const handleAccept = async (id: string) => {
    try {
      await sessionApi.acceptSession(id);
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept session');
    }
  };

  const handleDecline = async (id: string) => {
    try {
      await sessionApi.declineSession(id);
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline session');
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await sessionApi.cancelSession(id);
      await loadOverview();
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
      {/* Welcome Section */}
      <div className="app-page-header">
        <div>
          <h1 className="app-page-title">Welcome back, {user?.firstName || 'Tutor'}</h1>
          <p className="app-page-subtitle">Track tutoring activity, qualification progress, upcoming sessions, and wallet balance.</p>
        </div>
        <Link
          to="/dashboard/reports/performance"
          className="app-button-primary"
        >
          <BarChart3 className="h-4 w-4" />
          Performance Reports
        </Link>
      </div>

      {error && (
        <div className="app-alert-error">{error}</div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
      <>

      {/* Token Balance */}
      <TokenDisplay 
        label="Available Balance"
        amount={balance}
        subtitle="Current wallet balance"
        variant="large"
      />

      {/* Stats Grid */}
      {qualification && !qualification.qualified && (
        <div className="app-soft-panel">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Paid tutoring progress</h2>
              <p className="mt-1 text-sm text-indigo-800">
                You unlock paid tutoring after 30 session hours, 20 student reviews,
                and maintaining a 3.0+ rating.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm font-bold text-indigo-700">
              <Lock className="h-4 w-4" />
              {qualification.progressPercentage}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500"
              style={{ width: `${qualification.progressPercentage}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {qualification && !qualification.qualified ? (
          <>
            <StatCard title="Hours Remaining" value={qualification.hoursRemaining.toFixed(1)} subtitle={`${qualification.hoursCompleted.toFixed(1)} / 30 completed`} icon={Clock} color="indigo" />
            <StatCard title="Reviews Needed" value={qualification.reviewersRemaining} subtitle={`${qualification.uniqueReviewerCount} / 20 unique students`} icon={Users} color="purple" />
            <StatCard title="Current Rating" value={`${qualification.averageRating.toFixed(1)} / 5`} subtitle={qualification.ratingRemaining > 0 ? `${qualification.ratingRemaining.toFixed(1)} rating lift needed` : 'Rating requirement met'} icon={Star} color="amber" />
          </>
        ) : (
          <>
            <StatCard title="Total Hours" value={stats.hoursTutored.toFixed(1)} subtitle="Completed session hours" icon={Clock} color="green" />
            <StatCard title="Rating" value={`${stats.rating.toFixed(1)} / 5`} subtitle="From student reviews" icon={Star} color="amber" />
            <StatCard title="Completed Sessions" value={stats.completedSessions} subtitle={`${stats.upcomingSessions} upcoming`} icon={Calendar} color="indigo" />
            <StatCard title="Actual Earnings" value={balance.toLocaleString()} subtitle="Available tokens" icon={DollarSign} color="green" />
            <StatCard title="Students Helped" value={stats.totalStudents} subtitle="Unique students" icon={Users} color="purple" />
            <StatCard title="Completion Rate" value={`${stats.completionRate}%`} subtitle="Reliability score" icon={TrendingUp} color="green" />
          </>
        )}
      </div>

      {/* Upcoming Sessions */}
      <div className="app-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Upcoming Sessions</h2>
          <a href="/dashboard/sessions" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            View all →
          </a>
        </div>
        <div className="space-y-4">
          {upcomingSessions.map(session => (
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
      </div>
      </>
      )}

      {/* Quick Actions */}
      <div className="app-soft-panel">
        <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <a href="/dashboard/availability" className="app-button-secondary">
            Update Availability
          </a>
          <a href="/dashboard/earnings" className="app-button-secondary">
            Withdraw Earnings
          </a>
          <a href="/dashboard/profile" className="app-button-secondary">
            Edit Profile
          </a>
        </div>
      </div>
    </div>
  );
};
