import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../shared/hooks/useAuth';
import { StatCard } from '../../dashboard/components/StatCard';
import { SessionCard } from '../../dashboard/components/SessionCard';
import { TokenDisplay } from '../../dashboard/components/TokenDisplay';
import { Calendar, Clock, Loader2, Star, Users, TrendingUp, DollarSign } from 'lucide-react';
import type { Session } from '../tutor';
import { sessionApi } from '../../../api/sessionApi';
import { walletApi } from '../../../api/walletApi';

export const Overview: React.FC = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [sessionResponse, walletResponse] = await Promise.all([
        sessionApi.getTutorSessions(),
        walletApi.getWallet()
      ]);
      setSessions(sessionResponse.data);
      setBalance(walletResponse.data.balance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const stats = useMemo(() => {
    const completed = sessions.filter(session => session.status === 'completed');
    const active = sessions.filter(session => ['pending', 'confirmed', 'in-progress'].includes(session.status));
    const uniqueStudents = new Set(sessions.map(session => session.tuteeId).filter(Boolean));
    const totalFinished = sessions.filter(session => ['completed', 'cancelled', 'declined'].includes(session.status)).length;

    return {
      totalSessions: sessions.length,
      totalStudents: uniqueStudents.size,
      rating: 0,
      upcomingSessions: active.length,
      completionRate: totalFinished ? Math.round((completed.length / totalFinished) * 100) : 0,
      hoursTutored: completed.reduce((sum, session) => sum + session.duration / 60, 0)
    };
  }, [sessions]);

  const upcomingSessions = sessions
    .filter(session => ['pending', 'confirmed', 'in-progress'].includes(session.status))
    .slice(0, 3);

  const handleComplete = async (id: string) => {
    await sessionApi.completeSession(id);
    await loadOverview();
  };

  const handleCancel = async (id: string) => {
    await sessionApi.cancelSession(id);
    await loadOverview();
  };

  const handleJoin = (session: Session) => {
    if (session.meetingLink) {
      window.open(session.meetingLink, '_blank');
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.firstName || 'Tutor'}!</h1>
        <p className="text-gray-600 mt-1">Here's what's happening with your tutoring</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Total Sessions"
          value={stats.totalSessions}
          subtitle={`${stats.upcomingSessions} upcoming`}
          icon={Calendar}
          color="indigo"
        />
        <StatCard
          title="Students Helped"
          value={stats.totalStudents}
          subtitle="Unique students"
          icon={Users}
          color="purple"
          trend="up"
          trendValue="+15%"
        />
        <StatCard
          title="Your Rating"
          value={stats.rating}
          subtitle="From tutor reviews"
          icon={Star}
          color="amber"
        />
        <StatCard
          title="Hours Tutored"
          value={stats.hoursTutored.toFixed(1)}
          subtitle="Completed sessions"
          icon={Clock}
          color="green"
          trend="up"
          trendValue="+8 hrs"
        />
        <StatCard
          title="Completion Rate"
          value={`${stats.completionRate}%`}
          subtitle="Reliability score"
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Next Session"
          value={upcomingSessions[0] ? new Date(upcomingSessions[0].scheduledAt).toLocaleDateString('en-KE') : 'None'}
          subtitle={upcomingSessions[0] ? `${upcomingSessions[0].subject} with ${upcomingSessions[0].tuteeName}` : 'No upcoming session'}
          icon={DollarSign}
          color="indigo"
        />
      </div>

      {/* Upcoming Sessions */}
      <div>
        <div className="flex items-center justify-between mb-4">
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
      <div className="bg-indigo-50 rounded-2xl p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <a href="/dashboard/availability" className="px-4 py-2 bg-white text-indigo-600 font-medium rounded-lg shadow-sm hover:shadow-md transition-all">
            Update Availability
          </a>
          <a href="/dashboard/earnings" className="px-4 py-2 bg-white text-indigo-600 font-medium rounded-lg shadow-sm hover:shadow-md transition-all">
            Withdraw Earnings
          </a>
          <a href="/dashboard/profile" className="px-4 py-2 bg-white text-indigo-600 font-medium rounded-lg shadow-sm hover:shadow-md transition-all">
            Edit Profile
          </a>
        </div>
      </div>
    </div>
  );
};
