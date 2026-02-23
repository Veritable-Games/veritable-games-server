'use client';

/**
 * LanguageFilter Component
 * Filter documents by language in the library sidebar
 * Dropdown for single language selection
 */

import React, { useState, useEffect } from 'react';
import { LanguageIcon } from '@heroicons/react/24/outline';
import { getLanguageName } from '@/lib/documents/types';
import type { LanguageInfo } from '@/lib/documents/types';
import { logger } from '@/lib/utils/logger';

interface LanguageFilterProps {
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  isLoading?: boolean;
}

export function LanguageFilter({
  selectedLanguage,
  onLanguageChange,
  isLoading = false,
}: LanguageFilterProps) {
  const [languages, setLanguages] = useState<LanguageInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch available languages
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/documents/languages');
        if (response.ok) {
          const result = await response.json();
          setLanguages(result.data || []);
        }
      } catch (error) {
        logger.error('Failed to fetch languages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLanguages();
  }, []);

  // Group languages by common ones first
  const majorLanguages = ['en', 'de', 'es', 'fr', 'it', 'pt'];
  const sortedLanguages = languages.sort((a, b) => {
    const aIsMajor = majorLanguages.includes(a.code);
    const bIsMajor = majorLanguages.includes(b.code);
    if (aIsMajor && !bIsMajor) return -1;
    if (!aIsMajor && bIsMajor) return 1;
    return b.document_count - a.document_count;
  });

  return (
    <div className="border-b border-gray-700/50 pb-4">
      {/* Header */}
      <h3 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
        <LanguageIcon className="h-4 w-4" />
        Language
      </h3>

      {/* Language dropdown */}
      {loading ? (
        <div className="py-4 text-center">
          <div className="inline-block animate-spin">
            <svg
              className="h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
        </div>
      ) : (
        <select
          value={selectedLanguage}
          onChange={e => onLanguageChange(e.target.value)}
          disabled={isLoading}
          className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sortedLanguages.map(language => (
            <option key={language.code} value={language.code}>
              {getLanguageName(language.code)} ({language.document_count})
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
