// src/features/tutee/pages/Discover.tsx — FULL REPLACEMENT
//
// Changes:
//  • Passes currentUserId to BookingModal (self-booking prevention)
//  • Filters logged-in tutor's own card from the discover list
//  • handleBooking refreshes wallet after booking

import React, { useEffect, useState } from 'react';
import { SearchFilters } from '../components/SearchFilters';
import { TutorCard } from '../components/TutorCard';
import { BookingModal } from '../components/BookingModal';
import { TutorProfileModal } from '../../../shared/components/TutorProfileModal';
import { Loader2, GraduationCap } from 'lucide-react';
import type { TutorSearchResult, SearchFilters as Filters, BookingRequest } from '../../../types/tutor';
import { tutorApi } from '../../../api/tutorApi';
import { walletApi } from '../../../api/walletApi';
import { useAuth } from '../../../shared/hooks/useAuth';

export const Discover: React.FC = () => {
  const { user } = useAuth();
  const [filters, setFilters] = useState<Filters>({ query: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tutors, setTutors] = useState<TutorSearchResult[]>([]);
  const [userTokens, setUserTokens] = useState(0);
  const [bookingTutor, setBookingTutor] = useState<TutorSearchResult | null>(null);
  const [profileTutor, setProfileTutor] = useState<TutorSearchResult | null>(null);

  useEffect(() => {
    let ignore = false;

    const loadDiscoverData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch tutors and wallet independently so a missing wallet
        // never prevents the tutor list from rendering.
        const [tutorResult, walletResult] = await Promise.allSettled([
          tutorApi.getTutors(filters),
          walletApi.getWallet(),
        ]);

        if (!ignore) {
          if (tutorResult.status === 'fulfilled') {
            const filtered = tutorResult.value.data.filter(t => t.id !== user?.id);
            setTutors(filtered);
          } else {
            setError(tutorResult.reason instanceof Error
              ? tutorResult.reason.message
              : 'Failed to load tutors');
          }

          if (walletResult.status === 'fulfilled') {
            setUserTokens(walletResult.value.data.balance);
          }
          // Wallet error is silently ignored — balance stays 0,
          // the backend now auto-creates it on next request.
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };

    loadDiscoverData();
    return () => { ignore = true; };
  }, [filters, user?.id]);

  const handleClearFilters = () => setFilters({ query: '' });

  const handleBooking = async (_booking: BookingRequest) => {
    const walletResponse = await walletApi.getWallet();
    setUserTokens(walletResponse.data.balance);
    setBookingTutor(null);
  };

  // "Book Session" initiated from profile modal
  const handleBookFromProfile = (tutor: TutorSearchResult) => {
    setProfileTutor(null);
    setBookingTutor(tutor);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Find a Tutor</h1>
        <p className="text-gray-600 mt-1">Connect with expert students ready to help you succeed</p>
      </div>

      {/* Token Balance */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-4 text-white flex items-center justify-between">
        <div>
          <p className="text-indigo-100 text-sm">Your Balance</p>
          <p className="text-2xl font-bold">{userTokens} tokens</p>
        </div>
        <button className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
          Top Up
        </button>
      </div>

      {/* Search & Filters */}
      <SearchFilters
        filters={filters}
        onChange={setFilters}
        onClear={handleClearFilters}
      />

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : tutors.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
          <GraduationCap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tutors found</h3>
          <p className="text-gray-500">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tutors.map((tutor) => (
            <TutorCard
              key={tutor.id}
              tutor={tutor}
              onViewProfile={setProfileTutor}
              onBook={setBookingTutor}
            />
          ))}
        </div>
      )}

      {/* Tutor profile modal */}
      {profileTutor && (
        <TutorProfileModal
          tutorId={profileTutor.id}
          currentUserId={user?.id}
          onClose={() => setProfileTutor(null)}
          onBook={handleBookFromProfile}
        />
      )}

      {/* Booking modal — currentUserId prevents self-booking */}
      <BookingModal
        tutor={bookingTutor}
        currentUserId={user?.id}
        userTokens={userTokens}
        onClose={() => setBookingTutor(null)}
        onConfirm={handleBooking}
      />
    </div>
  );
};
