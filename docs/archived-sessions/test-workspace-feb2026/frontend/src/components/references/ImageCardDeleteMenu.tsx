'use client';

import { useState, useRef, useEffect } from 'react';
import type { ReferenceImageId } from '@/types/project-references';

interface ImageCardDeleteMenuProps {
  imageId: ReferenceImageId;
  imageName: string;
  isAdmin: boolean;
  isDeleted?: boolean;
  onSoftDelete: () => void;
  onPermanentDelete: () => void;
  onRestore?: () => void;
}

/**
 * Delete Menu Component for ImageCard
 *
 * Shows delete options in a dropdown:
 * - Hide (soft delete)
 * - Permanently Delete (admin only)
 * - Restore (if deleted)
 */
export function ImageCardDeleteMenu({
  imageId,
  imageName,
  isAdmin,
  isDeleted = false,
  onSoftDelete,
  onPermanentDelete,
  onRestore,
}: ImageCardDeleteMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSoftDelete = () => {
    setIsOpen(false);
    onSoftDelete();
  };

  const handlePermanentDelete = () => {
    setIsOpen(false);
    onPermanentDelete();
  };

  const handleRestore = () => {
    setIsOpen(false);
    onRestore?.();
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={e => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-700/50 hover:text-gray-200"
        title="Delete options"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-40 mt-1 w-48 rounded-lg border border-gray-700 bg-gray-800 shadow-lg">
          {isDeleted && onRestore ? (
            <>
              <button
                onClick={handleRestore}
                className="w-full px-4 py-2 text-left text-sm text-blue-300 transition-colors first:rounded-t-lg hover:bg-gray-700/50"
              >
                ↶ Restore
              </button>
              {isAdmin && (
                <button
                  onClick={handlePermanentDelete}
                  className="w-full border-t border-gray-700 px-4 py-2 text-left text-sm text-red-400 transition-colors last:rounded-b-lg hover:bg-gray-700/50"
                >
                  🗑️ Delete Forever
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={handleSoftDelete}
                className="w-full px-4 py-2 text-left text-sm text-gray-300 transition-colors first:rounded-t-lg hover:bg-gray-700/50"
              >
                👁️ Hide from Gallery
              </button>
              {isAdmin && (
                <button
                  onClick={handlePermanentDelete}
                  className="w-full border-t border-gray-700 px-4 py-2 text-left text-sm text-red-400 transition-colors last:rounded-b-lg hover:bg-gray-700/50"
                >
                  🗑️ Delete Permanently
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
