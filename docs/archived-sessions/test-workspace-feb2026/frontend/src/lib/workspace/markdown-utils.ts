/**
 * Markdown Editing Utilities
 *
 * Helper functions for manipulating markdown text in textarea elements.
 * Used by MarkdownTextEditor for implementing formatting operations.
 */

export interface SelectionInfo {
  start: number;
  end: number;
  text: string;
}

export interface MarkdownEditorAPI {
  wrapSelection: (before: string, after: string) => void;
  insertAtCursor: (text: string) => void;
  getSelection: () => SelectionInfo;
  focus: () => void;
  getMarkdown: () => string;
  setMarkdown: (markdown: string) => void;
}

/**
 * Wrap the current selection with markdown syntax
 * Example: wrapSelection('**', '**') converts "text" to "**text**"
 */
export function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  onChange: (value: string) => void
): void {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selectedText = text.substring(start, end);

  // Build new text with wrapped selection
  const newText = text.substring(0, start) + before + selectedText + after + text.substring(end);

  // Update textarea value
  textarea.value = newText;
  onChange(newText);

  // Restore cursor position (inside the wrapped text if no selection, or after if there was selection)
  const newCursorPos =
    selectedText.length > 0
      ? start + before.length + selectedText.length + after.length // After wrapped text
      : start + before.length; // Inside markers for empty selection

  // Need to wait for React to update before setting selection
  setTimeout(() => {
    textarea.focus();
    textarea.setSelectionRange(newCursorPos, newCursorPos);
  }, 0);
}

/**
 * Insert text at the current cursor position
 * Example: insertAtCursor('- ') inserts a bullet point
 */
export function insertAtCursor(
  textarea: HTMLTextAreaElement,
  text: string,
  onChange: (value: string) => void
): void {
  const start = textarea.selectionStart;
  const currentText = textarea.value;

  // Insert text at cursor position
  const newText = currentText.substring(0, start) + text + currentText.substring(start);

  // Update textarea value
  textarea.value = newText;
  onChange(newText);

  // Move cursor to end of inserted text
  const newCursorPos = start + text.length;

  setTimeout(() => {
    textarea.focus();
    textarea.setSelectionRange(newCursorPos, newCursorPos);
  }, 0);
}

/**
 * Get the current selection info
 */
export function getSelection(textarea: HTMLTextAreaElement): SelectionInfo {
  return {
    start: textarea.selectionStart,
    end: textarea.selectionEnd,
    text: textarea.value.substring(textarea.selectionStart, textarea.selectionEnd),
  };
}

/**
 * Check if the cursor is currently inside markdown syntax
 * Used for detecting active formatting (e.g., cursor inside **bold**)
 */
export function getActiveFormats(textarea: HTMLTextAreaElement): {
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  code: boolean;
} {
  const pos = textarea.selectionStart;
  const text = textarea.value;

  // Look backwards and forwards from cursor to detect surrounding syntax
  const before = text.substring(Math.max(0, pos - 10), pos);
  const after = text.substring(pos, Math.min(text.length, pos + 10));

  return {
    bold: /\*\*[^*]*$/.test(before) && /^[^*]*\*\*/.test(after),
    italic: /(?<!\*)\*(?!\*)[^*]*$/.test(before) && /^[^*]*\*(?!\*)/.test(after),
    strikethrough: /~~[^~]*$/.test(before) && /^[^~]*~~/.test(after),
    code: /`[^`]*$/.test(before) && /^[^`]*`/.test(after),
  };
}

/**
 * Insert a link at the cursor position or wrap selected text
 */
export function insertLink(textarea: HTMLTextAreaElement, onChange: (value: string) => void): void {
  const selection = getSelection(textarea);

  if (selection.text) {
    // Wrap selected text as link
    wrapSelection(textarea, '[', '](url)', onChange);
  } else {
    // Insert link template
    insertAtCursor(textarea, '[link text](url)', onChange);
  }
}

/**
 * Insert a heading at the current line
 */
export function insertHeading(
  textarea: HTMLTextAreaElement,
  level: 2 | 3,
  onChange: (value: string) => void
): void {
  const prefix = '#'.repeat(level) + ' ';
  const start = textarea.selectionStart;
  const text = textarea.value;

  // Find start of current line
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;

  // Check if line already has heading
  const lineText = text.substring(lineStart, start);
  const headingMatch = /^(#+)\s/.exec(lineText);

  if (headingMatch) {
    // Remove existing heading
    const newText =
      text.substring(0, lineStart) + text.substring(lineStart + headingMatch[0].length);
    textarea.value = newText;
    onChange(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start - headingMatch[0].length, start - headingMatch[0].length);
    }, 0);
  } else {
    // Add heading
    const newText = text.substring(0, lineStart) + prefix + text.substring(lineStart);
    textarea.value = newText;
    onChange(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  }
}

/**
 * Insert a list item (bullet or numbered)
 */
export function insertListItem(
  textarea: HTMLTextAreaElement,
  type: 'bullet' | 'numbered',
  onChange: (value: string) => void
): void {
  const prefix = type === 'bullet' ? '- ' : '1. ';
  const start = textarea.selectionStart;
  const text = textarea.value;

  // Find start of current line
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;

  // Insert list prefix at start of line
  const newText = text.substring(0, lineStart) + prefix + text.substring(lineStart);
  textarea.value = newText;
  onChange(newText);

  setTimeout(() => {
    textarea.focus();
    const newPos = start + prefix.length;
    textarea.setSelectionRange(newPos, newPos);
  }, 0);
}

/**
 * Handle keyboard shortcuts for markdown formatting
 */
export function handleKeyboardShortcut(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  textarea: HTMLTextAreaElement,
  onChange: (value: string) => void
): boolean {
  const isMod = e.ctrlKey || e.metaKey;

  if (!isMod) return false;

  switch (e.key.toLowerCase()) {
    case 'b':
      e.preventDefault();
      wrapSelection(textarea, '**', '**', onChange);
      return true;

    case 'i':
      e.preventDefault();
      wrapSelection(textarea, '*', '*', onChange);
      return true;

    case 'k':
      e.preventDefault();
      insertLink(textarea, onChange);
      return true;

    case 'u':
      e.preventDefault();
      wrapSelection(textarea, '<u>', '</u>', onChange);
      return true;

    default:
      return false;
  }
}

/**
 * Detect if content is HTML or Markdown
 * Used for dual-mode rendering during migration period
 */
export function isHtmlContent(content: string): boolean {
  if (!content || !content.trim()) return false;

  // Check for HTML tags (Tiptap generates tags like <p>, <strong>, <em>, <ul>, etc.)
  const htmlTagPattern = /<[a-z][\s\S]*>/i;

  // Special case: content might have HTML-in-markdown (e.g., <u>, <span>)
  // but we want to treat it as markdown if it's primarily markdown
  // For now, simple detection: if it has paragraph tags, it's HTML (Tiptap output)
  const hasParagraphTags = /<p>/i.test(content) || /<p\s/i.test(content);
  const hasStrongTags = /<strong>/i.test(content);
  const hasEmTags = /<em>/i.test(content);

  // If it has typical Tiptap HTML structure, treat as HTML
  if (hasParagraphTags || (hasStrongTags && hasEmTags)) {
    return true;
  }

  // Otherwise check for any HTML tags
  return htmlTagPattern.test(content);
}

/**
 * Check if markdown mode is enabled via environment variable
 */
export function isMarkdownModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WORKSPACE_MARKDOWN_MODE === 'true';
}
