/**
 * Language Code Badge Component
 * Displays language codes as faint bordered boxes (e.g., [EN][FR][ES])
 * Shown in top-right corner of document cards
 */

'use client';

interface LanguageCodeBadgeProps {
  languageCodes: string[]; // e.g., ['EN', 'FR', 'ES']
}

export function LanguageCodeBadge({ languageCodes }: LanguageCodeBadgeProps) {
  if (languageCodes.length === 0) return null;

  return (
    <div className="absolute right-2 top-2 flex gap-0.5">
      {languageCodes.map(code => (
        <span
          key={code}
          className="rounded border border-gray-600/40 bg-gray-800/20 px-1.5 py-0.5 text-[10px] font-medium text-gray-300"
        >
          {code}
        </span>
      ))}
    </div>
  );
}
