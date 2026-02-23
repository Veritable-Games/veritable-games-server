'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { processWikiContent } from '@/lib/content/wikilinks';
import { MarkdownEditorToolbar } from './MarkdownEditorToolbar';
import { ContentSanitizer } from '@/lib/content/sanitization';
import { logger } from '@/lib/utils/logger';

interface MarkdownEditorProps {
  initialContent?: string;
  placeholder?: string;
  onChange?: (content: string) => void;
  onSave?: (content: string) => void;
  height?: string;
  readOnly?: boolean;
  showPreview?: boolean;
  showToolbar?: boolean;
  className?: string;
  onAddInfobox?: () => void;
}

export function MarkdownEditor({
  initialContent = '',
  placeholder = 'Enter content in Markdown format...',
  onChange,
  onSave,
  height = '400px',
  readOnly = false,
  showPreview = true,
  showToolbar = true,
  onAddInfobox,
  className = '',
}: MarkdownEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [renderedContent, setRenderedContent] = useState('');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
  const [slashFilter, setSlashFilter] = useState('');
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  useEffect(() => {
    // Process content with wikilinks and markdown
    const processContent = async () => {
      try {
        // First process wikilinks
        let processed = processWikiContent(content, 'html');

        // Then convert markdown to HTML (simple implementation)
        processed = convertMarkdownToHtml(processed);

        setRenderedContent(processed);
      } catch (error) {
        logger.error('Error processing content:', error);
        setRenderedContent(content);
      }
    };

    processContent();
  }, [content]);

  // Add keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F1 key to show shortcuts
      if (e.key === 'F1' && !readOnly) {
        e.preventDefault();
        setShowShortcutsModal(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [readOnly]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    onChange?.(newContent);

    // Check for slash command trigger
    if (!readOnly && textareaRef.current) {
      const cursorPos = textareaRef.current.selectionStart;
      const lineStart = newContent.lastIndexOf('\n', cursorPos - 1) + 1;
      const lineText = newContent.substring(lineStart, cursorPos);

      if (lineText === '/') {
        // Open slash menu
        const rect = textareaRef.current.getBoundingClientRect();
        const lineHeight = 20; // Approximate line height
        const linesBeforeCursor = newContent.substring(0, cursorPos).split('\n').length;
        const scrollOffset = textareaRef.current.scrollTop;
        const relativeLinePosition = (linesBeforeCursor - 1) * lineHeight - scrollOffset;

        // Calculate position relative to textarea and viewport
        const menuTop = Math.min(
          rect.top + relativeLinePosition + lineHeight + 16, // padding
          window.innerHeight - 350 // Keep menu visible on screen
        );

        setSlashMenuPosition({
          top: Math.max(menuTop, rect.top + lineHeight),
          left: rect.left + 16, // padding offset
        });
        setShowSlashMenu(true);
        setSlashFilter('');
      } else if (lineText.startsWith('/') && showSlashMenu) {
        // Update filter
        setSlashFilter(lineText.substring(1));
      } else if (showSlashMenu) {
        // Close menu if slash is removed
        setShowSlashMenu(false);
        setSlashFilter('');
      }
    }
  };

  const insertMarkdown = useCallback(
    (before: string, after: string = '') => {
      if (!textareaRef.current || readOnly) return;

      const textarea = textareaRef.current;
      let start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      let selectedText = content.substring(start, end);

      // If slash menu is open, replace the slash command
      if (showSlashMenu) {
        const lineStart = content.lastIndexOf('\n', start - 1) + 1;
        const lineText = content.substring(lineStart, start);

        if (lineText.startsWith('/')) {
          // Replace the entire slash command
          start = lineStart;
          selectedText = '';
        }
      }

      const newText =
        content.substring(0, start) + before + selectedText + after + content.substring(end);

      setContent(newText);
      onChange?.(newText);

      // Reset cursor position
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = start + before.length + selectedText.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    [content, onChange, readOnly, showSlashMenu]
  );

  const handleSlashCommandSelect = useCallback(() => {
    setShowSlashMenu(false);
    setSlashFilter('');
  }, []);

  const handleInsertInfobox = useCallback(
    (type: string = 'generic') => {
      if (!textareaRef.current || readOnly) return;

      // Define templates for each infobox type
      const templates: Record<string, string> = {
        character: `{{infobox|Character
|name=
|image=
|caption=
|race=
|class=
|level=
|health=
|affiliation=
|location=
|voice_actor=
|first_appearance=
|status=
}}`,
        enemy: `{{infobox|Enemy
|name=
|image=
|type=
|level=
|health=
|damage=
|armor=
|weaknesses=
|resistances=
|abilities=
|drops=
|location=
}}`,
        item: `{{infobox|Item
|name=
|image=
|type=
|rarity=
|value=
|weight=
|effects=
|description=
|obtained_from=
|used_in=
}}`,
        weapon: `{{infobox|Weapon
|name=
|image=
|type=
|damage=
|dps=
|speed=
|range=
|requirements=
|special_effects=
|upgrade_path=
|value=
|weight=
}}`,
        armor: `{{infobox|Armor
|name=
|image=
|type=
|defense=
|resistances=
|weight=
|requirements=
|set_bonus=
|upgrade_path=
|value=
}}`,
        location: `{{infobox|Location
|name=
|image=
|type=
|region=
|inhabitants=
|enemies=
|notable_items=
|quests=
|connections=
}}`,
        quest: `{{infobox|Quest
|name=
|image=
|type=
|quest_giver=
|location=
|level=
|prerequisites=
|objectives=
|rewards=
|next_quest=
}}`,
        skill: `{{infobox|Skill
|name=
|image=
|type=
|tree=
|cost=
|cooldown=
|range=
|effect=
|duration=
|prerequisites=
}}`,
        faction: `{{infobox|Faction
|name=
|image=
|type=
|leader=
|headquarters=
|members=
|ideology=
|allies=
|enemies=
|reputation_rewards=
}}`,
        vehicle: `{{infobox|Vehicle
|name=
|image=
|type=
|manufacturer=
|speed=
|armor=
|weapons=
|capacity=
|fuel=
|value=
}}`,
        generic: `{{infobox|Generic
|title=
|image=
|caption=
|field1=
|field2=
|field3=
|field4=
|field5=
}}`,
      };

      const template = templates[type] || templates.generic;
      const textarea = textareaRef.current;
      if (!textarea || !template) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      // Insert template at current cursor position
      const newText = content.substring(0, start) + template + '\n\n' + content.substring(end);

      setContent(newText);
      onChange?.(newText);

      // Reset cursor position after template
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = start + template.length + 2; // +2 for the newlines
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    [content, onChange, readOnly]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't interfere with slash menu navigation
    if (showSlashMenu && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'].includes(e.key)) {
      // Let the SlashCommandMenu handle these keys
      return;
    }

    // Handle ? key for help (when not modified)
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey && !showSlashMenu) {
      e.preventDefault();
      setShowShortcutsModal(true);
      return;
    }

    // Handle backspace to close slash menu
    if (showSlashMenu && e.key === 'Backspace') {
      const textarea = e.currentTarget;
      const cursorPos = textarea.selectionStart;
      const lineStart = content.lastIndexOf('\n', cursorPos - 1) + 1;
      const lineText = content.substring(lineStart, cursorPos);

      if (lineText === '/') {
        setShowSlashMenu(false);
        setSlashFilter('');
      }
    }

    // Handle tab for indentation
    if (e.key === 'Tab' && !showSlashMenu) {
      e.preventDefault();
      insertMarkdown('  ');
    }

    // Handle Ctrl/Cmd + S for save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      onSave?.(content);
    }

    // Handle Ctrl/Cmd + B for bold
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      insertMarkdown('**', '**');
    }

    // Handle Ctrl/Cmd + I for italic
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      insertMarkdown('*', '*');
    }

    // Handle Ctrl/Cmd + K for link
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      insertMarkdown('[', '](url)');
    }

    // Handle Ctrl/Cmd + Shift + I for infobox
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
      e.preventDefault();
      handleInsertInfobox('generic');
    }
  };

  const containerHeight = isFullscreen ? '100vh' : height;
  const useFlexHeight = height === '100%';

  return (
    <div
      className={`markdown-editor flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-gray-900' : useFlexHeight ? 'h-full' : ''} ${className}`}
      style={!useFlexHeight && !isFullscreen ? { height } : undefined}
    >
      {showToolbar && (
        <MarkdownEditorToolbar
          onInsertMarkdown={insertMarkdown}
          isPreviewMode={isPreviewMode}
          setIsPreviewMode={setIsPreviewMode}
          onSave={onSave ? () => onSave(content) : undefined}
          readOnly={readOnly}
          showPreview={showPreview}
          content={content}
        />
      )}

      <div
        className="flex flex-1 flex-col"
        style={
          useFlexHeight
            ? undefined
            : { height: `calc(${containerHeight} - ${showToolbar ? '48px' : '0px'})` }
        }
      >
        {(!isPreviewMode || !showPreview) && (
          <>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              readOnly={readOnly}
              className="flex-1 resize-none overflow-y-auto bg-gray-900 p-4 font-mono text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="relative flex flex-shrink-0 items-center justify-between border-t border-gray-700 bg-gray-800 px-3 py-1 text-xs text-gray-400">
              <span>
                {(content || '').length} characters • {(content || '').split('\n').length} lines
              </span>
              <div className="absolute left-1/2 flex -translate-x-1/2 transform items-center gap-2">
                <span className="opacity-60">Press</span>
                <kbd className="rounded bg-gray-700 px-1.5 py-0.5 font-mono text-gray-300">F1</kbd>
                <span className="opacity-60">for shortcuts</span>
              </div>
              {onSave && (
                <button
                  type="button"
                  onClick={() => onSave(content)}
                  className="text-blue-400 transition-colors hover:text-blue-300"
                  title="Save (Ctrl+S)"
                  aria-label="Save"
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2"
                    />
                  </svg>
                </button>
              )}
            </div>
          </>
        )}

        {showPreview && (isPreviewMode || isFullscreen) && (
          <div
            className={`${isFullscreen && !isPreviewMode ? 'flex-1' : 'flex-1'} border-l border-gray-700`}
          >
            <div className="h-full overflow-auto bg-gray-900/50 p-4">
              <div
                className="prose prose-sm prose-invert max-w-none"
                dangerouslySetInnerHTML={{
                  __html: ContentSanitizer.sanitizeHtml(renderedContent, 'safe'),
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Simple markdown to HTML converter (basic implementation)
function convertMarkdownToHtml(text: string): string {
  let html = text;

  // Code blocks (process before other elements to avoid conflicts)
  html = html.replace(
    /```([^`]*?)```/gs,
    '<pre class="bg-gray-800 p-3 rounded overflow-x-auto"><code>$1</code></pre>'
  );

  // Centered text (-> text <-)
  html = html.replace(/^->[ ]*(.*?)[ ]*<-$/gm, '<div class="text-center my-2">$1</div>');

  // Headers (process in order: h4, h3, h2, h1)
  html = html.replace(
    /^#### (.*$)/gim,
    '<h4 class="text-lg font-semibold text-white mt-4 mb-2">$1</h4>'
  );
  html = html.replace(
    /^### (.*$)/gim,
    '<h3 class="text-xl font-semibold text-white mt-6 mb-3">$1</h3>'
  );
  html = html.replace(
    /^## (.*$)/gim,
    '<h2 class="text-2xl font-bold text-white mt-8 mb-4">$1</h2>'
  );
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold text-white mt-8 mb-6">$1</h1>');

  // Strikethrough (process before bold/italic)
  html = html.replace(/~~(.+?)~~/g, '<del class="line-through">$1</del>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-blue-400 hover:text-blue-300 underline">$1</a>'
  );

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="bg-gray-800 px-2 py-1 rounded text-green-400 font-mono text-sm">$1</code>'
  );

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr class="my-4 border-gray-600" />');

  // Simple table support (basic implementation)
  // This is a simplified version - full table parsing would be more complex
  html = html.replace(/\|(.+)\|/g, match => {
    if (match.includes('---')) {
      return ''; // Skip separator rows
    }
    const cells = match.split('|').filter(cell => cell.trim());
    const cellHtml = cells
      .map(cell => `<td class="border border-gray-600 px-2 py-1">${cell.trim()}</td>`)
      .join('');
    return `<tr>${cellHtml}</tr>`;
  });

  // Wrap table rows in table element
  html = html.replace(
    /(<tr>.*<\/tr>)/gs,
    '<table class="border-collapse border border-gray-600 my-2">$1</table>'
  );

  // Task lists
  html = html.replace(
    /^- \[x\] (.+)$/gim,
    '<li class="ml-4 list-none"><input type="checkbox" checked disabled class="mr-2" />$1</li>'
  );
  html = html.replace(
    /^- \[ \] (.+)$/gim,
    '<li class="ml-4 list-none"><input type="checkbox" disabled class="mr-2" />$1</li>'
  );

  // Lists (wrap in proper containers)
  html = html.replace(/^[\*\-] (.+)$/gim, '<li class="ml-4">• $1</li>');
  html = html.replace(/^\d+\. (.+)$/gim, '<li class="ml-4">$1</li>');

  // Blockquotes
  html = html.replace(
    /^> (.+)$/gim,
    '<blockquote class="border-l-4 border-gray-600 pl-4 italic text-gray-300 my-2">$1</blockquote>'
  );

  // Line breaks and paragraphs
  html = html.replace(/\n\n/g, '</p><p class="mb-4">');
  html = '<p class="mb-4">' + html + '</p>';

  // Clean up empty paragraphs and fix structure
  html = html.replace(/<p[^>]*><\/p>/g, '');
  html = html.replace(/<p[^>]*>(<h[1-6][^>]*>.*?<\/h[1-6]>)<\/p>/g, '$1');
  html = html.replace(/<p[^>]*>(<pre[^>]*>.*?<\/pre>)<\/p>/g, '$1');
  html = html.replace(/<p[^>]*>(<blockquote[^>]*>.*?<\/blockquote>)<\/p>/g, '$1');

  return html;
}

export default MarkdownEditor;
