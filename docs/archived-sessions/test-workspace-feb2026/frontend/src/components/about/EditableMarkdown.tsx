'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { HybridMarkdownRenderer } from '@/components/ui/HybridMarkdownRenderer';

const UnifiedMarkdownEditor = dynamic(
  () => import('@/components/editor/UnifiedMarkdownEditor').then(mod => mod.UnifiedMarkdownEditor),
  { ssr: false }
);

interface EditableMarkdownProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: (value: string) => Promise<void>;
  canEdit: boolean;
  className?: string;
  placeholder?: string;
}

export function EditableMarkdown({
  value,
  onChange,
  onSave,
  canEdit,
  className = '',
  placeholder = 'Click to add content...',
}: EditableMarkdownProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = (e: React.MouseEvent) => {
    if (canEdit && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setIsEditing(true);
      setError(null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      if (onSave) {
        await onSave(localValue);
      }
      onChange(localValue);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setLocalValue(value);
    setIsEditing(false);
    setError(null);
  };

  if (!canEdit) {
    return (
      <div className={className}>
        <HybridMarkdownRenderer content={value || placeholder} />
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className={`space-y-4 ${className}`}>
        <UnifiedMarkdownEditor
          content={localValue}
          onChange={setLocalValue}
          features="full"
          minRows={8}
          placeholder={placeholder}
        />
        {error && (
          <div className="rounded border border-red-700 bg-red-900/20 p-3 text-sm text-red-400">
            {error}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="rounded border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <span className="text-xs text-gray-400">Press Esc to cancel</span>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className={`cursor-text rounded border border-transparent transition-colors hover:border-blue-700/50 ${className}`}
      title="Ctrl+click to edit"
    >
      <HybridMarkdownRenderer content={value || placeholder} />
    </div>
  );
}
