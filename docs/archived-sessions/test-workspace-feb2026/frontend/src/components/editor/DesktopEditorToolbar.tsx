'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
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
  ChevronDown,
  Eye,
  Edit3,
  Save,
  FileText,
  BookOpen,
} from 'lucide-react';
import { FormatType } from './types';

interface DesktopEditorToolbarProps {
  onFormat: (type: FormatType) => void;
  activeFormats?: Set<FormatType>;
  mode: 'write' | 'preview';
  onModeChange: (mode: 'write' | 'preview') => void;
  onSave?: () => void;
  disabled?: boolean;
  showWikiLinks?: boolean;
}

export function DesktopEditorToolbar({
  onFormat,
  activeFormats = new Set(),
  mode,
  onModeChange,
  onSave,
  disabled = false,
  showWikiLinks = false,
}: DesktopEditorToolbarProps) {
  const [headingMenuOpen, setHeadingMenuOpen] = useState(false);
  const [listMenuOpen, setListMenuOpen] = useState(false);
  const headingRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headingRef.current && !headingRef.current.contains(e.target as Node)) {
        setHeadingMenuOpen(false);
      }
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        setListMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (type: FormatType) => activeFormats.has(type);

  const ToolButton = ({
    icon: Icon,
    type,
    title,
    shortcut,
  }: {
    icon: React.ElementType;
    type: FormatType;
    title: string;
    shortcut?: string;
  }) => (
    <button
      type="button"
      onClick={() => onFormat(type)}
      disabled={disabled}
      title={shortcut ? `${title} (${shortcut})` : title}
      className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${isActive(type) ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <Icon size={16} strokeWidth={2} />
    </button>
  );

  return (
    <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800/50 px-2 py-1.5">
      {/* Left side: Formatting tools */}
      <div className="flex items-center gap-0.5">
        {/* Text formatting group */}
        <div className="flex items-center rounded bg-gray-700/30 p-0.5">
          <ToolButton icon={Bold} type="bold" title="Bold" shortcut="Ctrl+B" />
          <ToolButton icon={Italic} type="italic" title="Italic" shortcut="Ctrl+I" />
          <ToolButton icon={Strikethrough} type="strikethrough" title="Strikethrough" />
          <ToolButton icon={Code} type="code" title="Inline Code" />
        </div>

        {/* Divider */}
        <div className="mx-1 h-6 w-px bg-gray-700" />

        {/* Heading dropdown */}
        <div ref={headingRef} className="relative">
          <button
            type="button"
            onClick={() => setHeadingMenuOpen(!headingMenuOpen)}
            disabled={disabled}
            className="flex h-8 items-center gap-1 rounded px-2 text-sm text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Heading2 size={16} />
            <ChevronDown size={12} />
          </button>
          {headingMenuOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-32 rounded-lg border border-gray-700 bg-gray-800 py-1 shadow-xl">
              {[
                { type: 'heading1' as const, label: 'Heading 1', icon: Heading1 },
                { type: 'heading2' as const, label: 'Heading 2', icon: Heading2 },
                { type: 'heading3' as const, label: 'Heading 3', icon: Heading3 },
              ].map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    onFormat(type);
                    setHeadingMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700"
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* List dropdown */}
        <div ref={listRef} className="relative">
          <button
            type="button"
            onClick={() => setListMenuOpen(!listMenuOpen)}
            disabled={disabled}
            className="flex h-8 items-center gap-1 rounded px-2 text-sm text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <List size={16} />
            <ChevronDown size={12} />
          </button>
          {listMenuOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-36 rounded-lg border border-gray-700 bg-gray-800 py-1 shadow-xl">
              {[
                { type: 'bulletList' as const, label: 'Bullet List', icon: List },
                { type: 'numberedList' as const, label: 'Numbered List', icon: ListOrdered },
                { type: 'taskList' as const, label: 'Task List', icon: ListTodo },
              ].map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    onFormat(type);
                    setListMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700"
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-1 h-6 w-px bg-gray-700" />

        {/* Block elements group */}
        <div className="flex items-center rounded bg-gray-700/30 p-0.5">
          <ToolButton icon={Link} type="link" title="Link" shortcut="Ctrl+K" />
          <ToolButton icon={Quote} type="quote" title="Quote" />
          <ToolButton icon={Table} type="table" title="Table" />
          <ToolButton icon={Minus} type="horizontalRule" title="Horizontal Rule" />
        </div>

        {/* Wiki/Library links (optional) */}
        {showWikiLinks && (
          <>
            <div className="mx-1 h-6 w-px bg-gray-700" />
            <div className="flex items-center rounded bg-gray-700/30 p-0.5">
              <ToolButton icon={FileText} type="wikiLink" title="Wiki Link" />
              <ToolButton icon={BookOpen} type="libraryLink" title="Library Link" />
            </div>
          </>
        )}
      </div>

      {/* Right side: Mode toggle and actions */}
      <div className="flex items-center gap-1">
        {/* Write/Preview toggle */}
        <div className="flex overflow-hidden rounded-lg bg-gray-700/50">
          <button
            type="button"
            onClick={() => onModeChange('write')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${mode === 'write' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            <Edit3 size={14} />
            Write
          </button>
          <button
            type="button"
            onClick={() => onModeChange('preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${mode === 'preview' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            <Eye size={14} />
            Preview
          </button>
        </div>

        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={disabled}
            title="Save (Ctrl+S)"
            className="flex h-8 items-center gap-1.5 rounded bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={14} />
            Save
          </button>
        )}
      </div>
    </div>
  );
}

export default DesktopEditorToolbar;
