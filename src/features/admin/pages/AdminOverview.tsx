// src/features/admin/pages/AdminOverview.tsx — FULL REPLACEMENT
//
// Rich Admin Overview Dashboard for Q-over-o.
// All data from DB via useAdminOverview hook — zero hardcoded values.

import React from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Coins,
  GraduationCap,
  RefreshCw,
  Shield,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
  Zap,
  ZapOff,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { AdminMetricCard } from '../components/AdminMetricCard';
import { AdminMiniChart } from '../components/AdminMiniChart';
import {
  AdminOverviewTable,
  StatusBadge,
  type TableColumn,
} from '../components/AdminOverviewTable';
import { useAdminOverview } from '../hooks/useAdminOverview';
import type {
  FlaggedReview,
  RecentPayment,
  RecentSession,
  RecentUser,
  TutorQualificationEntry,
} from '../types/admin';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fullName = (p?: { first_name: string; last_name: string } | null) =>
  p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || '—' : '—';

const fmt = (n: number) => n.toLocaleString();

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

const sessionTokens = (s: RecentSession) =>
  s.token_amount ?? s.amount_tokens ?? s.cost_tokens ?? 0;

const sessionDuration = (s: RecentSession) => {
  const mins =
    (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60_000;
  if (mins < 60) return `${Math.round(mins)} min`;
  return `${(mins / 60).toFixed(1)} hr`;
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-8 mb-4 text-xs font-semibold uppercase tracking-widest text-indigo-300">
      {children}
    </h2>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 py-16 text-center">
      <XCircle className="h-10 w-10 text-rose-400" />
      <div>
        <p className="text-base font-semibold text-white">Failed to load overview</p>
        <p className="mt-1 text-sm text-slate-400">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
    </div>
  );
}

// ── Tutor qualification row renderer ─────────────────────────────────────────

