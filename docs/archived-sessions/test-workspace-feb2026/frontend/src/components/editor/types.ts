// Shared types for the unified editor system

export type FormatType =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'underline'
  | 'code'
  | 'link'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'heading5'
  | 'heading6'
  | 'bulletList'
  | 'numberedList'
  | 'taskList'
  | 'quote'
  | 'codeBlock'
  | 'table'
  | 'horizontalRule'
  | 'wikiLink'
  | 'libraryLink'
  | 'image';

export interface FormatAction {
  type: FormatType;
  before: string;
  after?: string;
  defaultText?: string;
  isLinePrefix?: boolean;
  isBlock?: boolean;
}

// Format definitions for markdown syntax
export const FORMAT_ACTIONS: Record<FormatType, FormatAction> = {
  bold: { type: 'bold', before: '**', after: '**', defaultText: 'bold text' },
  italic: { type: 'italic', before: '*', after: '*', defaultText: 'italic text' },
  strikethrough: { type: 'strikethrough', before: '~~', after: '~~', defaultText: 'strikethrough' },
  underline: { type: 'underline', before: '__', after: '__', defaultText: 'underlined text' },
  code: { type: 'code', before: '`', after: '`', defaultText: 'code' },
  link: { type: 'link', before: '[', after: '](url)', defaultText: 'link text' },
  heading1: { type: 'heading1', before: '# ', isLinePrefix: true },
  heading2: { type: 'heading2', before: '## ', isLinePrefix: true },
  heading3: { type: 'heading3', before: '### ', isLinePrefix: true },
  heading4: { type: 'heading4', before: '#### ', isLinePrefix: true },
  heading5: { type: 'heading5', before: '##### ', isLinePrefix: true },
  heading6: { type: 'heading6', before: '###### ', isLinePrefix: true },
  bulletList: { type: 'bulletList', before: '- ', isLinePrefix: true },
  numberedList: { type: 'numberedList', before: '1. ', isLinePrefix: true },
  taskList: { type: 'taskList', before: '- [ ] ', isLinePrefix: true },
  quote: { type: 'quote', before: '> ', isLinePrefix: true },
  codeBlock: {
    type: 'codeBlock',
    before: '```\n',
    after: '\n```',
    defaultText: 'code block',
    isBlock: true,
  },
  table: {
    type: 'table',
    before: '| Header 1 | Header 2 |\n| -------- | -------- |\n| Cell 1   | Cell 2   |',
    isBlock: true,
  },
  horizontalRule: { type: 'horizontalRule', before: '---', isBlock: true },
  wikiLink: { type: 'wikiLink', before: '[[', after: ']]', defaultText: 'page name' },
  libraryLink: { type: 'libraryLink', before: '[[library:', after: ']]', defaultText: 'document' },
  image: { type: 'image', before: '![', after: '](url)', defaultText: 'alt text' },
};

export interface EditorToolbarProps {
  onFormat: (type: FormatType) => void;
  activeFormats?: Set<FormatType>;
  disabled?: boolean;
}

export interface UnifiedEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  features?: 'simple' | 'full'; // simple for forums, full for wiki
  showPreview?: boolean;
  disabled?: boolean;
  className?: string;
  minRows?: number;
  maxRows?: number;
  onSave?: () => void;
  readOnly?: boolean;
}
