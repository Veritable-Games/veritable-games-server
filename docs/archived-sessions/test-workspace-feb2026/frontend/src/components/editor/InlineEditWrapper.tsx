'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { UnifiedMarkdownEditor } from './UnifiedMarkdownEditor';
import { Pencil, X, Save, Loader2, AlertCircle, Check } from 'lucide-react';

export interface InlineEditWrapperProps {
  /** The current content to display/edit */
  content: string;
  /** Callback when content is saved successfully */
  onSave: (
    newContent: string,
    editSummary?: string
  ) => Promise<{ success: boolean; error?: string }>;
  /** Optional callback when editing starts */
  onEditStart?: () => void;
  /** Optional callback when editing is cancelled */
  onEditCancel?: () => void;
  /** Whether the user can edit this content */
  canEdit: boolean;
  /** The rendered content to display in view mode */
  children: React.ReactNode;
  /** Editor features level */
  features?: 'simple' | 'full';
  /** Placeholder text for the editor */
  placeholder?: string;
  /** Minimum rows for the editor */
  minRows?: number;
  /** Show edit summary field */
  showEditSummary?: boolean;
  /** Custom class name for the wrapper */
  className?: string;
  /** Label for the edit button (accessibility) */
  editLabel?: string;
  /**
   * Custom render function for the edit trigger
   * When provided, the default floating edit button is hidden
   * and this function is used to render the edit trigger instead
   */
  renderEditTrigger?: (startEdit: () => void) => React.ReactNode;
}

/**
 * InlineEditWrapper - Enables in-place editing without navigation
 *
 * Wraps content display components and provides a seamless edit/view toggle.
 * When editing, shows the UnifiedMarkdownEditor. When viewing, shows children.
 */
export function InlineEditWrapper({
  content,
  onSave,
  onEditStart,
  onEditCancel,
  canEdit,
  children,
  features = 'full',
  placeholder = 'Start writing...',
  minRows = 15,
  showEditSummary = true,
  className = '',
  editLabel = 'Edit content',
  renderEditTrigger,
}: InlineEditWrapperProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [editSummary, setEditSummary] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset edit content when original content changes
  useEffect(() => {
    if (!isEditing) {
      setEditContent(content);
    }
  }, [content, isEditing]);

  // Clear success message after delay
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
    setEditContent(content);
    setEditSummary('');
    setError(null);
    onEditStart?.();
  }, [content, onEditStart]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditContent(content);
    setEditSummary('');
    setError(null);
    onEditCancel?.();
  }, [content, onEditCancel]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;

    // Don't save if content hasn't changed
    if (editContent.trim() === content.trim()) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = await onSave(editContent, editSummary || undefined);

      if (result.success) {
        setIsEditing(false);
        setSuccess(true);
        setEditSummary('');
      } else {
        setError(result.error || 'Failed to save changes');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  }, [editContent, editSummary, content, onSave, isSaving]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isEditing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelEdit();
      }
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, handleCancelEdit, handleSave]);

  const hasChanges = editContent.trim() !== content.trim();

  if (!isEditing) {
    return (
      <div className={className}>
        {/* Content display */}
        {children}

        {/* Success indicator */}
        {success && (
          <div className="mt-4 flex items-center gap-1.5 text-sm text-green-400">
            <Check size={14} />
            <span>Changes saved</span>
          </div>
        )}

        {/* Custom edit trigger (if provided) */}
        {canEdit && !success && renderEditTrigger && renderEditTrigger(handleStartEdit)}
      </div>
    );
  }

  // Edit mode
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Edit mode header */}
      <div className="flex items-center justify-between border-b border-gray-700 pb-3">
        <div className="flex items-center gap-2 text-sm text-blue-400">
          <Pencil size={16} />
          <span className="font-medium">Editing</span>
          {hasChanges && (
            <span className="rounded bg-yellow-900/50 px-2 py-0.5 text-xs text-yellow-400">
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCancelEdit}
            disabled={isSaving}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-600 bg-gray-800 px-3 text-sm text-gray-300 transition-colors hover:border-gray-500 hover:bg-gray-700 disabled:opacity-50"
          >
            <X size={14} />
            <span className="hidden sm:inline">Cancel</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !editContent.trim()}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span className="hidden sm:inline">Saving...</span>
              </>
            ) : (
              <>
                <Save size={14} />
                <span className="hidden sm:inline">Save</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-700/50 bg-red-900/20 p-3">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-400">Failed to save</p>
            <p className="mt-0.5 text-sm text-red-300">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 transition-colors hover:text-red-300"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Edit summary field */}
      {showEditSummary && (
        <div>
          <label htmlFor="edit-summary" className="mb-1.5 block text-sm font-medium text-gray-400">
            Edit summary{' '}
            <span className="font-normal text-gray-500">(briefly describe your changes)</span>
          </label>
          <input
            type="text"
            id="edit-summary"
            value={editSummary}
            onChange={e => setEditSummary(e.target.value)}
            placeholder="e.g., Fixed typo, Added new section, Updated outdated info"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={isSaving}
          />
        </div>
      )}

      {/* Editor */}
      <UnifiedMarkdownEditor
        content={editContent}
        onChange={setEditContent}
        placeholder={placeholder}
        features={features}
        minRows={minRows}
        disabled={isSaving}
        onSave={handleSave}
      />

      {/* Mobile action buttons */}
      <div className="flex flex-col gap-2 border-t border-gray-700 pt-4 sm:hidden">
        <button
          onClick={handleSave}
          disabled={isSaving || !editContent.trim()}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save size={18} />
              Save Changes
            </>
          )}
        </button>
        <button
          onClick={handleCancelEdit}
          disabled={isSaving}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-600 text-gray-300 transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          <X size={18} />
          Cancel
        </button>
      </div>

      {/* Keyboard shortcuts hint */}
      <p className="hidden text-xs text-gray-500 sm:block">
        <kbd className="rounded bg-gray-700 px-1.5 py-0.5">Esc</kbd> to cancel •{' '}
        <kbd className="rounded bg-gray-700 px-1.5 py-0.5">Ctrl+S</kbd> to save
      </p>
    </div>
  );
}

export default InlineEditWrapper;
