'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { iconGroups, getIconDisplayName, type IconName } from '@/lib/icons/iconRegistry';
import WikiCategoryIcon from './WikiCategoryIcon';
import { useClickOutside } from '@/hooks/useEventListener';

interface IconSelectorProps {
  /** Currently selected icon name */
  value: string;
  /** Callback when icon selection changes */
  onChange: (iconName: string) => void;
  /** CSS classes for styling */
  className?: string;
  /** Placeholder text when no icon selected */
  placeholder?: string;
  /** Whether the selector is disabled */
  disabled?: boolean;
}

/**
 * Dropdown selector for wiki category icons
 * Organized by icon groups with visual previews
 */
export default function IconSelector({
  value,
  onChange,
  className = '',
  placeholder = 'Select an icon...',
  disabled = false,
}: IconSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Use safer event listener hook to prevent memory leaks
  useClickOutside(
    dropdownRef as React.RefObject<HTMLElement>,
    () => {
      setIsOpen(false);
      setSearchTerm('');
    },
    isOpen
  );

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Filter icons based on search term
  const filteredGroups = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return iconGroups;
    }

    const filtered: Record<string, IconName[]> = {};
    const lowercaseSearch = searchTerm.toLowerCase();

    Object.entries(iconGroups).forEach(([groupName, icons]) => {
      const matchingIcons = icons.filter(iconName => {
        const displayName = getIconDisplayName(iconName).toLowerCase();
        const iconKey = iconName.toLowerCase();
        return displayName.includes(lowercaseSearch) || iconKey.includes(lowercaseSearch);
      });

      if (matchingIcons.length > 0) {
        filtered[groupName] = matchingIcons;
      }
    });

    return filtered;
  }, [searchTerm]);

  const handleIconSelect = (iconName: string) => {
    onChange(iconName);
    setIsOpen(false);
    setSearchTerm('');
  };

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      setSearchTerm('');
    }
  };

  const hasResults = Object.keys(filteredGroups).length > 0;

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Selector Button */}
      <button
        type="button"
        onClick={toggleDropdown}
        disabled={disabled}
        className={`w-full rounded border border-neutral-300 bg-white px-3 py-2 text-left text-neutral-900 transition-colors focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white ${
          disabled
            ? 'cursor-not-allowed opacity-50'
            : 'hover:border-neutral-400 dark:hover:border-neutral-600'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {value ? (
              <>
                <WikiCategoryIcon iconName={value} size="w-4 h-4" />
                <span className="text-sm">{getIconDisplayName(value)}</span>
              </>
            ) : (
              <span className="text-sm text-neutral-500">{placeholder}</span>
            )}
          </div>
          <ChevronDownIcon
            className={`h-4 w-4 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-96 w-80 overflow-hidden rounded-md border border-neutral-300 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
          {/* Search Input */}
          <div className="border-b border-neutral-200 p-3 dark:border-neutral-700">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search icons..."
              className="w-full rounded border border-neutral-300 bg-neutral-50 px-2 py-1 text-sm text-neutral-900 placeholder-neutral-500 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            />
          </div>

          {/* Icons Grid - No categories or names */}
          <div className="max-h-64 overflow-y-auto p-3">
            {hasResults ? (
              <div className="grid grid-cols-6 gap-2">
                {Object.entries(filteredGroups).flatMap(([, icons]) =>
                  icons.map((iconName: string) => (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => handleIconSelect(iconName)}
                      className={`flex items-center justify-center rounded p-1.5 transition-all hover:scale-110 hover:bg-neutral-100 dark:hover:bg-neutral-700 ${
                        value === iconName
                          ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-500 dark:bg-blue-900/50 dark:text-blue-400'
                          : 'text-neutral-700 dark:text-neutral-300'
                      }`}
                      title={getIconDisplayName(iconName)}
                    >
                      <WikiCategoryIcon iconName={iconName} size="w-4 h-4" />
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-neutral-500">
                {searchTerm ? 'No icons found matching your search.' : 'No icons available.'}
              </div>
            )}
          </div>

          {/* Clear Selection */}
          {value && (
            <div className="border-t border-neutral-200 p-2 dark:border-neutral-700">
              <button
                type="button"
                onClick={() => handleIconSelect('')}
                className="w-full rounded px-2 py-1 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
