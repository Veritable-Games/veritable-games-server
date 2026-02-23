'use client';

import React, { useEffect, useRef } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Underline,
  Code,
  Link,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Table,
  Minus,
  FileCode,
  FileText,
  BookOpen,
  X,
} from 'lucide-react';
import { FormatType } from './types';

interface FormatBottomSheetProps {
  open: boolean;
  onClose: () => void;
  onFormat: (type: FormatType) => void;
  showWikiLinks?: boolean;
}

interface FormatOption {
  type: FormatType;
  label: string;
  icon: React.ElementType;
}

const TEXT_STYLE_OPTIONS: FormatOption[] = [
  { type: 'bold', label: 'Bold', icon: Bold },
  { type: 'italic', label: 'Italic', icon: Italic },
  { type: 'strikethrough', label: 'Strikethrough', icon: Strikethrough },
  { type: 'underline', label: 'Underline', icon: Underline },
  { type: 'code', label: 'Inline Code', icon: Code },
];

const HEADING_OPTIONS: FormatOption[] = [
  { type: 'heading1', label: 'Heading 1', icon: Heading1 },
  { type: 'heading2', label: 'Heading 2', icon: Heading2 },
  { type: 'heading3', label: 'Heading 3', icon: Heading3 },
];

const LIST_OPTIONS: FormatOption[] = [
  { type: 'bulletList', label: 'Bullet List', icon: List },
  { type: 'numberedList', label: 'Numbered List', icon: ListOrdered },
  { type: 'taskList', label: 'Task List', icon: ListTodo },
];

const BLOCK_OPTIONS: FormatOption[] = [
  { type: 'quote', label: 'Quote', icon: Quote },
  { type: 'codeBlock', label: 'Code Block', icon: FileCode },
  { type: 'table', label: 'Table', icon: Table },
  { type: 'horizontalRule', label: 'Divider', icon: Minus },
];

const LINK_OPTIONS: FormatOption[] = [
  { type: 'link', label: 'Link', icon: Link },
  { type: 'wikiLink', label: 'Wiki Link', icon: FileText },
  { type: 'libraryLink', label: 'Library Link', icon: BookOpen },
];

export function FormatBottomSheet({
  open,
  onClose,
  onFormat,
  showWikiLinks = false,
}: FormatBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const handleFormat = (type: FormatType) => {
    onFormat(type);
    onClose();
  };

  const OptionButton = ({ option }: { option: FormatOption }) => (
    <button
      type="button"
      onClick={() => handleFormat(option.type)}
      className="flex h-12 w-full items-center gap-3 rounded-lg px-4 text-left text-gray-200 transition-colors active:bg-gray-700"
    >
      <option.icon size={20} className="text-gray-400" />
      <span className="text-sm font-medium">{option.label}</span>
    </button>
  );

  const Section = ({ title, options }: { title: string; options: FormatOption[] }) => (
    <div className="mb-4">
      <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </h3>
      <div className="space-y-0.5">
        {options.map(option => (
          <OptionButton key={option.type} option={option} />
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="animate-in fade-in fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="animate-in slide-in-from-bottom fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-gray-800"
        role="dialog"
        aria-modal="true"
        aria-label="Formatting options"
      >
        {/* Drag handle */}
        <div className="sticky top-0 z-10 flex justify-center bg-gray-800 pb-2 pt-3">
          <div className="h-1 w-12 rounded-full bg-gray-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 px-4 pb-3">
          <h2 className="text-lg font-semibold text-gray-100">Formatting</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="pb-safe px-2 py-4">
          <Section title="Text Style" options={TEXT_STYLE_OPTIONS} />
          <Section title="Headings" options={HEADING_OPTIONS} />
          <Section title="Lists" options={LIST_OPTIONS} />
          <Section title="Blocks" options={BLOCK_OPTIONS} />
          <Section
            title="Links"
            options={showWikiLinks ? LINK_OPTIONS : LINK_OPTIONS.slice(0, 1)}
          />
        </div>
      </div>
    </>
  );
}

export default FormatBottomSheet;
