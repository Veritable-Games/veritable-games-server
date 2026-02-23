'use client';

import React, { useEffect, useState } from 'react';
import { useJournalsEditor } from '@/stores/journals/useJournalsEditor';
import { logger } from '@/lib/utils/logger';

interface JournalsEditorProps {
  slug: string;
  initialContent: string;
  title: string;
  isDeleted?: boolean;
  onDelete?: () => void;
  onRestore?: () => void;
}

/**
 * JournalsEditor - Plain text editor with manual save
 * Minimal Zim-like interface for journaling
 */
export function JournalsEditor({
  slug,
  initialContent,
  title,
  isDeleted = false,
  onDelete,
  onRestore,
}: JournalsEditorProps) {
  const { setCurrentContent, currentContent } = useJournalsEditor();

  // Manual save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  // Delete/Restore state
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [deleted, setDeleted] = useState(isDeleted);

  // Sync initial content and delete status when slug changes
  useEffect(() => {
    setCurrentContent(initialContent || '');
    setSaveStatus('idle');
    setDeleted(isDeleted);
  }, [slug, initialContent, isDeleted, setCurrentContent]);

  // Delete function
  const handleDelete = async () => {
    if (!confirm('Delete this journal? You can restore it later.')) {
      return;
    }

    setIsDeleting(true);

    try {
      // Get journal ID
      const response = await fetch(`/api/journals?slug=${slug}`);
      const data = await response.json();

      if (!data.success || !data.data) {
        throw new Error('Failed to get journal ID');
      }

      const journalId = data.data.id;

      // Call delete API
      const deleteResponse = await fetch('/api/journals/bulk-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journalIds: [journalId],
          permanent: false,
        }),
      });

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json();
        throw new Error(errorData.error || 'Failed to delete journal');
      }

      setDeleted(true);
      setSaveStatus('success');
      setSaveMessage('Journal deleted');

      // Update parent state
      if (onDelete) {
        onDelete();
      }

      setTimeout(() => {
        setSaveStatus('idle');
        setSaveMessage('');
      }, 3000);
    } catch (error: any) {
      logger.error('Delete error:', error);
      setSaveStatus('error');
      setSaveMessage(error.message || 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  // Restore function
  const handleRestore = async () => {
    setIsRestoring(true);

    try {
      // Get journal ID
      const response = await fetch(`/api/journals?slug=${slug}`);
      const data = await response.json();

      if (!data.success || !data.data) {
        throw new Error('Failed to get journal ID');
      }

      const journalId = data.data.id;

      // Call restore API
      const restoreResponse = await fetch('/api/journals/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journalIds: [journalId],
        }),
      });

      if (!restoreResponse.ok) {
        const errorData = await restoreResponse.json();
        throw new Error(errorData.error?.message || 'Failed to restore journal');
      }

      setDeleted(false);
      setSaveStatus('success');
      setSaveMessage('Journal restored');

      // Update parent state
      if (onRestore) {
        onRestore();
      }

      setTimeout(() => {
        setSaveStatus('idle');
        setSaveMessage('');
      }, 3000);
    } catch (error: any) {
      logger.error('Restore error:', error);
      setSaveStatus('error');
      setSaveMessage(error.message || 'Failed to restore');
    } finally {
      setIsRestoring(false);
    }
  };

  // Manual save function
  const handleSave = async () => {
    if (!currentContent || isSaving) return;

    setIsSaving(true);
    setSaveStatus('idle');
    setSaveMessage('');

    try {
      const response = await fetch(`/api/journals/${slug}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: currentContent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // data.message contains detailed error (from catch block)
        // data.error contains simple error string (from explicit errors)
        throw new Error(data.message || data.error || 'Failed to save');
      }

      setSaveStatus('success');
      setSaveMessage('Saved successfully');

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveStatus('idle');
        setSaveMessage('');
      }, 3000);
    } catch (error: any) {
      logger.error('Save error:', error);
      setSaveStatus('error');
      setSaveMessage(error.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+S for manual save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  // Handle textarea changes
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentContent(e.target.value);
    // Reset status when user edits
    if (saveStatus !== 'idle') {
      setSaveStatus('idle');
    }
  };

  return (
    <div className="flex h-full flex-col bg-gray-950" onKeyDown={handleKeyDown}>
      {/* Minimal Toolbar */}
      <div className="flex items-center justify-end border-b border-gray-700 bg-gray-900/50 px-4 py-2">
        <div className="flex items-center gap-3">
          {/* Save Status Message */}
          {saveMessage && (
            <span
              className={`text-xs ${
                saveStatus === 'success'
                  ? 'text-green-400'
                  : saveStatus === 'error'
                    ? 'text-red-400'
                    : 'text-gray-400'
              }`}
            >
              {saveMessage}
            </span>
          )}

          {/* Save Button - Most accessible (disabled when deleted) */}
          <button
            onClick={handleSave}
            disabled={isSaving || deleted}
            className={`text-sm font-medium transition-colors ${
              isSaving || deleted
                ? 'cursor-not-allowed text-gray-500'
                : 'text-blue-500 hover:text-blue-400 hover:underline'
            }`}
            title={deleted ? 'Restore journal to enable saving' : 'Save (Ctrl+S)'}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>

          {/* Separator */}
          <span className="text-gray-600">|</span>

          {deleted ? (
            /* Restore Button - Shown when deleted */
            <button
              onClick={handleRestore}
              disabled={isRestoring}
              className={`text-sm font-medium transition-colors ${
                isRestoring
                  ? 'cursor-not-allowed text-gray-500'
                  : 'text-green-500 hover:text-green-400 hover:underline'
              }`}
              title="Restore journal"
            >
              {isRestoring ? 'Restoring...' : 'Restore'}
            </button>
          ) : (
            /* Delete Button - Shown when not deleted */
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={`text-sm font-medium transition-colors ${
                isDeleting
                  ? 'cursor-not-allowed text-gray-500'
                  : 'text-red-500 hover:text-red-400 hover:underline'
              }`}
              title="Delete journal"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      {/* Editor - Full-page plain text editing */}
      <div className="flex-1 overflow-y-auto">
        <textarea
          value={currentContent || ''}
          onChange={handleContentChange}
          className="h-full w-full resize-none bg-gray-950 px-6 py-4 font-mono text-sm text-gray-300 placeholder-gray-600 focus:outline-none"
          placeholder="Start writing..."
          spellCheck={true}
          lang="en"
        />
      </div>

      {/* Minimal Status Bar */}
      <div className="border-t border-gray-700 bg-gray-900/30 px-4 py-1.5 text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <div className="text-gray-600">Plain text journal</div>
          <div className="text-gray-600">
            Press Ctrl+S to save • Ctrl+Z to undo • Ctrl+Y to redo
          </div>
        </div>
      </div>
    </div>
  );
}
