// src/features/tutor/pages/Profile.tsx
// Route: /dashboard/profile
// Changes from original:
//   • "View public profile" now opens TutorProfileModal instead of new tab
//   • Success feedback uses the shared Toast component (industry-standard)
//   • SubjectSelector: fixed so it always shows the dropdown (not just on search)
//   • tutorApi.getSubjects() response normalised correctly

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Mail,
  Shield,
  Calendar,
  BookOpen,
  Star,
  Edit3,
  Lock,
  Trash2,
  Save,
  X,
  AlertTriangle,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Search,
  Eye as EyeIcon,
} from 'lucide-react';
import { useAuth } from '../../../shared/hooks/useAuth';
import { profileApi } from '../../../api/profileApi';
import type { ProfileData } from '../../../api/profileApi';
import { tutorApi } from '../../../api/tutorApi';
import { authService } from '../../auth/authService';
import { TutorProfileModal } from '../../../shared/components/TutorProfileModal';
import { Toast } from '../../../shared/components/Toast';
import type { ToastState } from '../../../shared/components/Toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const initials = (firstName?: string, lastName?: string) =>
  `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || 'U';

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
}

const Section: React.FC<SectionProps> = ({ title, icon, children, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
  >
    <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
      <span className="text-indigo-600">{icon}</span>
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
    </div>
    <div className="p-6">{children}</div>
  </motion.div>
);

interface FieldRowProps {
  label: string;
  value: React.ReactNode;
}

const FieldRow: React.FC<FieldRowProps> = ({ label, value }) => (
  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-gray-50 last:border-0">
    <span className="sm:w-40 text-sm font-medium text-gray-500 flex-shrink-0">{label}</span>
    <span className="text-sm text-gray-900">{value}</span>
  </div>
);

// ─── Subject Chip Selector ────────────────────────────────────────────────────

interface SubjectOption {
  id: string;
  name: string;
  code?: string;
}

interface SubjectSelectorProps {
  selected: SubjectOption[];
  onChange: (subjects: SubjectOption[]) => void;
}

const SubjectSelector: React.FC<SubjectSelectorProps> = ({ selected, onChange }) => {
  const [allSubjects, setAllSubjects] = useState<SubjectOption[]>([]);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        setIsLoadingSubjects(true);
        const res = await tutorApi.getSubjects();
        // Normalise: backend may return { data: [...] } or an array directly
        const raw: any[] = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res)
          ? (res as any)
          : [];
        setAllSubjects(raw.map((s: any) => ({ id: s.id, name: s.name, code: s.code })));
      } catch {
        // silently fail — subjects list stays empty
      } finally {
        setIsLoadingSubjects(false);
      }
    };
    loadSubjects();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedIds = new Set(selected.map((s) => s.id));

  const filtered = allSubjects.filter(
    (s) =>
      !selectedIds.has(s.id) &&
      s.name.toLowerCase().includes(search.toLowerCase()),
  );

  const addSubject = (subject: SubjectOption) => {
    onChange([...selected, subject]);
    setSearch('');
  };

  const removeSubject = (id: string) => {
    onChange(selected.filter((s) => s.id !== id));
  };

  return (
    <div>
      {/* Selected chips */}
      <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
        {selected.length === 0 && (
          <span className="text-sm text-gray-400 italic">No subjects selected yet</span>
        )}
        {selected.map((subject) => (
          <span
            key={subject.id}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium"
          >
            {subject.name}
            <button
              type="button"
              onClick={() => removeSubject(subject.id)}
              className="hover:text-indigo-900 transition-colors"
              aria-label={`Remove ${subject.name}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
      </div>

      {/* Search input + dropdown */}
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search and add subjects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setIsOpen(true)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white"
          />
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute top-full left-0 right-0 z-20 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg max-h-48 overflow-y-auto"
            >
              {isLoadingSubjects ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  {search ? 'No subjects match your search' : allSubjects.length === 0 ? 'No subjects available' : 'All subjects already selected'}
                </p>
              ) : (
                filtered.map((subject) => (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => addSubject(subject)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-indigo-50 text-left transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                    <span className="text-sm text-gray-800">{subject.name}</span>
                    {subject.code && (
                      <span className="ml-auto text-xs text-gray-400">{subject.code}</span>
                    )}
                  </button>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── Delete Confirmation Modal ────────────────────────────────────────────────

interface DeleteModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

const DeleteModal: React.FC<DeleteModalProps> = ({ onConfirm, onCancel, isLoading }) => {
  const [confirmText, setConfirmText] = useState('');
  const isMatch = confirmText === 'DELETE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Delete Account</h3>
            <p className="text-sm text-gray-500">This action cannot be undone</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4 leading-relaxed">
          This will permanently delete your account and all associated data — sessions history,
          wallet, tutor profile, and reviews. Any pending sessions will be cancelled.
        </p>

        <p className="text-sm font-medium text-gray-700 mb-2">
          Type <span className="font-bold text-red-600">DELETE</span> to confirm:
        </p>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
          className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 mb-5"
          autoFocus
        />

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!isMatch || isLoading}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete Account
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Tutor Settings types ─────────────────────────────────────────────────────

interface TutorSettingsState {
  bio: string;
  hourlyRate: string;
  subjects: SubjectOption[];
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth();

  // ── Data state ───────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Toast state ──────────────────────────────────────────────────────────
  const [toast, setToast] = useState<ToastState | null>(null);

  // ── Personal info edit state ─────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── Tutor settings edit state ────────────────────────────────────────────
  const [isEditingTutor, setIsEditingTutor] = useState(false);
  const [tutorSettings, setTutorSettings] = useState<TutorSettingsState>({
    bio: '',
    hourlyRate: '',
    subjects: [],
  });
  const [tutorSettingsError, setTutorSettingsError] = useState<string | null>(null);
  const [isSavingTutor, setIsSavingTutor] = useState(false);

  // ── Password state ───────────────────────────────────────────────────────
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // ── Delete state ─────────────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Public profile modal ─────────────────────────────────────────────────
  const [showPublicProfile, setShowPublicProfile] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────

  const isTutor = user?.role === 'tutor';
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User';
  const initial = initials(user?.firstName, user?.lastName);

  // ── Fetch profile ─────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    try {
      setIsLoadingProfile(true);
      setLoadError(null);
      const res = await profileApi.getMe();
      if (res.data) setProfile(res.data ?? null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // ── Personal info handlers ────────────────────────────────────────────────
  const handleStartEdit = () => {
    setEditFirstName(profile?.firstName ?? user?.firstName ?? '');
    setEditLastName(profile?.lastName ?? user?.lastName ?? '');
    setEditError(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditError(null);
  };

  const handleSaveProfile = async () => {
    const trimmedFirst = editFirstName.trim();
    const trimmedLast = editLastName.trim();

    if (!trimmedFirst || trimmedFirst.length < 2) {
      setEditError('First name must be at least 2 characters');
      return;
    }
    if (!trimmedLast || trimmedLast.length < 2) {
      setEditError('Last name must be at least 2 characters');
      return;
    }

    try {
      setIsSaving(true);
      setEditError(null);
      const res = await profileApi.updateProfile({
        first_name: trimmedFirst,
        last_name: trimmedLast,
      });
      if (res.data) {
        setProfile((prev) => (prev ? { ...prev, ...res.data } : res.data ?? null));
      }
      await refreshUser();
      setIsEditing(false);
      setToast({ type: 'success', title: 'Profile updated', message: 'Your name was saved successfully.' });
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Tutor settings handlers ───────────────────────────────────────────────
  const handleStartEditTutor = () => {
    setTutorSettings({
      bio: profile?.tutorProfile?.bio ?? '',
      hourlyRate: String(profile?.tutorProfile?.hourly_rate_tokens ?? ''),
      subjects: [],
    });
    // Pre-populate subjects from the tutor profile endpoint
    tutorApi.getMyProfile().then((res: any) => {
      const raw: any[] = Array.isArray(res?.data?.subjects)
        ? res.data.subjects
        : [];
      if (raw.length) {
        setTutorSettings((prev) => ({
          ...prev,
          subjects: raw.map((s: any) => ({ id: s.id, name: s.name, code: s.code })),
        }));
      }
    }).catch(() => {});
    setTutorSettingsError(null);
    setIsEditingTutor(true);
  };

  const handleCancelEditTutor = () => {
    setIsEditingTutor(false);
    setTutorSettingsError(null);
  };

  const handleSaveTutorSettings = async () => {
    const rate = parseFloat(tutorSettings.hourlyRate);
    if (!tutorSettings.bio.trim()) {
      setTutorSettingsError('Bio cannot be empty');
      return;
    }
    if (isNaN(rate) || rate <= 0) {
      setTutorSettingsError('Hourly rate must be a positive number');
      return;
    }
    if (tutorSettings.subjects.length === 0) {
      setTutorSettingsError('Please select at least one subject');
      return;
    }

    try {
      setIsSavingTutor(true);
      setTutorSettingsError(null);
      await tutorApi.updateProfile({
        bio: tutorSettings.bio.trim(),
        hourlyRate: rate,
        subjects: tutorSettings.subjects.map((s) => s.id),
      });
      await fetchProfile();
      setIsEditingTutor(false);
      setToast({ type: 'success', title: 'Tutor settings saved', message: 'Your profile is live and visible to students.' });
    } catch (err) {
      setTutorSettingsError(err instanceof Error ? err.message : 'Failed to save tutor settings');
    } finally {
      setIsSavingTutor(false);
    }
  };

  // ── Password handlers ─────────────────────────────────────────────────────
  const handleSavePassword = async () => {
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from your current one');
      return;
    }

    try {
      setIsSavingPassword(true);
      await authService.updatePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
      setToast({
        type: 'success',
        title: 'Password updated',
        message: 'Your account password was changed successfully.',
      });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // ── Delete handler ────────────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      await profileApi.deleteAccount();
      logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setShowDeleteModal(false);
      setToast({ type: 'error', title: 'Delete failed', message: err instanceof Error ? err.message : 'Unable to delete account.' });
    } finally {
      setIsDeleting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (isLoadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {loadError}
          <button onClick={fetchProfile} className="ml-auto text-indigo-600 hover:underline font-medium">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Toast ── */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* ── Public profile modal ── */}
      {showPublicProfile && user?.id && (
        <TutorProfileModal
          tutorId={user.id}
          currentUserId={user.id}
          onClose={() => setShowPublicProfile(false)}
        />
      )}

      <AnimatePresence>
        {showDeleteModal && (
          <DeleteModal
            onConfirm={handleDeleteAccount}
            onCancel={() => setShowDeleteModal(false)}
            isLoading={isDeleting}
          />
        )}
      </AnimatePresence>

      <div className="max-w-3xl mx-auto space-y-6 pb-10">
        {/* ── Page header ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4 flex-wrap"
        >
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage your account settings and preferences
            </p>
          </div>

          {/* View public tutor profile button — tutors only */}
          {isTutor && (
            <button
              onClick={() => setShowPublicProfile(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-indigo-200 text-indigo-600 text-sm font-medium rounded-xl hover:bg-indigo-50 transition-colors"
            >
              <EyeIcon className="w-4 h-4" />
              View public profile
            </button>
          )}
        </motion.div>

        {/* ── Profile header card ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
        >
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {initial}
              </div>
              <div
                className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-white ${
                  isTutor ? 'bg-indigo-500' : 'bg-emerald-500'
                }`}
              />
            </div>

            {/* Info */}
            <div className="text-center sm:text-left flex-1">
              <h2 className="text-xl font-bold text-gray-900">{displayName}</h2>
              <p className="text-gray-500 text-sm mt-0.5">{profile?.email}</p>
              <div className="flex flex-wrap items-center gap-2 mt-3 justify-center sm:justify-start">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    isTutor
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  <Shield className="w-3 h-3" />
                  {isTutor ? 'Tutor' : 'Tutee'}
                </span>
                {profile?.tutorProfile && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                    <Star className="w-3 h-3" />
                    Active Tutor
                  </span>
                )}
                {profile?.createdAt && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                    <Calendar className="w-3 h-3" />
                    Joined {formatDate(profile.createdAt)}
                  </span>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 sm:flex-shrink-0">
              <div className="text-center bg-indigo-50 rounded-xl px-4 py-3 min-w-[80px]">
                <p className="text-xl font-bold text-indigo-700">
                  {profile?.stats?.totalSessionsBooked ?? 0}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Sessions</p>
              </div>
              {isTutor && profile?.tutorProfile && (
                <div className="text-center bg-amber-50 rounded-xl px-4 py-3 min-w-[80px]">
                  <p className="text-xl font-bold text-amber-600 flex items-center justify-center gap-1">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    {Number(profile.tutorProfile.rating_avg ?? 0).toFixed(1)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Rating</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Personal Information ── */}
        <Section
          title="Personal Information"
          icon={<User className="w-4 h-4" />}
          delay={0.1}
        >
          {!isEditing ? (
            <>
              <FieldRow label="First Name" value={profile?.firstName} />
              <FieldRow label="Last Name" value={profile?.lastName} />
              <FieldRow
                label="Email"
                value={
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-gray-400" />
                    {profile?.email}
                  </span>
                }
              />
              <FieldRow
                label="Role"
                value={<span className="capitalize">{profile?.role}</span>}
              />
              <FieldRow
                label="Member Since"
                value={profile?.createdAt ? formatDate(profile.createdAt) : '—'}
              />

              <div className="mt-5 pt-4 border-t border-gray-50">
                <button
                  onClick={handleStartEdit}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit Profile
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">First Name</label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                    placeholder="First name"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Last Name</label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                    placeholder="Last name"
                  />
                </div>
              </div>

              {editError && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  {editError}
                </p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60 transition-all"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSaving ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="px-5 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Section>

        {/* ── Tutor Settings ── */}
        {isTutor && (
          <Section
            title="Tutor Settings"
            icon={<BookOpen className="w-4 h-4" />}
            delay={0.15}
          >
            {!isEditingTutor ? (
              <>
                <FieldRow
                  label="Hourly Rate"
                  value={
                    <span className="flex items-center gap-1.5 font-semibold text-indigo-700">
                      <span className="text-gray-400 font-normal">$</span>
                      {profile?.tutorProfile?.hourly_rate_tokens ?? '—'}{' '}
                      <span className="text-gray-400 font-normal text-xs">tokens / hr</span>
                    </span>
                  }
                />
                <FieldRow
                  label="Average Rating"
                  value={
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      {Number(profile?.tutorProfile?.rating_avg ?? 0).toFixed(1)}
                      <span className="text-gray-400 text-xs ml-1">
                        ({profile?.tutorProfile?.total_reviews ?? 0} reviews)
                      </span>
                    </span>
                  }
                />
                <FieldRow
                  label="Sessions Taught"
                  value={profile?.tutorProfile?.total_sessions ?? 0}
                />

                <div className="mt-5 pt-4 border-t border-gray-50">
                  <button
                    onClick={handleStartEditTutor}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit Tutor Settings
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-5">
                {/* Bio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Bio</label>
                  <textarea
                    value={tutorSettings.bio}
                    onChange={(e) =>
                      setTutorSettings((prev) => ({ ...prev, bio: e.target.value }))
                    }
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 resize-none"
                    placeholder="Tell students about yourself…"
                  />
                </div>

                {/* Hourly Rate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Hourly Rate (tokens)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={tutorSettings.hourlyRate}
                    onChange={(e) =>
                      setTutorSettings((prev) => ({ ...prev, hourlyRate: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                    placeholder="e.g. 500"
                  />
                </div>

                {/* Subjects */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Subjects
                  </label>
                  <SubjectSelector
                    selected={tutorSettings.subjects}
                    onChange={(subjects) =>
                      setTutorSettings((prev) => ({ ...prev, subjects }))
                    }
                  />
                </div>

                {tutorSettingsError && (
                  <p className="text-sm text-red-600 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    {tutorSettingsError}
                  </p>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleSaveTutorSettings}
                    disabled={isSavingTutor}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60 transition-all"
                  >
                    {isSavingTutor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSavingTutor ? 'Saving…' : 'Save Settings'}
                  </button>
                  <button
                    onClick={handleCancelEditTutor}
                    disabled={isSavingTutor}
                    className="px-5 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Section>
        )}

        {/* ── Change Password ── */}
        <Section
          title="Change Password"
          icon={<Lock className="w-4 h-4" />}
          delay={0.2}
        >
          <p className="text-sm text-gray-500 mb-4">Keep your account secure with a strong password.</p>

          {!isChangingPassword ? (
            <button
              onClick={() => setIsChangingPassword(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm"
            >
              <Lock className="w-4 h-4" />
              Change Password
            </button>
          ) : (
            <div className="space-y-4">
              {/* Current password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pr-10 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                    placeholder="Enter current password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pr-10 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Strength hint */}
                {newPassword.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex gap-1 flex-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            newPassword.length >= i * 3
                              ? newPassword.length >= 12
                                ? 'bg-emerald-500'
                                : newPassword.length >= 8
                                ? 'bg-amber-400'
                                : 'bg-red-400'
                              : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">
                      {newPassword.length >= 12
                        ? 'Strong'
                        : newPassword.length >= 8
                        ? 'Good'
                        : 'Weak'}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 ${
                    confirmPassword && confirmPassword !== newPassword
                      ? 'border-red-300'
                      : 'border-gray-200'
                  }`}
                  placeholder="Re-enter new password"
                />
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
              </div>

              {passwordError && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  {passwordError}
                </p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSavePassword}
                  disabled={isSavingPassword}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60 transition-all"
                >
                  {isSavingPassword ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  {isSavingPassword ? 'Updating…' : 'Update Password'}
                </button>
                <button
                  onClick={() => {
                    setIsChangingPassword(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setPasswordError(null);
                  }}
                  disabled={isSavingPassword}
                  className="px-5 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Section>

        {/* ── Danger Zone ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-red-50 flex items-center gap-2">
            <span className="text-red-500">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <h2 className="text-base font-semibold text-gray-900">Danger Zone</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">
              Once you delete your account, there is no going back. All your data will be
              permanently removed.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Account
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
};
