// src/features/tutee/components/TutorCard.tsx — FULL REPLACEMENT
//
// Changes:
//  • Always shows availability badge (green "Available" or grey "Unavailable")
//    Previously it only showed the badge when isAvailable was true, so
//    unavailable tutors appeared with no status indicator at all.
//  • "Book Now" button is disabled with a tooltip when tutor is unavailable

import React from 'react';
import { motion } from 'framer-motion';
import { Star, CheckCircle2, XCircle } from 'lucide-react';
import type { TutorSearchResult } from '../../../types/tutor';

interface TutorCardProps {
  tutor: TutorSearchResult;
  onViewProfile: (tutor: TutorSearchResult) => void;
  onBook: (tutor: TutorSearchResult) => void;
}

export const TutorCard: React.FC<TutorCardProps> = ({ tutor, onViewProfile, onBook }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all"
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
          {tutor.name[0]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-bold text-gray-900 truncate">{tutor.name}</h3>

            {/* Always show availability status — not just when available */}
            {tutor.isAvailable ? (
              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0">
                <CheckCircle2 className="w-3 h-3" />
                Available
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
                <XCircle className="w-3 h-3" />
                Unavailable
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-amber-500 mb-2">
            <Star className="w-4 h-4 fill-current" />
            <span className="font-semibold text-sm">{tutor.rating}</span>
            <span className="text-gray-400 text-sm">({tutor.totalReviews})</span>
          </div>

          <div className="flex flex-wrap gap-1">
            {tutor.subjects.slice(0, 2).map(subject => (
              <span key={subject.id} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md">
                {subject.name}
              </span>
            ))}
            {tutor.subjects.length > 2 && (
              <span className="text-xs text-gray-500 px-2 py-1">+{tutor.subjects.length - 2}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div>
          <div className="text-2xl font-bold text-indigo-600">{tutor.hourlyRate}</div>
          <div className="text-xs text-gray-500">tokens/hour</div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onViewProfile(tutor)}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:border-indigo-600 hover:text-indigo-600 transition-colors"
          >
            View Profile
          </button>
          <button
            onClick={() => tutor.isAvailable && onBook(tutor)}
            disabled={!tutor.isAvailable}
            title={!tutor.isAvailable ? 'This tutor is currently unavailable' : undefined}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              tutor.isAvailable
                ? 'text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-md cursor-pointer'
                : 'text-gray-400 bg-gray-100 cursor-not-allowed'
            }`}
          >
            Book Now
          </button>
        </div>
      </div>
    </motion.div>
  );
};
