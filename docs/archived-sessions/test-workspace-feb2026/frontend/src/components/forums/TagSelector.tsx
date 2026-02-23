'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ForumTag, TagSuggestion } from '@/lib/forums/tags';
import { fetchWithCSRF } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';

interface TagSelectorProps {
  selectedTags: ForumTag[];
  onTagsChange: (tags: ForumTag[]) => void;
  maxTags?: number;
  placeholder?: string;
  className?: string;
}

export function TagSelector({
  selectedTags,
  onTagsChange,
  maxTags = 10,
  placeholder = 'Add tags...',
  className = '',
}: TagSelectorProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch tag suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (inputValue.length < 2) {
        setSuggestions([]);
        setIsDropdownOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/forums/tags?action=search&q=${encodeURIComponent(inputValue)}&limit=10`
        );

        if (response.ok) {
          const data = await response.json();

          // Filter out already selected tags
          const filteredSuggestions = data.suggestions.filter(
            (suggestion: TagSuggestion) => !selectedTags.some(tag => tag.id === suggestion.id)
          );

          setSuggestions(filteredSuggestions);
          setIsDropdownOpen(filteredSuggestions.length > 0);
          setHighlightedIndex(-1);
        }
      } catch (error) {
        logger.error('Error fetching tag suggestions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [inputValue, selectedTags]);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (
        highlightedIndex >= 0 &&
        highlightedIndex < suggestions.length &&
        suggestions[highlightedIndex]
      ) {
        selectTag(suggestions[highlightedIndex]);
      } else if (inputValue.trim() && suggestions.length === 0) {
        // Create new tag if user presses enter and no suggestions
        createNewTag(inputValue.trim());
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
    } else if (e.key === 'Backspace' && inputValue === '' && selectedTags.length > 0) {
      // Remove last tag if backspace on empty input
      const lastTag = selectedTags[selectedTags.length - 1];
      if (lastTag) {
        removeTag(lastTag);
      }
    }
  };

  const selectTag = (suggestion: TagSuggestion) => {
    if (selectedTags.length >= maxTags) return;

    const newTag: ForumTag = {
      id: suggestion.id,
      name: suggestion.name,
      slug: suggestion.slug,
      description: '',
      color: '#6B7280',
      usage_count: suggestion.usage_count,
      created_at: '',
      updated_at: '',
    };

    onTagsChange([...selectedTags, newTag]);
    setInputValue('');
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const createNewTag = async (tagName: string) => {
    if (selectedTags.length >= maxTags) return;

    try {
      const response = await fetchWithCSRF('/api/forums/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tagName }),
      });

      if (response.ok) {
        const data = await response.json();
        onTagsChange([...selectedTags, data.tag]);
        setInputValue('');
      } else if (response.status === 403) {
        // User can't create tags, just ignore
        setInputValue('');
      }
    } catch (error) {
      logger.error('Error creating tag:', error);
      setInputValue('');
    }
  };

  const removeTag = (tagToRemove: ForumTag) => {
    onTagsChange(selectedTags.filter(tag => tag.id !== tagToRemove.id));
  };

  const handleSuggestionClick = (suggestion: TagSuggestion) => {
    selectTag(suggestion);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Selected tags and input */}
      <div className="flex min-h-[48px] flex-wrap items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 p-3 transition-colors focus-within:border-blue-500">
        {selectedTags.map(tag => (
          <span
            key={tag.id}
            className="inline-flex items-center rounded-md bg-gray-700 px-2 py-1 text-xs font-medium text-gray-200"
            style={{ backgroundColor: `${tag.color}20`, borderColor: tag.color }}
          >
            <span className="mr-1" style={{ color: tag.color }}>
              {tag.name}
            </span>
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-1 text-gray-400 transition-colors hover:text-gray-200"
            >
              ×
            </button>
          </span>
        ))}

        {selectedTags.length < maxTags && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => inputValue.length >= 2 && setIsDropdownOpen(suggestions.length > 0)}
            placeholder={selectedTags.length === 0 ? placeholder : ''}
            className="min-w-[120px] flex-1 border-none bg-transparent text-white placeholder-gray-400 outline-none"
          />
        )}

        {isLoading && (
          <div className="text-gray-400">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
          </div>
        )}
      </div>

      {/* Tag limit indicator */}
      {selectedTags.length >= maxTags && (
        <div className="mt-1 text-xs text-gray-400">Maximum {maxTags} tags allowed</div>
      )}

      {/* Suggestions dropdown */}
      {isDropdownOpen && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-800 shadow-lg">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className={`w-full border-b border-gray-700 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-gray-700 ${
                index === highlightedIndex ? 'bg-gray-700' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">{suggestion.name}</div>
                  <div className="text-xs text-gray-400">
                    Used in {suggestion.usage_count} topics
                  </div>
                </div>
                {suggestion.relevance_score && suggestion.relevance_score >= 90 && (
                  <div className="text-xs text-blue-400">Exact match</div>
                )}
              </div>
            </button>
          ))}

          {inputValue.trim() && suggestions.length > 0 && (
            <div className="border-t border-gray-700 px-4 py-2 text-xs text-gray-500">
              Press Enter to select highlighted, or create "{inputValue.trim()}"
            </div>
          )}
        </div>
      )}

      {/* No suggestions but can create */}
      {isDropdownOpen && suggestions.length === 0 && inputValue.length >= 2 && !isLoading && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 shadow-lg">
          <div className="px-4 py-3 text-gray-400">
            No tags found. Press Enter to create "{inputValue.trim()}"
          </div>
        </div>
      )}
    </div>
  );
}
