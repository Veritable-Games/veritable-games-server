'use client';

import { useState } from 'react';
import { logger } from '@/lib/utils/logger';

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  onExport?: () => Promise<void>;
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  onExport,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onExport) return;

    setIsExporting(true);
    try {
      await onExport();
    } catch (error) {
      logger.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/50 transition-all duration-300 hover:bg-neutral-800/30">
      <div className="flex items-center justify-between p-8">
        <button onClick={() => setIsOpen(!isOpen)} className="flex-1 text-left">
          <h2 className="text-3xl font-bold text-white">{title}</h2>
        </button>

        <div className="flex items-center gap-4">
          {onExport && (
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="group flex items-center gap-2 rounded-md border border-[#60a5fa]/40 bg-[#60a5fa]/10 px-4 py-2 text-sm font-medium text-[#60a5fa] transition-all hover:border-[#60a5fa]/60 hover:bg-[#60a5fa]/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isExporting ? (
                <span>Exporting...</span>
              ) : (
                <>
                  <svg
                    className="h-4 w-4 transition-transform group-hover:translate-y-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span>Export CSV</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center justify-center transition-transform hover:scale-110"
            aria-label={isOpen ? 'Collapse section' : 'Expand section'}
          >
            <svg
              className={`h-6 w-6 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {isOpen && <div className="border-t border-neutral-800 p-8">{children}</div>}
    </div>
  );
}
