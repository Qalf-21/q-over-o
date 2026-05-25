// src/features/tutee/pages/Discover.tsx — FULL REPLACEMENT
//
// Changes:
//  • Passes currentUserId to BookingModal (self-booking prevention)
//  • Filters logged-in tutor's own card from the discover list
//  • handleBooking refreshes wallet after booking

import React, { useCallback, useEffect, useState } from 'react';
import { SearchFilters } from '../components/SearchFilters';
import { TutorCard } from '../components/TutorCard';
import { BookingModal } from '../components/BookingModal';
import { TutorProfileModal } from '../../../shared/components/TutorProfileModal';
import { Loader2, GraduationCap } from 'lucide-react';
import type { TutorSearchResult, SearchFilters as Filters } from '../../../types/tutor';
import { tutorApi } from '../../../api/tutorApi';
import { walletApi } from '../../../api/walletApi';
import { useAuth } from '../../../shared/hooks/useAuth';
import { useAutoRefresh } from '../../../shared/hooks/useAutoRefresh';

export const Discover: React.FC = () => {
  const { user } = useAuth();
  const [filters, setFilters] = useState<Filters>({ query: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tutors, setTutors] = useState<TutorSearchResult[]>([]);
  const [userTokens, setUserTokens] = useState(0);
  const [bookingTutor, setBookingTutor] = useState<TutorSearchResult | null>(null);
  const [profileTutor, setProfileTutor] = useState<TutorSearchResult | null>(null);

  const loadDiscoverData = useCallback(async (silent = false) => {
      try {
        if (!silent) setIsLoading(true);
        setError(null);

        // Fetch tutors and wallet independently so a missing wallet
        // never prevents the tutor list from rendering.
        const [tutorResult, walletResult] = await Promise.allSettled([
          tutorApi.getTutors(filters),
          walletApi.getWallet(),
        ]);

        if (tutorResult.status === 'fulfilled') {
          let filtered = tutorResult.value.data.filter(t => t.id !== user?.id);
          // Client-side safety net: enforce availableNow filter locally
          // so unavailable tutors never slip through even if backend misfires.
          if (filters.availableNow) {
            filtered = filtered.filter(t => t.isAvailable === true && t.hasBookableSlots !== false);
          }
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
      } finally {
        if (!silent) setIsLoading(false);
      }
  }, [filters, user?.id]);

  useEffect(() => {
    loadDiscoverData();
  }, [loadDiscoverData]);

  useAutoRefresh(() => loadDiscoverData(true), { intervalMs: 30_000 });

  const handleClearFilters = () => setFilters({ query: '' });

  const handleBooking = async () => {
    const walletResponse = await walletApi.getWallet();
    setUserTokens(walletResponse.data.balance);
  };

  // "Book Session" initiated from profile modal
  const handleBookFromProfile = (tutor: TutorSearchResult) => {
    setProfileTutor(null);
    setBookingTutor(tutor);
  };

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div>
          <h1 className="app-page-title">Find a Tutor</h1>
          <p className="app-page-subtitle">Discover available tutors by subject, rating, price, and schedule fit.</p>
        </div>
      </div>

      {/* Token Balance */}
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 p-5 text-white shadow-lg shadow-indigo-500/20">
        <div>
          <p className="text-sm font-medium text-indigo-100">Available Balance</p>
          <p className="text-2xl font-bold">{userTokens} tokens</p>
        </div>
        <button type="button" className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/25">
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
        <div className="app-alert-error">
          {error}
        </div>
      ) : tutors.length === 0 ? (
        <div className="app-empty-state">
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
      {bookingTutor && (
        <BookingModal
          key={bookingTutor.id}
          tutor={bookingTutor}
          currentUserId={user?.id}
          userTokens={userTokens}
          onClose={() => setBookingTutor(null)}
          onConfirm={handleBooking}
        />
      )}
    </div>
  );
};
