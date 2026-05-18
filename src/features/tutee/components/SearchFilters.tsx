// src/features/tutee/components/SearchFilters.tsx — FULL REPLACEMENT
//
// Fix: Subject dropdown now fetches live data from the database via
//      tutorApi.getSubjects() instead of using a hardcoded SUBJECTS array.

import React, { useEffect, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { SearchFilters as Filters } from '../../../types/tutor';
import { tutorApi } from '../../../api/tutorApi';

interface SubjectOption {
  id: string;
  name: string;
}

type SubjectResponse = {
  id?: string;
  name?: string;
};

interface SearchFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onClear: () => void;
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({ filters, onChange, onClear }) => {
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const hasActiveFilters = filters.subject || filters.minRating || filters.maxPrice || filters.availableNow;

  useEffect(() => {
    tutorApi.getSubjects()
      .then((res) => {
        // Normalise: backend returns { success, data: [...] }
        const raw: SubjectResponse[] = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res)
          ? (res as SubjectResponse[])
          : [];
        setSubjects(raw.map((s) => ({ id: s.id || '', name: s.name || 'General' })));
      })
      .catch(() => {
        // Silently fail — dropdown will only show "All Subjects"
      });
  }, []);

  return (
    <div className="app-panel space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, subject, or course code..."
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          className="app-input py-3 pl-12"
        />
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-gray-500">
          <SlidersHorizontal className="w-4 h-4" />
          <span className="text-sm font-medium">Filters:</span>
        </div>

        {/* Subject Dropdown — live from DB */}
        <select
          value={filters.subject || ''}
          onChange={(e) => onChange({ ...filters, subject: e.target.value || undefined })}
          className="app-select"
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>

        {/* Rating Filter */}
        <select
          value={filters.minRating || ''}
          onChange={(e) => onChange({ ...filters, minRating: e.target.value ? parseInt(e.target.value) : undefined })}
          className="app-select"
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
          className="app-select"
        >
          <option value="">Any Price</option>
          <option value="300">Under 300 tokens</option>
          <option value="500">Under 500 tokens</option>
          <option value="800">Under 800 tokens</option>
        </select>

        {/* Available Now Toggle */}
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50">
          <input
            type="checkbox"
            checked={filters.availableNow || false}
            onChange={(e) => onChange({ ...filters, availableNow: e.target.checked })}
            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
          />
          <span className="font-medium text-slate-700">Available Now</span>
        </label>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="app-button-danger px-3 py-2"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
};