function QualProgress({ entry }: { entry: TutorQualificationEntry }) {
  if (entry.qualified) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-400">
        <CheckCircle2 className="h-4 w-4" />
        Qualified
      </span>
    );
  }

  const parts: string[] = [];
  if (entry.hoursRemaining > 0)
    parts.push(`${entry.hoursRemaining} hrs remaining`);
  if (entry.reviewsRemaining > 0)
    parts.push(`${entry.reviewsRemaining} reviews remaining`);
  if (!entry.ratingOk)
    parts.push(`rating ${entry.averageRating.toFixed(1)} < 3.0`);

  return (
    <div className="min-w-[180px]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-slate-500">{entry.progress}%</span>
        {entry.nearQualification && (
          <span className="rounded-full bg-amber-500/10 border border-amber-400/30 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
            Almost there
          </span>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500"
          style={{ width: `${entry.progress}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] text-slate-500 leading-relaxed">
        {parts.join(' · ')}
      </p>
    </div>
  );
}

// ── Table column definitions ──────────────────────────────────────────────────

const userColumns: TableColumn<RecentUser>[] = [
  {
    header: 'User',
    render: (r) => (
      <div>
        <p className="text-sm font-semibold text-white">{fullName(r)}</p>
        <p className="text-xs text-slate-400">{r.email}</p>
      </div>
    ),
  },
  {
    header: 'Role',
    render: (r) => <StatusBadge status={r.role} />,
  },
  {
    header: 'Joined',
    render: (r) => <span className="text-sm text-slate-400">{fmtDate(r.created_at)}</span>,
  },
];

const sessionColumns: TableColumn<RecentSession>[] = [
  {
    header: 'Participants',
    render: (r) => (
      <div>
        <p className="text-sm font-semibold text-white">
          {fullName(r.tutor)} → {fullName(r.tutee)}
        </p>
        <p className="text-xs text-slate-400">{sessionDuration(r)}</p>
      </div>
    ),
  },
  {
    header: 'Status',
    render: (r) => <StatusBadge status={r.status} />,
  },
  {
    header: 'Tokens',
    render: (r) => (
      <span className="text-sm font-semibold text-indigo-300">
        {fmt(sessionTokens(r))}
      </span>
    ),
  },
  {
    header: 'Date',
    render: (r) => <span className="text-sm text-slate-400">{fmtDate(r.created_at)}</span>,
  },
];

const paymentColumns: TableColumn<RecentPayment>[] = [
  {
    header: 'User',
    render: (r) => (
      <div>
        <p className="text-sm font-semibold text-white">{fullName(r.profiles)}</p>
        <p className="text-xs text-slate-400">{r.profiles?.email ?? '—'}</p>
      </div>
    ),
  },
  {
    header: 'Status',
    render: (r) => <StatusBadge status={r.status} />,
  },
  {
    header: 'Amount',
    render: (r) => (
      <div>
        <p className="text-sm font-semibold text-white">KES {fmt(r.amount_kes)}</p>
        <p className="text-xs text-slate-400">{fmt(r.tokens_expected)} tokens</p>
      </div>
    ),
  },
  {
    header: 'Date',
    render: (r) => <span className="text-sm text-slate-400">{fmtDate(r.created_at)}</span>,
  },
];

const reviewColumns: TableColumn<FlaggedReview>[] = [
  {
    header: 'Reviewer',
    render: (r) => (
      <span className="text-sm font-semibold text-white">{fullName(r.reviewer)}</span>
    ),
  },
  {
    header: 'Rating',
    render: (r) => (
      <span className="flex items-center gap-1 text-sm font-bold text-rose-400">
        <Star className="h-3.5 w-3.5 fill-rose-400" />
        {r.rating}/5
      </span>
    ),
  },
  {
    header: 'Comment',
    render: (r) => (
      <p className="max-w-xs truncate text-sm text-slate-300">{r.comment || '—'}</p>
    ),
  },
  {
    header: 'Role reviewed',
    render: (r) => <StatusBadge status={r.reviewee_role} />,
  },
  {
    header: 'Date',
    render: (r) => <span className="text-sm text-slate-400">{fmtDate(r.created_at)}</span>,
  },
];

const qualColumns: TableColumn<TutorQualificationEntry>[] = [
  {
    header: 'Tutor ID',
    render: (r) => (
      <span className="font-mono text-xs text-slate-400">{r.tutorId.slice(0, 8)}…</span>
    ),
  },
  {
    header: 'Hours',
    render: (r) => (
      <span className="text-sm font-semibold text-white">{r.sessionHours}h</span>
    ),
  },
  {
    header: 'Rating',
    render: (r) => (
      <span className={`flex items-center gap-1 text-sm font-semibold ${r.ratingOk ? 'text-emerald-400' : 'text-rose-400'}`}>
        <Star className="h-3.5 w-3.5 fill-current" />
        {r.averageRating.toFixed(1)}
      </span>
    ),
  },
  {
    header: 'Reviewers',
    render: (r) => (
      <span className="text-sm text-slate-300">{r.uniqueReviewers}</span>
    ),
  },
  {
    header: 'Progress',
    render: (r) => <QualProgress entry={r} />,
  },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export const AdminOverview: React.FC = () => {
  const {
    data,
    isLoading,
    error,
    sessionChart,
    revenueChart,
    userGrowthChart,
    tutorGrowthChart,
    tokenPurchaseChart,
    refresh,
  } = useAdminOverview();

  const m = data?.metrics;
  const t = data?.tables;
  const q = data?.qualification;

  return (
    <div className="space-y-2 pb-12">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-200">Admin</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Platform Overview</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Monitor Q-over-o operations, risk signals, wallet activity, and platform growth.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="mt-1 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-40"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Error state ─────────────────────────────────────────────────────── */}
      {error && !isLoading && (
        <ErrorState message={error} onRetry={refresh} />
      )}

      {/* ── SECTION: User metrics ────────────────────────────────────────────── */}
      <SectionHeader>Users</SectionHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          title="Total Users"
          value={m?.totalUsers ?? 0}
          icon={Users}
          accent="bg-gradient-to-br from-indigo-500 to-purple-600"
          subLabel={`↑ ${m?.newUsersThisWeek ?? 0} this week`}
          isLoading={isLoading}
        />
        <AdminMetricCard
          title="Total Tutors"
          value={m?.totalTutors ?? 0}
          icon={GraduationCap}
          accent="bg-gradient-to-br from-emerald-500 to-teal-600"
          isLoading={isLoading}
        />
        <AdminMetricCard
          title="Total Tutees"
          value={m?.totalTutees ?? 0}
          icon={BookOpen}
          accent="bg-gradient-to-br from-sky-500 to-indigo-600"
          isLoading={isLoading}
        />
        <AdminMetricCard
          title="New Users This Week"
          value={m?.newUsersThisWeek ?? 0}
          icon={TrendingUp}
          accent="bg-gradient-to-br from-fuchsia-500 to-purple-600"
          isLoading={isLoading}
        />
      </div>

      {/* ── SECTION: Session metrics ─────────────────────────────────────────── */}
      <SectionHeader>Sessions</SectionHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        <AdminMetricCard
          title="Active Sessions"
          value={m?.activeSessions ?? 0}
          icon={Activity}
          accent="bg-gradient-to-br from-sky-500 to-cyan-600"
          isLoading={isLoading}
        />
        <AdminMetricCard
          title="Completed Sessions"
          value={m?.completedSessions ?? 0}
          icon={CheckCircle2}
          accent="bg-gradient-to-br from-emerald-500 to-green-600"
          isLoading={isLoading}
        />
        <AdminMetricCard
          title="Cancelled Sessions"
          value={m?.cancelledSessions ?? 0}
          icon={XCircle}
          accent="bg-gradient-to-br from-rose-500 to-red-600"
          isLoading={isLoading}
        />
      </div>

      {/* ── SECTION: Financial metrics ───────────────────────────────────────── */}
      <SectionHeader>Financials</SectionHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        <AdminMetricCard
          title="Revenue Generated"
          value={`KES ${fmt(m?.revenueKes ?? 0)}`}
          icon={Wallet}
          accent="bg-gradient-to-br from-amber-500 to-orange-600"
          isLoading={isLoading}
        />
        <AdminMetricCard
          title="Tokens Purchased"
          value={fmt(m?.tokensPurchased ?? 0)}
          icon={Zap}
          accent="bg-gradient-to-br from-yellow-500 to-amber-600"
          isLoading={isLoading}
        />
        <AdminMetricCard
          title="Tokens In Escrow"
          value={fmt(m?.tokensInEscrow ?? 0)}
          icon={Coins}
          accent="bg-gradient-to-br from-violet-500 to-indigo-600"
          isLoading={isLoading}
        />
      </div>

      {/* ── SECTION: Tutor qualification metrics ─────────────────────────────── */}
      <SectionHeader>Tutor Qualification</SectionHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        <AdminMetricCard
          title="Active Tutors"
          value={m?.activeTutors ?? 0}
          icon={ZapOff}
          accent="bg-gradient-to-br from-green-500 to-emerald-600"
          subLabel="is_available = true"
          isLoading={isLoading}
        />
        <AdminMetricCard
          title="Qualified Tutors"
          value={m?.qualifiedTutors ?? 0}
          icon={ShieldCheck}
          accent="bg-gradient-to-br from-indigo-500 to-violet-600"
          subLabel={q ? `≥ ${q.thresholds.minSessionHours}h · ≥ ${q.thresholds.minRating} rating · ≥ ${q.thresholds.minUniqueReviews} reviewers` : undefined}
          isLoading={isLoading}
        />
        <AdminMetricCard
          title="Tutors Near Qualification"
          value={m?.tutorsNearQualification ?? 0}
          icon={Shield}
          accent="bg-gradient-to-br from-amber-500 to-yellow-600"
          subLabel="Within 5 hrs or 5 reviews"
          isLoading={isLoading}
        />
      </div>

      {/* ── SECTION: Charts ──────────────────────────────────────────────────── */}
      <SectionHeader>Charts — Last 30 Days</SectionHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AdminMiniChart
          title="Sessions Over Time"
          subtitle="Daily count"
          data={sessionChart}
          color="sky"
          isLoading={isLoading}
        />
        <AdminMiniChart
          title="Revenue Over Time"
          subtitle="Daily KES"
          data={revenueChart}
          color="amber"
          formatValue={(v) => `KES ${fmt(v)}`}
          isLoading={isLoading}
        />
        <AdminMiniChart
          title="User Growth"
          subtitle="New users per day"
          data={userGrowthChart}
          color="indigo"
          isLoading={isLoading}
        />
        <AdminMiniChart
          title="Tutor Growth"
          subtitle="New tutors per day"
          data={tutorGrowthChart}
          color="emerald"
          isLoading={isLoading}
        />
        <AdminMiniChart
          title="Token Purchases"
          subtitle="Tokens bought per day"
          data={tokenPurchaseChart}
          color="fuchsia"
          formatValue={(v) => fmt(v)}
          isLoading={isLoading}
        />
      </div>

      {/* ── SECTION: Tables ──────────────────────────────────────────────────── */}
      <SectionHeader>Recent Activity</SectionHeader>

      <AdminOverviewTable
        title="Recent Users"
        rows={t?.recentUsers ?? []}
        columns={userColumns}
        keyExtractor={(r) => r.id}
        isLoading={isLoading}
        emptyText="No users yet"
      />

      <div className="mt-4" />

      <AdminOverviewTable
        title="Recent Sessions"
        rows={t?.recentSessions ?? []}
        columns={sessionColumns}
        keyExtractor={(r) => r.id}
        isLoading={isLoading}
        emptyText="No sessions yet"
      />

      <div className="mt-4" />

      <AdminOverviewTable
        title="Recent Payments"
        rows={t?.recentPayments ?? []}
        columns={paymentColumns}
        keyExtractor={(r) => r.id}
        isLoading={isLoading}
        emptyText="No payments yet"
      />

      {/* ── Flagged reviews ────────────────────────────────────────────────── */}
      <SectionHeader>Flagged Reviews</SectionHeader>

      {!isLoading && (t?.flaggedReviews ?? []).length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 py-12 text-center"
        >
          <AlertTriangle className="h-8 w-8 text-slate-600" />
          <p className="text-sm text-slate-500">No flagged reviews (rating ≤ 2)</p>
        </motion.div>
      ) : (
        <AdminOverviewTable
          title="Flagged Reviews (Rating ≤ 2)"
          rows={t?.flaggedReviews ?? []}
          columns={reviewColumns}
          keyExtractor={(r) => r.id}
          isLoading={isLoading}
          emptyText="No flagged reviews"
        />
      )}

      {/* ── Tutor qualification detail ─────────────────────────────────────── */}
      <SectionHeader>Tutor Qualification Progress</SectionHeader>

      {q && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex flex-wrap gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-xs text-slate-400"
        >
          <span>
            <span className="font-semibold text-white">Threshold —</span> Qualify for paid tutoring:
          </span>
          <span>✔ ≥ {q.thresholds.minSessionHours} session hours</span>
          <span>✔ ≥ {q.thresholds.minRating} average rating</span>
          <span>✔ ≥ {q.thresholds.minUniqueReviews} unique student reviewers</span>
        </motion.div>
      )}

      <AdminOverviewTable
        title="All Tutors — Qualification Detail"
        rows={q?.list ?? []}
        columns={qualColumns}
        keyExtractor={(r) => r.tutorId}
        isLoading={isLoading}
        emptyText="No tutor profiles found"
      />
    </div>
  );
};
