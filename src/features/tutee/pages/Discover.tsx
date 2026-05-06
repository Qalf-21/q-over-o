import React, { useEffect, useState } from 'react';
import { SearchFilters } from '../components/SearchFilters';
import { TutorCard } from '../components/TutorCard';
import { BookingModal } from '../components/BookingModal';
import { Loader2, GraduationCap } from 'lucide-react';
import type { TutorSearchResult, SearchFilters as Filters, BookingRequest } from '../../../types/tutor';
import { tutorApi } from '../../../api/tutorApi';
import { walletApi } from '../../../api/walletApi';

export const Discover: React.FC = () => {
  const [filters, setFilters] = useState<Filters>({ query: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tutors, setTutors] = useState<TutorSearchResult[]>([]);
  const [userTokens, setUserTokens] = useState(0);
  const [bookingTutor, setBookingTutor] = useState<TutorSearchResult | null>(null);

  useEffect(() => {
    let ignore = false;

    const loadDiscoverData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [tutorResponse, walletResponse] = await Promise.all([
          tutorApi.getTutors(filters),
          walletApi.getWallet()
        ]);

        if (!ignore) {
          setTutors(tutorResponse.data);
          setUserTokens(walletResponse.data.balance);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to load tutors');
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };

    loadDiscoverData();
    return () => {
      ignore = true;
    };
  }, [filters]);

  const handleClearFilters = () => {
    setFilters({ query: '' });
  };

  const handleBooking = async (_booking: BookingRequest) => {
    const walletResponse = await walletApi.getWallet();
    setUserTokens(walletResponse.data.balance);
    setBookingTutor(null);
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
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
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
              onViewProfile={() => undefined}
              onBook={setBookingTutor}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <BookingModal
        tutor={bookingTutor}
        userTokens={userTokens}
        onClose={() => setBookingTutor(null)}
        onConfirm={handleBooking}
      />
    </div>
  );
};
