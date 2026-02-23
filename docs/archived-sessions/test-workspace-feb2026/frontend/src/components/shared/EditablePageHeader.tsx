'use client';

/**
 * Editable Page Header Component
 * Ctrl+click to edit title and description (admin only)
 *
 * Usage:
 * <EditablePageHeader
 *   title="Financial Transparency"
 *   description="Our commitment to open finances"
 *   isEditable={isAdmin}
 *   pageSlug="donate-transparency"
 * />
 */

import { useState } from 'react';
import { fetchJSON } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';

interface EditablePageHeaderProps {
  title: string;
  description?: string;
  isEditable?: boolean;
  pageSlug: string;
  className?: string;
}

export function EditablePageHeader({
  title: initialTitle,
  description: initialDescription = '',
  isEditable = false,
  pageSlug,
  className = '',
}: EditablePageHeaderProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleTitleClick = (e: React.MouseEvent) => {
    if (!isEditable) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setIsEditingTitle(true);
    }
  };

  const handleDescClick = (e: React.MouseEvent) => {
    if (!isEditable) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setIsEditingDesc(true);
    }
  };

  const saveChanges = async (field: 'title' | 'description', value: string) => {
    setIsSaving(true);
    try {
      await fetchJSON('/api/admin/page-headers', {
        method: 'PUT',
        body: JSON.stringify({
          pageSlug,
          field,
          value,
        }),
      });
    } catch (error) {
      logger.error('Failed to save header change', { field, error });
      // Revert to original value on error
      if (field === 'title') {
        setTitle(initialTitle);
      } else {
        setDescription(initialDescription);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (title !== initialTitle) {
      saveChanges('title', title);
    }
  };

  const handleDescBlur = () => {
    setIsEditingDesc(false);
    if (description !== initialDescription) {
      saveChanges('description', description);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsEditingTitle(false);
      if (title !== initialTitle) {
        saveChanges('title', title);
      }
    } else if (e.key === 'Escape') {
      setTitle(initialTitle);
      setIsEditingTitle(false);
    }
  };

  const handleDescKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsEditingDesc(false);
      if (description !== initialDescription) {
        saveChanges('description', description);
      }
    } else if (e.key === 'Escape') {
      setDescription(initialDescription);
      setIsEditingDesc(false);
    }
  };

  const titleClasses = isEditable
    ? 'cursor-text text-3xl font-bold text-white transition-colors hover:text-gray-300'
    : 'text-3xl font-bold text-white';

  const descClasses = isEditable
    ? 'cursor-text text-gray-400 transition-colors hover:text-gray-300'
    : 'text-gray-400';

  return (
    <div className={`mb-8 text-center ${className}`}>
      {isEditingTitle ? (
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          autoFocus
          disabled={isSaving}
          className="mb-2 w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-center text-3xl font-bold text-white focus:border-blue-600 focus:outline-none disabled:opacity-50"
        />
      ) : (
        <h1
          onClick={handleTitleClick}
          className={`mb-2 ${titleClasses}`}
          title={isEditable ? 'Ctrl+click to edit' : undefined}
        >
          {title}
          {isSaving && <span className="ml-2 text-sm text-gray-500">(saving...)</span>}
        </h1>
      )}

      {description &&
        (isEditingDesc ? (
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={handleDescBlur}
            onKeyDown={handleDescKeyDown}
            autoFocus
            disabled={isSaving}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-center text-gray-400 focus:border-blue-600 focus:outline-none disabled:opacity-50"
          />
        ) : (
          <p
            onClick={handleDescClick}
            className={descClasses}
            title={isEditable ? 'Ctrl+click to edit' : undefined}
          >
            {description}
          </p>
        ))}
    </div>
  );
}
