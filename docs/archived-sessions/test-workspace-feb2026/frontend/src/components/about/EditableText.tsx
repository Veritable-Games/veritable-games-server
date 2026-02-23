'use client';

import { useState, useRef, useEffect } from 'react';

interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: (value: string) => Promise<void>;
  canEdit: boolean;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
}

export function EditableText({
  value,
  onChange,
  onSave,
  canEdit,
  className = '',
  placeholder = '',
  multiline = false,
  as = 'span',
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Focus input when editing
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (!multiline) {
        (inputRef.current as HTMLInputElement).select();
      }
    }
  }, [isEditing, multiline]);

  const handleClick = (e: React.MouseEvent) => {
    if (canEdit && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setIsEditing(true);
      setError(null);
    }
  };

  const handleSave = async () => {
    if (localValue.trim() === '') {
      setError('Value cannot be empty');
      return;
    }

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleBlur = () => {
    // Save on blur unless user cancelled
    if (localValue !== value && !error) {
      handleSave();
    }
  };

  const Component = as;

  if (!canEdit) {
    return <Component className={className}>{value || placeholder}</Component>;
  }

  if (isEditing) {
    const inputClassName = `w-full bg-gray-800 text-white border border-blue-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`;

    return (
      <div className="relative">
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={localValue}
            onChange={e => setLocalValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            disabled={isSaving}
            className={inputClassName}
            rows={3}
            placeholder={placeholder}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={localValue}
            onChange={e => setLocalValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            disabled={isSaving}
            className={inputClassName}
            placeholder={placeholder}
          />
        )}
        {error && <div className="mt-1 text-sm text-red-400">{error}</div>}
        {isSaving && <div className="absolute right-2 top-2 text-xs text-gray-400">Saving...</div>}
      </div>
    );
  }

  return (
    <Component
      onClick={handleClick}
      className={`cursor-text transition-colors hover:text-blue-300 ${className}`}
      title="Ctrl+click to edit"
    >
      {value || placeholder}
    </Component>
  );
}
