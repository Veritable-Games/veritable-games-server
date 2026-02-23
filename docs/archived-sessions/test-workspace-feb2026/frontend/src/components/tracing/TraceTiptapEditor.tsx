'use client';

import React, { useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { marked } from 'marked';
import TurndownService from 'turndown';

interface TraceTiptapEditorProps {
  /** Markdown content to edit */
  content: string;
  /** Called when content changes (returns markdown) */
  onChange: (markdown: string) => void;
  /** Called on blur */
  onBlur?: () => void;
  /** Placeholder text */
  placeholder?: string;
}

// Configure turndown for HTML → Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// Configure marked for Markdown → HTML conversion
marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * Convert markdown to HTML for Tiptap
 */
function markdownToHtml(markdown: string): string {
  if (!markdown) return '<p></p>';
  try {
    const html = marked.parse(markdown);
    return typeof html === 'string' ? html : '<p></p>';
  } catch {
    return `<p>${markdown}</p>`;
  }
}

/**
 * Convert HTML from Tiptap to markdown for storage
 */
function htmlToMarkdown(html: string): string {
  if (!html || html === '<p></p>') return '';
  try {
    return turndownService.turndown(html);
  } catch {
    return html.replace(/<[^>]*>/g, '');
  }
}

/**
 * TraceTiptapEditor - WYSIWYG editor styled to match HybridMarkdownRenderer.
 *
 * Uses Tiptap for editing, stores content as markdown.
 * Styling matches the prose classes used by HybridMarkdownRenderer so
 * the editor overlays the background content precisely.
 */
export function TraceTiptapEditor({
  content,
  onChange,
  onBlur,
  placeholder = 'Start typing to trace over the background content...',
}: TraceTiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
    ],
    content: markdownToHtml(content),
    immediatelyRender: false,
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-full',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      onChange(markdown);
    },
    onBlur: () => {
      onBlur?.();
    },
  });

  // Handle Ctrl+S for save
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        onBlur?.();
      }
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener('keydown', handleKeyDown);
    return () => editorElement.removeEventListener('keydown', handleKeyDown);
  }, [editor, onBlur]);

  // Update editor content when prop changes externally
  useEffect(() => {
    if (editor && content !== htmlToMarkdown(editor.getHTML())) {
      editor.commands.setContent(markdownToHtml(content));
    }
  }, [content, editor]);

  if (!editor) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">Loading editor...</div>
    );
  }

  return (
    <div className="trace-editor h-full w-full">
      {/* Inject styles to match HybridMarkdownRenderer exactly */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .trace-editor {
              height: 100%;
              width: 100%;
            }
            .trace-editor .ProseMirror {
              height: 100%;
              width: 100%;
              outline: none !important;
              border: none !important;
              background: transparent !important;
            }
            .trace-editor .ProseMirror:focus {
              outline: none !important;
            }

            /* Placeholder */
            .trace-editor .ProseMirror p.is-editor-empty:first-child::before {
              content: attr(data-placeholder);
              float: left;
              color: #6b7280;
              pointer-events: none;
              height: 0;
            }

            /* Match HybridMarkdownRenderer heading styles */
            .trace-editor .ProseMirror h1 {
              font-size: 1.5rem;
              font-weight: 700;
              color: white;
              margin-bottom: 1rem;
              padding-bottom: 0.5rem;
              border-bottom: 1px solid #4b5563;
            }
            .trace-editor .ProseMirror h2 {
              font-size: 1.25rem;
              font-weight: 700;
              color: white;
              margin-bottom: 0.75rem;
            }
            .trace-editor .ProseMirror h3 {
              font-size: 1.125rem;
              font-weight: 600;
              color: white;
              margin-bottom: 0.5rem;
            }
            .trace-editor .ProseMirror h4 {
              font-size: 1rem;
              font-weight: 600;
              color: #e5e7eb;
              margin-bottom: 0.5rem;
            }
            .trace-editor .ProseMirror h5 {
              font-size: 0.875rem;
              font-weight: 600;
              color: #e5e7eb;
              margin-bottom: 0.25rem;
            }
            .trace-editor .ProseMirror h6 {
              font-size: 0.875rem;
              font-weight: 500;
              color: #d1d5db;
              margin-bottom: 0.25rem;
            }

            /* Match paragraph styles */
            .trace-editor .ProseMirror p {
              color: #d1d5db;
              margin-bottom: 1rem;
              line-height: 1.625;
            }

            /* Strong and emphasis */
            .trace-editor .ProseMirror strong {
              font-weight: 700;
              color: white;
            }
            .trace-editor .ProseMirror em {
              font-style: italic;
              color: #e5e7eb;
            }

            /* Lists */
            .trace-editor .ProseMirror ul {
              list-style-type: disc;
              list-style-position: inside;
              margin-bottom: 1rem;
              color: #d1d5db;
            }
            .trace-editor .ProseMirror ol {
              list-style-type: decimal;
              list-style-position: inside;
              margin-bottom: 1rem;
              color: #d1d5db;
            }
            .trace-editor .ProseMirror li {
              color: #d1d5db;
              margin-bottom: 0.25rem;
            }
            .trace-editor .ProseMirror li p {
              display: inline;
              margin-bottom: 0;
            }

            /* Code */
            .trace-editor .ProseMirror code {
              background-color: #1f2937;
              color: #e5e7eb;
              padding: 0.125rem 0.375rem;
              border-radius: 0.25rem;
              font-family: ui-monospace, monospace;
              font-size: 0.875rem;
            }
            .trace-editor .ProseMirror pre {
              background-color: #111827;
              border: 1px solid #374151;
              border-radius: 0.375rem;
              padding: 1rem;
              margin-bottom: 1rem;
              overflow-x: auto;
            }
            .trace-editor .ProseMirror pre code {
              background: none;
              padding: 0;
              border-radius: 0;
            }

            /* Blockquote */
            .trace-editor .ProseMirror blockquote {
              border-left: 4px solid #4b5563;
              padding-left: 1rem;
              margin-bottom: 1rem;
              font-style: italic;
              color: #9ca3af;
            }

            /* Horizontal rule */
            .trace-editor .ProseMirror hr {
              border: none;
              border-top: 1px solid #4b5563;
              margin: 1.5rem 0;
            }
          `,
        }}
      />
      <EditorContent editor={editor} className="h-full w-full" data-placeholder={placeholder} />
    </div>
  );
}
