import React from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { SearchFilters as Filters } from '../../../types/tutor';

interface SearchFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onClear: () => void;
}

const SUBJECTS = ['All Subjects', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Programming', 'Calculus', 'Statistics'];

export const SearchFilters: React.FC<SearchFiltersProps> = ({ filters, onChange, onClear }) => {
  const hasActiveFilters = filters.subject || filters.minRating || filters.maxPrice || filters.availableNow;

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, subject, or course code..."
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
        />
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-gray-500">
          <SlidersHorizontal className="w-4 h-4" />
          <span className="text-sm font-medium">Filters:</span>
        </div>

        {/* Subject Dropdown */}
        <select
          value={filters.subject || ''}
          onChange={(e) => onChange({ ...filters, subject: e.target.value || undefined })}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-indigo-500 outline-none bg-white"
        >
          {SUBJECTS.map(subject => (
            <option key={subject} value={subject === 'All Subjects' ? '' : subject}>
              {subject}
            </option>
          ))}
        </select>

        {/* Rating Filter */}
        <select
          value={filters.minRating || ''}
          onChange={(e) => onChange({ ...filters, minRating: e.target.value ? parseInt(e.target.value) : undefined })}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-indigo-500 outline-none bg-white"
        >
          <option value="">Any Rating</option>
          <option value="4">4+ Stars</option>
          <option value="4.5">4.5+ Stars</option>
          <option value="5">5 Stars Only</option>
        </select>

        {/* Price Range */}
        <select
          value={filters.maxPrice || ''}
          onChange={(e) => onChange({ ...filters, maxPrice: e.target.value ? parseInt(e.target.value) : undefined })}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-indigo-500 outline-none bg-white"
        >
          <option value="">Any Price</option>
          <option value="300">Under 300 tokens</option>
          <option value="500">Under 500 tokens</option>
          <option value="800">Under 800 tokens</option>
        </select>

        {/* Available Now Toggle */}
        <label className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors">
          <input
            type="checkbox"
            checked={filters.availableNow || false}
            onChange={(e) => onChange({ ...filters, availableNow: e.target.checked })}
            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-700">Available Now</span>
        </label>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
};
