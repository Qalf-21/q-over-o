import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User as UserIcon, BookOpen, Star, AlertCircle } from 'lucide-react';
import type { TutorProfile } from '../tutor';
import { useAuth } from '../../../shared/hooks/useAuth';
import type { User } from '../../auth/types';

export const Profile: React.FC = () => {
  const { user } = useAuth();
  const userDisplayName = (currentUser?: User | null) =>
    [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ');

  const createEmptyProfile = (user?: User | null): TutorProfile => ({
    id: user?.id || '',
    name: userDisplayName(user),
    email: user?.email || '',
    bio: '',
    subjects: [],
    hourlyRate: 0,
    rating: 0,
    totalReviews: 0,
    totalSessions: 0,
    isAvailable: true,
    createdAt: new Date().toISOString()
  });

  const [profile, setProfile] = useState(() => createEmptyProfile(user));

useEffect(() => {
  if (!user) return;

  setProfile(prev => {
    if (prev.id === user.id) return prev; // prevent unnecessary updates
    return { ...prev, id: user.id, name: userDisplayName(user), email: user.email };
  });

}, [user]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <p className="text-gray-600 mt-1">Manage your tutor profile and settings</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        Tutor profile editing is not exposed by the configured backend endpoint list. This page only displays authenticated user data.
      </div>

      {/* Profile Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white text-3xl font-bold">
              {profile.name[0]}
            </div>
          </div>
          
          <div className="text-center sm:text-left flex-1">
            <h2 className="text-xl font-bold text-gray-900">{profile.name}</h2>
            <p className="text-gray-500">{profile.email}</p>
            <div className="flex items-center gap-4 mt-2 justify-center sm:justify-start">
              <div className="flex items-center gap-1 text-amber-500">
                <Star className="w-5 h-5 fill-current" />
                <span className="font-bold">{profile.rating}</span>
                <span className="text-gray-400 text-sm">({profile.totalReviews} reviews)</span>
              </div>
              <span className="text-gray-300">|</span>
              <span className="text-gray-600">{profile.totalSessions} sessions completed</span>
            </div>
          </div>

          <div className="bg-indigo-50 rounded-xl p-4 text-center min-w-[120px]">
            <div className="text-2xl font-bold text-indigo-600">{profile.hourlyRate}</div>
            <div className="text-xs text-gray-600">tokens/hour</div>
          </div>
        </div>
      </motion.div>

      {/* Bio Section */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <UserIcon className="w-5 h-5 text-indigo-600" />
          About Me
        </h3>
        
        <p className="text-gray-600 leading-relaxed">{profile.bio || 'No bio returned by the configured API.'}</p>
      </div>

      {/* Subjects Section */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-600" />
          Subjects I Teach
        </h3>
        
        <div className="flex flex-wrap gap-2 mb-4">
          {profile.subjects.map(subject => (
            <div 
              key={subject.id}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg"
            >
              <span className="font-medium">{subject.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
