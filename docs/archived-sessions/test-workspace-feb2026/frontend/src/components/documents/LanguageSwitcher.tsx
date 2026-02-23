'use client';

/**
 * LanguageSwitcher Component
 * Dropdown to switch between different language versions of a document
 * Displayed on document detail pages when translations are available
 */

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { getLanguageName } from '@/lib/documents/types';
import type { DocumentTranslation } from '@/lib/documents/types';

interface LanguageSwitcherProps {
  currentLanguage: string;
  currentSlug: string;
  translations: DocumentTranslation[];
  className?: string;
}

export function LanguageSwitcher({
  currentLanguage,
  currentSlug,
  translations,
  className = '',
}: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  if (translations.length <= 1) {
    return null; // Don't show if only one language
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sort translations: current language first, then English, then alphabetical
  const sortedTranslations = [...translations].sort((a, b) => {
    if (a.language === currentLanguage) return -1;
    if (b.language === currentLanguage) return 1;
    if (a.language === 'en') return -1;
    if (b.language === 'en') return 1;
    return getLanguageName(a.language).localeCompare(getLanguageName(b.language));
  });

  const currentTranslation = translations.find(t => t.language === currentLanguage);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
      >
        {/* Globe Icon */}
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20H7m6-4h.01M9 20h6"
          />
        </svg>
        <span>{getLanguageName(currentLanguage)}</span>
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180 transform' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* Header */}
          <div className="border-b border-gray-200 px-4 py-3">
            <p className="text-xs font-semibold uppercase text-gray-500">Available Translations</p>
          </div>

          {/* Language List */}
          <div className="max-h-72 overflow-y-auto py-2">
            {sortedTranslations.map(translation => {
              const isCurrentLanguage = translation.language === currentLanguage;
              const displayName = getLanguageName(translation.language);

              return (
                <Link
                  key={`${translation.language}-${translation.slug}`}
                  href={`/library/${translation.slug}`}
                  onClick={() => setIsOpen(false)}
                  className={`block px-4 py-2.5 text-sm transition-colors ${
                    isCurrentLanguage
                      ? 'bg-blue-50 font-medium text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{displayName}</span>
                    {isCurrentLanguage && (
                      <svg
                        className="h-4 w-4 text-blue-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  {translation.title && translation.title !== currentTranslation?.title && (
                    <p className="mt-1 truncate text-xs text-gray-500">{translation.title}</p>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-600">
            {translations.length} translation{translations.length !== 1 ? 's' : ''} available
          </div>
        </div>
      )}
    </div>
  );
}
