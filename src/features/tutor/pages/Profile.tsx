// src/features/tutor/pages/Profile.tsx
// Route: /dashboard/profile
// Purpose: PRIVATE settings page for ALL authenticated users (tutees + tutors).
//
// Sections:
//   1. Profile Header      (avatar, name, role badge, join date)
//   2. Personal Info       (edit first/last name, read-only email)
//   3. Tutor Settings      (bio, hourly rate, subjects) — visible only if role=tutor
//   4. Change Password
//   5. Danger Zone         (delete account)

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
  CheckCircle,
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
  DollarSign,
  Search,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../../shared/hooks/useAuth';
import { profileApi } from '../../../api/profileApi';
import type { ProfileData } from '../../../api/profileApi';
import { tutorApi } from '../../../api/tutorApi';
import { authService } from '../../auth/authService';

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
        if (res.data) {
          setAllSubjects((res.data as SubjectOption[]) ?? []);
        }
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
          {isOpen && (search.length > 0 || filtered.length > 0) && (
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
                  {search ? 'No subjects match your search' : 'All subjects already selected'}
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

interface SubjectOption {
  id: string;
  name: string;
  code?: string;
}

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

  // ── Personal info edit state ─────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Tutor settings edit state ────────────────────────────────────────────
  const [isEditingTutor, setIsEditingTutor] = useState(false);
  const [tutorSettings, setTutorSettings] = useState<TutorSettingsState>({
    bio: '',
    hourlyRate: '',
    subjects: [],
  });
  const [tutorSettingsError, setTutorSettingsError] = useState<string | null>(null);
  const [isSavingTutor, setIsSavingTutor] = useState(false);
  const [tutorSaveSuccess, setTutorSaveSuccess] = useState(false);

  // ── Password state ───────────────────────────────────────────────────────
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // ── Delete state ─────────────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Fetch profile ─────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    try {
      setIsLoadingProfile(true);
      setLoadError(null);
      const res = await profileApi.getMe();
      if (res.data) {
        setProfile(res.data ?? null);
      }
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
    setSaveSuccess(false);
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
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
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
      subjects: [], // loaded separately via SubjectSelector
    });
    // Fetch current subjects so the selector is pre-populated
    tutorApi.getMyProfile().then((res: any) => {
      if (res?.data?.subjects) {
        setTutorSettings((prev) => ({
          ...prev,
          subjects: res.data.subjects.map((s: any) => ({
            id: s.id,
            name: s.name,
            code: s.code,
          })),
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
      setTutorSaveSuccess(true);
      setTimeout(() => setTutorSaveSuccess(false), 3500);
    } catch (err) {
      setTutorSettingsError(err instanceof Error ? err.message : 'Failed to save tutor settings');
    } finally {
      setIsSavingTutor(false);
    }
  };

  // ── Password handlers ─────────────────────────────────────────────────────
  const handleSavePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

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

    try {
      setIsSavingPassword(true);
      await authService.updatePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
      setTimeout(() => setPasswordSuccess(false), 4000);
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
      navigate('/login', { replace: true, state: { accountDeleted: true } });
    } catch (err) {
      setIsDeleting(false);
      setShowDeleteModal(false);
      alert(err instanceof Error ? err.message : 'Failed to delete account. Please try again.');
    }
  };

  // ── Loading / error states ────────────────────────────────────────────────
  if (isLoadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-sm text-gray-500">Loading your profile…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-6 bg-red-50 border border-red-200 rounded-2xl text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
        <p className="text-red-700 font-medium mb-4">{loadError}</p>
        <button
          onClick={fetchProfile}
          className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const isTutor = user?.role === 'tutor';
  const displayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'User';
  const initial = initials(profile?.firstName, profile?.lastName);

  return (
    <>
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

          <div className="flex items-center gap-2">
            {saveSuccess && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl"
              >
                <CheckCircle className="w-4 h-4" />
                Saved
              </motion.div>
            )}
            {passwordSuccess && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl"
              >
                <CheckCircle className="w-4 h-4" />
                Password updated
              </motion.div>
            )}
            {tutorSaveSuccess && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl"
              >
                <CheckCircle className="w-4 h-4" />
                Tutor settings saved
              </motion.div>
            )}
            {/* View public tutor profile link — tutors only */}
            {isTutor && (
              <a
                href={`/tutors/${user?.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 border border-indigo-200 text-indigo-600 text-sm font-medium rounded-xl hover:bg-indigo-50 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                View public profile
              </a>
            )}
          </div>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    First Name
                  </label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Email (cannot be changed)
                </label>
                <input
                  type="email"
                  value={profile?.email ?? ''}
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-100 rounded-xl text-sm text-gray-400 bg-gray-50 cursor-not-allowed"
                />
              </div>

              {editError && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  {editError}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Save Changes
                    </>
                  )}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Section>

        {/* ── Tutor Settings (tutors only) ── */}
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
                      <DollarSign className="w-4 h-4" />
                      {profile?.tutorProfile?.hourly_rate_tokens ?? 0}{' '}
                      <span className="font-normal text-gray-500">tokens / hr</span>
                    </span>
                  }
                />
                <FieldRow
                  label="Average Rating"
                  value={
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
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
                {profile?.tutorProfile?.bio && (
                  <div className="py-3 border-b border-gray-50">
                    <p className="text-sm font-medium text-gray-500 mb-1.5">Bio</p>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {profile.tutorProfile.bio}
                    </p>
                  </div>
                )}

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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Tutor Bio
                  </label>
                  <textarea
                    value={tutorSettings.bio}
                    onChange={(e) =>
                      setTutorSettings((prev) => ({ ...prev, bio: e.target.value }))
                    }
                    rows={4}
                    placeholder="Describe your tutoring style, experience, and what students can expect…"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {tutorSettings.bio.length} characters — shown on your public profile
                  </p>
                </div>

                {/* Hourly Rate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Hourly Rate (tokens)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={tutorSettings.hourlyRate}
                      onChange={(e) =>
                        setTutorSettings((prev) => ({ ...prev, hourlyRate: e.target.value }))
                      }
                      className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                      placeholder="e.g. 50"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    1 token ≈ 1 KES. Set a fair rate to attract more students.
                  </p>
                </div>

                {/* Subjects */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subjects You Teach
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

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSaveTutorSettings}
                    disabled={isSavingTutor}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    {isSavingTutor ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" /> Save Tutor Settings
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCancelEditTutor}
                    disabled={isSavingTutor}
                    className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <X className="w-4 h-4" />
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
          {!isChangingPassword ? (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                Keep your account secure with a strong password.
              </p>
              <button
                onClick={() => {
                  setIsChangingPassword(true);
                  setPasswordError(null);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                <Lock className="w-4 h-4" />
                Change Password
              </button>
            </div>
          ) : (
            <div className="space-y-4 max-w-sm">
              {/* Current Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                    placeholder="Current password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  New Password
                </label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                  placeholder="Min. 8 characters"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                  placeholder="Repeat new password"
                />
              </div>

              {passwordError && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  {passwordError}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleSavePassword}
                  disabled={isSavingPassword}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  {isSavingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Update Password
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setIsChangingPassword(false);
                    setPasswordError(null);
                  }}
                  disabled={isSavingPassword}
                  className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Section>

        {/* ── Danger Zone ── */}
        <Section
          title="Danger Zone"
          icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
          delay={0.25}
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-red-50 border border-red-100 rounded-xl">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Delete Account</p>
              <p className="text-sm text-gray-500 mt-0.5">
                Permanently removes your account, wallet, sessions history, and tutor profile. This
                action is irreversible.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              Delete Account
            </button>
          </div>
        </Section>
      </div>
    </>
  );
};
