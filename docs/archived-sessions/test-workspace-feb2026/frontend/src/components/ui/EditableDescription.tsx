'use client';

import { useState, useRef, useEffect } from 'react';
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { logger } from '@/lib/utils/logger';

interface EditableDescriptionProps {
  pageKey: string;
  initialText: string;
  className?: string;
}

export function EditableDescription({
  pageKey,
  initialText,
  className = '',
}: EditableDescriptionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(initialText);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Move cursor to end
      inputRef.current.setSelectionRange(text.length, text.length);
    }
  }, [isEditing, text.length]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/settings/descriptions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageKey, text }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save description');
      }

      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      logger.error('Error saving description:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setText(initialText);
    setIsEditing(false);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className="group">
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`${className} flex-1 cursor-text border-b border-blue-500 bg-transparent focus:outline-none`}
              disabled={isSaving}
            />
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="p-1 text-green-400 transition-colors hover:text-green-300 disabled:opacity-50"
              aria-label="Save"
              title="Save (Enter)"
            >
              <CheckIcon className="h-5 w-5" />
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="p-1 text-red-400 transition-colors hover:text-red-300 disabled:opacity-50"
              aria-label="Cancel"
              title="Cancel (Esc)"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </>
        ) : (
          <>
            <p className={className}>{text}</p>
            <button
              onClick={() => setIsEditing(true)}
              className="text-gray-400 opacity-0 transition-opacity hover:text-blue-400 group-hover:opacity-100"
              aria-label="Edit description"
              title="Edit this text"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  );
}
