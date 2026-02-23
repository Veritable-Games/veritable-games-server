'use client';

/**
 * SourceBadge Component
 * Indicates whether a document is from the User Library or Anarchist Archive
 * Redesigned November 2025: Compact badge style matching LanguageCodeBadge
 */

import React from 'react';

interface SourceBadgeProps {
  source: 'library' | 'anarchist';
}

export function SourceBadge({ source }: SourceBadgeProps) {
  const isLibrary = source === 'library';

  // Base style matching LanguageCodeBadge
  const baseClasses = 'rounded border px-1.5 py-0.5 text-[10px] font-medium';

  // Color variations
  const colorClasses = isLibrary
    ? 'border-blue-400/50 bg-blue-800/10 text-blue-400'
    : 'border-green-400/50 bg-green-800/10 text-green-400';

  // Abbreviated labels
  const label = isLibrary ? 'UL' : 'AL';

  // Full names for tooltips
  const fullName = isLibrary ? 'User Library' : 'Anarchist Archive';

  return (
    <span className={`${baseClasses} ${colorClasses}`} title={fullName}>
      {label}
    </span>
  );
}
