'use client';

import { useState, useRef, useEffect } from 'react';
import { XMarkIcon, PlusIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { logger } from '@/lib/utils/logger';

interface Tag {
  id: number;
  name: string;
  color?: string;
}

interface InlineTagEditorProps {
  pageSlug: string;
  initialTags: Tag[];
  allTags: Tag[];
  canEdit: boolean;
  onTagsChange?: (tags: Tag[]) => void;
  apiPrefix?: string; // Optional API prefix (default: '/api/wiki/pages')
}

export default function InlineTagEditor({
  pageSlug,
  initialTags = [],
  allTags = [],
  canEdit,
  onTagsChange,
  apiPrefix = '/api/wiki/pages', // Default to wiki API
}: InlineTagEditorProps) {
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredTagId, setHoveredTagId] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevInitialTagsRef = useRef<string>('');

  // Update tags when initialTags change (compare by content, not reference)
  useEffect(() => {
    const newIds = initialTags
      .map(t => t.id)
      .sort()
      .join(',');

    if (prevInitialTagsRef.current !== newIds) {
      prevInitialTagsRef.current = newIds;
      setTags(initialTags);
    }
  }, [initialTags]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  // Filter suggestions based on input
  useEffect(() => {
    if (inputValue.trim()) {
      const filtered = allTags.filter(
        tag =>
          !tags.some(t => t.id === tag.id) &&
          tag.name.toLowerCase().includes(inputValue.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 10));
      setSelectedIndex(-1);
    } else {
      setSuggestions([]);
      setSelectedIndex(-1);
    }
  }, [inputValue, tags, allTags]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsEditing(false);
        setInputValue('');
        // Don't clear error - user must manually dismiss with X button
      }
    }

    if (isEditing) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isEditing]);

  // Add tag with optimistic update
  const addTag = async (tagName: string) => {
    const trimmedName = tagName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!trimmedName) return;

    // Check if tag already exists in current tags
    if (tags.some(t => t.name === trimmedName)) {
      setError('Tag already added');
      return;
    }

    setIsLoading(true);
    // Don't clear error here - let it persist until success or new error

    // Find existing tag or create optimistic tag
    const existingTag = allTags.find(t => t.name === trimmedName);
    const optimisticTag: Tag = existingTag || {
      id: Date.now(), // Temporary ID
      name: trimmedName,
      color: '#3b82f6',
    };

    // Optimistic update
    const newTags = [...tags, optimisticTag];
    setTags(newTags);
    setInputValue('');

    try {
      // Get CSRF token from cookie
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf_token='))
        ?.split('=')[1];

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Add CSRF token if available
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await fetch(`${apiPrefix}/${encodeURIComponent(pageSlug)}/tags`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(existingTag ? { tagId: existingTag.id } : { tagNames: [trimmedName] }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to add tag';
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
          try {
            const data = await response.json();
            errorMessage = data.error || errorMessage;
          } catch (parseError) {
            logger.error('Failed to parse JSON error response', {
              error: parseError,
              status: response.status,
            });
            errorMessage = `Server error (${response.status}): ${response.statusText}`;
          }
        } else {
          // Response is not JSON (likely HTML error page)
          logger.error('Non-JSON error response', {
            status: response.status,
            statusText: response.statusText,
            contentType,
          });
          errorMessage = `Server error (${response.status}): ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const addedTag = data.addedTags?.[0];

      if (addedTag) {
        // Replace optimistic tag with real tag
        setTags(prevTags => prevTags.map(t => (t.id === optimisticTag.id ? addedTag : t)));
        onTagsChange?.(newTags.map(t => (t.id === optimisticTag.id ? addedTag : t)));
        // Clear error on success
        setError(null);
      }
    } catch (err: any) {
      // Revert optimistic update on error
      setTags(tags);
      const errorMsg = err.message || 'Failed to add tag';
      logger.error('Add tag error', { error: err, pageSlug, tagName: trimmedName });
      setError(`${errorMsg} (slug: ${pageSlug})`);
    } finally {
      setIsLoading(false);
    }
  };

  // Remove tag with optimistic update
  const removeTag = async (tagId: number) => {
    if (!canEdit) return;

    setIsLoading(true);
    // Don't clear error here - let it persist until success or new error

    // Optimistic update
    const originalTags = tags;
    const newTags = tags.filter(t => t.id !== tagId);
    setTags(newTags);

    try {
      // Get CSRF token from cookie
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf_token='))
        ?.split('=')[1];

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Add CSRF token if available
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await fetch(`${apiPrefix}/${encodeURIComponent(pageSlug)}/tags`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
        body: JSON.stringify({ tagId }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to remove tag';
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
          try {
            const data = await response.json();
            errorMessage = data.error || errorMessage;
          } catch (parseError) {
            logger.error('Failed to parse JSON error response', {
              error: parseError,
              status: response.status,
            });
            errorMessage = `Server error (${response.status}): ${response.statusText}`;
          }
        } else {
          // Response is not JSON (likely HTML error page)
          logger.error('Non-JSON error response', {
            status: response.status,
            statusText: response.statusText,
            contentType,
          });
          errorMessage = `Server error (${response.status}): ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      onTagsChange?.(newTags);
      // Clear error on success
      setError(null);
    } catch (err: any) {
      // Revert optimistic update on error
      setTags(originalTags);
      const errorMsg = err.message || 'Failed to remove tag';
      logger.error('Remove tag error', { error: err, pageSlug, tagId });
      setError(`${errorMsg} (tag ID: ${tagId})`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        addTag(suggestions[selectedIndex].name);
      } else if (inputValue.trim()) {
        // Handle comma-separated tags
        const tagNames = inputValue.split(',').map(t => t.trim());
        tagNames.forEach(name => {
          if (name) addTag(name);
        });
      }
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setInputValue('');
      // Don't clear error on close - let user manually dismiss it
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      // Remove last tag on backspace if input is empty
      const lastTag = tags[tags.length - 1];
      if (lastTag) {
        removeTag(lastTag.id);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setIsEditing(false);
      setInputValue('');
    }
  };

  return (
    <div className="mt-6 border-t border-gray-700 pt-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">Tags</h3>
      </div>

      {/* Tag Display and Input Area */}
      <div ref={containerRef} className="relative">
        <div
          className={`flex min-h-[32px] flex-wrap items-center gap-2 ${isEditing ? 'pb-2' : ''}`}
          onClick={() => canEdit && !isEditing && setIsEditing(true)}
        >
          {/* Current Tags */}
          {tags.length === 0 && !isEditing ? (
            <span key="no-tags" className="text-sm italic text-gray-500">
              No tags
            </span>
          ) : (
            tags.map(tag => (
              <div
                key={tag.id}
                className="group relative inline-flex h-6 items-center rounded-full border border-blue-500/30 bg-blue-500/20 py-1 pl-2.5 pr-1.5 text-xs font-medium text-blue-300 transition-all duration-200 hover:border-blue-400/50 hover:bg-blue-500/30"
                onMouseEnter={() => canEdit && setHoveredTagId(tag.id)}
                onMouseLeave={() => setHoveredTagId(null)}
              >
                <span className={canEdit && (hoveredTagId === tag.id || isEditing) ? 'pr-3' : ''}>
                  {tag.name}
                </span>
                {canEdit && (hoveredTagId === tag.id || isEditing) && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      removeTag(tag.id);
                    }}
                    className="absolute right-0.5 flex items-center justify-center text-gray-400 transition-colors duration-150 hover:text-gray-200"
                    disabled={isLoading}
                    title="Remove tag"
                    aria-label={`Remove ${tag.name} tag`}
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))
          )}

          {/* Input Field (inline when editing) */}
          {isEditing && (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type tag name..."
              className="inline-flex min-w-[140px] rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
              aria-label="Tag input"
              aria-expanded={suggestions.length > 0}
              aria-activedescendant={selectedIndex >= 0 ? `suggestion-${selectedIndex}` : undefined}
              role="combobox"
              aria-autocomplete="list"
              aria-controls="tag-suggestions"
            />
          )}

          {/* Add Tags Button (when not editing) */}
          {canEdit && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1 rounded-md border border-transparent px-2.5 py-1 text-xs font-medium text-blue-400 transition-all duration-200 hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-300"
              disabled={isLoading}
              aria-label="Add tags"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Add tags
            </button>
          )}
        </div>

        {/* Autocomplete Dropdown */}
        {isEditing && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            id="tag-suggestions"
            className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-gray-600 bg-gray-800 shadow-xl transition-all duration-150 ease-out"
            role="listbox"
          >
            {suggestions.map((tag, index) => (
              <button
                key={tag.id}
                id={`suggestion-${index}`}
                onClick={() => addTag(tag.name)}
                className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-500/30 text-blue-300'
                    : 'text-gray-300 hover:bg-blue-500/20 hover:text-blue-300'
                }`}
                disabled={isLoading}
                role="option"
                aria-selected={index === selectedIndex}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Helper Text */}
      {isEditing && (
        <p className="mt-2 text-xs text-gray-500">
          Press{' '}
          <kbd className="rounded border border-gray-600 bg-gray-800 px-1.5 py-0.5 text-xs font-semibold text-gray-400">
            Enter
          </kbd>{' '}
          to add,
          <kbd className="mx-1 rounded border border-gray-600 bg-gray-800 px-1.5 py-0.5 text-xs font-semibold text-gray-400">
            ,
          </kbd>{' '}
          for multiple,
          <kbd className="mx-1 rounded border border-gray-600 bg-gray-800 px-1.5 py-0.5 text-xs font-semibold text-gray-400">
            Esc
          </kbd>{' '}
          to cancel,
          <kbd className="mx-1 rounded border border-gray-600 bg-gray-800 px-1.5 py-0.5 text-xs font-semibold text-gray-400">
            Tab
          </kbd>{' '}
          to close
        </p>
      )}

      {/* Error Message - Persistent with close button */}
      {error && (
        <div
          className="mt-4 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-900/30 px-3 py-2 text-xs text-red-300"
          role="alert"
          aria-live="polite"
        >
          <ExclamationCircleIcon className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="flex-shrink-0 transition-colors hover:text-red-200"
            aria-label="Close error message"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400" aria-live="polite">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          Updating tags...
        </div>
      )}
    </div>
  );
}
