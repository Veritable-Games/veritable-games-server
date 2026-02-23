'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { JournalNode } from '@/stores/journals/types';
import { logger } from '@/lib/utils/logger';

interface CreateJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (journal: JournalNode) => void;
}

/**
 * CreateJournalModal - Inline modal for creating new journal entries
 * Keeps user on the same page (no navigation away)
 */
export function CreateJournalModal({ isOpen, onClose, onCreated }: CreateJournalModalProps) {
  const [title, setTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setError(null);
    }
  }, [isOpen]);

  const handleCreate = async () => {
    // Guard against double-clicks/rapid submissions
    if (isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/journals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim() || undefined, // Let API auto-generate if empty
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create journal');
      }

      if (data.success && data.data) {
        // Call parent callback with new journal data
        onCreated(data.data);
        onClose();
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      logger.error('Error creating journal:', err);
      setError(err.message || 'Failed to create journal');
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCreating) {
      handleCreate();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-100">Create New Journal</h2>
          <button
            onClick={onClose}
            className="text-gray-400 transition-colors hover:text-gray-200"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Input */}
        <div className="mb-4">
          <label htmlFor="journal-title" className="mb-2 block text-sm font-medium text-gray-300">
            Journal Title (optional)
          </label>
          <input
            ref={inputRef}
            id="journal-title"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Journal - ${new Date().toLocaleString()}`}
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-500 transition-colors focus:border-blue-500/50 focus:outline-none"
            disabled={isCreating}
          />
          <p className="mt-1 text-xs text-gray-500">
            Leave empty to auto-generate a title with current date/time
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded border border-red-500/50 bg-red-500/20 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="rounded border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="flex items-center space-x-2 rounded bg-blue-500/20 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/30 disabled:opacity-50"
          >
            {isCreating ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Creating...</span>
              </>
            ) : (
              <span>Create Journal</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
