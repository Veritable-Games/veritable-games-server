'use client';

/**
 * Rich Text Editor Component
 *
 * Tiptap-based rich text editor with markdown shortcuts.
 * Supports bold, italic, underline, strikethrough, colors, and alignment.
 */

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { useEffect } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onBlur?: () => void;
  onSave?: () => void;
  minimal?: boolean; // Hide toolbar for plain text nodes
  onEditorReady?: (editor: Editor) => void; // Callback to pass editor instance to parent
  fontSize?: number; // Calculated font size to match view mode
  textAlign?: 'left' | 'center' | 'right'; // Text alignment to match view mode
  isNote?: boolean; // Whether this is a note (true) or text box (false)
}

export default function RichTextEditor({
  content,
  onChange,
  onBlur,
  onSave,
  minimal = false,
  onEditorReady,
  fontSize,
  textAlign = 'left',
  isNote = true,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      FontFamily,
    ],
    content,
    immediatelyRender: false, // Prevent SSR hydration mismatch
    autofocus: 'end', // Auto-focus editor at end of content
    editorProps: {
      attributes: {
        class: minimal
          ? 'focus:outline-none text-neutral-200 p-2 [&_p]:m-0 [&_p]:leading-tight'
          : 'focus:outline-none text-neutral-200 p-3',
        style: `font-size: ${fontSize || 16}px; line-height: 1.5; text-align: ${textAlign}; width: 100%; border: none !important; outline: none !important; box-shadow: none !important;`,
      },
      handleDOMEvents: {
        // Block middle-click events - it's reserved for panning the canvas
        // This prevents X11 primary selection paste (middle-click paste on Linux)
        mousedown: (view, event) => {
          if (event.button === 1) {
            event.preventDefault();
            event.stopPropagation();
            return true;
          }
          return false;
        },
        mouseup: (view, event) => {
          if (event.button === 1) {
            event.preventDefault();
            event.stopPropagation();
            return true;
          }
          return false;
        },
        auxclick: (view, event) => {
          // auxclick fires for non-primary buttons (including middle)
          if (event.button === 1) {
            event.preventDefault();
            event.stopPropagation();
            return true;
          }
          return false;
        },
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onBlur: () => {
      onBlur?.();
    },
  });

  // Update editor content when prop changes (external updates)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Pass editor instance to parent when ready
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  if (!editor) {
    return <div className="text-sm text-neutral-400">Loading editor...</div>;
  }

  // Block middle-click at wrapper level (defense in depth)
  const handleWrapperMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleWrapperMouseUp = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleWrapperAuxClick = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Prevent context menu on middle-click as additional safeguard
  const handleContextMenu = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
    }
  };

  return (
    <div
      className="h-full w-full"
      style={{
        border: 'none',
        outline: 'none',
        maxWidth: '100%',
        maxHeight: '100%',
        overflow: 'hidden',
      }}
      onMouseDown={handleWrapperMouseDown}
      onMouseUp={handleWrapperMouseUp}
      onAuxClick={handleWrapperAuxClick}
      onContextMenu={handleContextMenu}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .workspace-editor {
          width: 100% !important;
          height: 100% !important;
        }
        .workspace-editor.centered {
          display: grid !important;
          place-items: center !important;
        }
        .workspace-editor,
        .workspace-editor > *,
        .workspace-editor > * > *,
        .workspace-editor *,
        .workspace-editor *:focus,
        .workspace-editor *:focus-visible,
        .workspace-editor div,
        .workspace-editor .tiptap,
        .workspace-editor .ProseMirror-focused,
        .workspace-editor [contenteditable="true"],
        .workspace-editor [contenteditable="true"]:focus {
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
        }
        .workspace-editor .ProseMirror {
          font-family: Arial, sans-serif;
          background: transparent !important;
          border: none !important;
          outline: none !important;
          width: 100% !important;
          height: 100% !important;
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
          white-space: normal !important;
        }
        .workspace-editor.centered .ProseMirror {
          display: grid !important;
          place-items: center !important;
        }
        .workspace-editor .ProseMirror strong {
          font-weight: 900 !important;
        }
        .workspace-editor .ProseMirror s {
          text-decoration: line-through !important;
          text-decoration-thickness: 2px !important;
          text-decoration-skip-ink: none !important;
        }
        .workspace-editor .ProseMirror u {
          text-decoration: underline !important;
          text-decoration-thickness: 1.5px !important;
        }
        .workspace-editor .ProseMirror p {
          margin: 0 !important;
          line-height: 1.5;
          min-height: 1.5em;
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
        }
        .workspace-editor .ProseMirror p:empty::before {
          content: "\\200B";
        }
      `,
        }}
      />
      <EditorContent
        editor={editor}
        className={`workspace-editor h-full w-full [&_.ProseMirror]:border-none [&_.ProseMirror]:outline-none [&_div]:border-none [&_div]:outline-none ${isNote ? 'centered' : ''}`}
        style={{
          border: 'none !important',
          outline: 'none !important',
          boxShadow: 'none !important',
          maxWidth: '100% !important',
          maxHeight: '100% !important',
          overflow: 'hidden !important',
          width: '100% !important',
          height: '100% !important',
        }}
      />
    </div>
  );
}
