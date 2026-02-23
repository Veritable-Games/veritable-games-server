/**
 * JumpToDocument Component
 *
 * Allows users to jump to a specific document index in the virtual scrolled list
 * Enables navigation to arbitrary positions (e.g., document #15,000)
 */

'use client';

import { useState } from 'react';
import type { VirtuosoHandle } from 'react-virtuoso';

interface JumpToDocumentProps {
  totalCount: number;
  virtuosoRef: React.RefObject<VirtuosoHandle | null>;
  viewMode: 'grid' | 'list';
}

export function JumpToDocument({ totalCount, virtuosoRef, viewMode }: JumpToDocumentProps) {
  const [jumpIndex, setJumpIndex] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleJump = () => {
    const index = parseInt(jumpIndex, 10);

    // Validation
    if (isNaN(index)) {
      setError('Please enter a valid number');
      return;
    }

    if (index < 0 || index >= totalCount) {
      setError(`Please enter a number between 0 and ${totalCount - 1}`);
      return;
    }

    // Clear error
    setError(null);

    // Calculate target index based on view mode
    // Grid view: 2 docs per row, so divide by 2
    const targetIndex = viewMode === 'grid' ? Math.floor(index / 2) : index;

    // Scroll to index
    virtuosoRef.current?.scrollToIndex({
      index: targetIndex,
      align: 'start',
      behavior: 'smooth',
    });

    // Clear input after successful jump
    setJumpIndex('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJump();
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={totalCount - 1}
          value={jumpIndex}
          onChange={e => {
            setJumpIndex(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Jump to #"
          className="w-32 rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          aria-label="Jump to document number"
        />
        <button
          onClick={handleJump}
          disabled={!jumpIndex}
          className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Jump to document"
        >
          Go
        </button>
        <span className="text-xs text-gray-400">of {totalCount.toLocaleString()}</span>
      </div>
      {error && (
        <span className="text-xs text-red-400" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
