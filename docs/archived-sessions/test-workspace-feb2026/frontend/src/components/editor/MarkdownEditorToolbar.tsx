'use client';

import React, { useEffect, useState } from 'react';

interface MarkdownEditorToolbarProps {
  onInsertMarkdown: (before: string, after?: string) => void;
  isPreviewMode: boolean;
  setIsPreviewMode: (mode: boolean) => void;
  onSave?: () => void;
  readOnly?: boolean;
  showPreview?: boolean;
  content: string;
}

export function MarkdownEditorToolbar({
  onInsertMarkdown,
  isPreviewMode,
  setIsPreviewMode,
  onSave,
  readOnly = false,
  showPreview = true,
  content,
}: MarkdownEditorToolbarProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [showMoreTools, setShowMoreTools] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close more tools dropdown when clicking outside
  useEffect(() => {
    if (!showMoreTools) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.more-tools-container')) {
        setShowMoreTools(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showMoreTools]);

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readOnly) return;

      // Check for Ctrl/Cmd + U for underline
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        onInsertMarkdown('__', '__');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onInsertMarkdown, readOnly]);

  const handleHeadingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value) {
      const prefix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
      onInsertMarkdown(prefix + value + ' ', '\n');
      e.target.value = '';
    }
  };

  const handleListChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value) {
      const prefix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
      onInsertMarkdown(prefix + value);
      e.target.value = '';
    }
  };

  const handleInsertTable = () => {
    const prefix = content.length > 0 && !content.endsWith('\n') ? '\n\n' : '';
    const tableTemplate = `| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |`;
    onInsertMarkdown(prefix + tableTemplate + '\n');
  };

  const handleInsertHR = () => {
    const prefix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
    const suffix = !content.endsWith('\n') ? '\n' : '';
    onInsertMarkdown(prefix + '---' + suffix);
  };

  const handleInsertQuote = () => {
    const prefix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
    onInsertMarkdown(prefix + '> ');
  };

  const toolbarButtonStyle: React.CSSProperties = {
    width: isMobile ? '2.75rem' : '1.75rem', // 44px on mobile, 28px on desktop
    height: isMobile ? '2.75rem' : '1.75rem',
    minWidth: isMobile ? '2.75rem' : '1.75rem',
    minHeight: isMobile ? '2.75rem' : '1.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    color: 'rgb(209, 213, 219)',
    borderRadius: '0.25rem',
    transition: 'all 0.15s ease',
    border: 'none',
    cursor: 'pointer',
  };

  const toolbarDropdownStyle: React.CSSProperties = {
    height: isMobile ? '2.75rem' : '1.75rem',
    paddingLeft: '0.5rem',
    paddingRight: '1.5rem',
    fontSize: isMobile ? '0.875rem' : '0.75rem',
    background: 'rgb(55, 65, 81)',
    color: 'rgb(209, 213, 219)',
    borderRadius: '0.25rem',
    border: 'none',
    cursor: 'pointer',
    appearance: 'none' as React.CSSProperties['appearance'],
    transition: 'all 0.15s ease',
  };

  const toolbarGroupStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(55, 65, 81, 0.5)',
    borderRadius: '0.25rem',
    padding: isMobile ? '0.25rem' : '0.125rem',
    gap: isMobile ? '0.25rem' : '0.125rem',
  };

  const actionButtonStyle: React.CSSProperties = {
    height: isMobile ? '2.75rem' : '1.75rem',
    minHeight: isMobile ? '2.75rem' : '1.75rem',
    padding: isMobile ? '0 1rem' : '0 0.75rem',
    fontSize: isMobile ? '0.875rem' : '0.75rem',
    fontWeight: 500,
    borderRadius: '0.25rem',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  };

  const moreToolsDropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: '0.25rem',
    background: 'rgb(31, 41, 55)',
    border: '1px solid rgb(55, 65, 81)',
    borderRadius: '0.5rem',
    padding: '0.5rem',
    minWidth: '200px',
    maxWidth: '90vw',
    zIndex: 50,
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
  };

  const moreToolsButtonStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    background: 'transparent',
    color: 'rgb(209, 213, 219)',
    border: 'none',
    borderRadius: '0.25rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 500,
    transition: 'all 0.15s ease',
    textAlign: 'left' as const,
  };

  // Add hover effects inline for buttons
  const buttonHoverStyle = `
    button:hover:not(:disabled) {
      background-color: rgba(59, 130, 246, 0.1) !important;
    }
    button:active:not(:disabled) {
      background-color: rgba(59, 130, 246, 0.2) !important;
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .more-tools-container button:hover:not(:disabled) {
      background-color: rgba(156, 163, 175, 0.1) !important;
    }
  `;

  return (
    <div style={{ background: 'rgb(31, 41, 55)', borderBottom: '1px solid rgb(55, 65, 81)' }}>
      <style dangerouslySetInnerHTML={{ __html: buttonHoverStyle }} />
      <div
        style={{
          padding: isMobile ? '0.5rem' : '0.375rem 0.5rem',
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minWidth: 'fit-content',
          }}
        >
          {/* Left side: Editing tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
            {/* Primary tools group - always visible */}
            <div style={toolbarGroupStyle}>
              <button
                type="button"
                style={toolbarButtonStyle}
                onClick={() => onInsertMarkdown('**', '**')}
                title="Bold (Ctrl+B)"
                disabled={readOnly}
                aria-label="Bold"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"
                  />
                </svg>
              </button>
              <button
                type="button"
                style={toolbarButtonStyle}
                onClick={() => onInsertMarkdown('*', '*')}
                title="Italic (Ctrl+I)"
                disabled={readOnly}
                aria-label="Italic"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 4h4m0 16h-4m4-16l-4 16"
                  />
                </svg>
              </button>
              <button
                type="button"
                style={toolbarButtonStyle}
                onClick={() => onInsertMarkdown('[', '](url)')}
                title="Link"
                disabled={readOnly}
                aria-label="Link"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </button>
            </div>

            {/* Secondary tools - hidden on mobile */}
            {!isMobile && (
              <>
                {/* Extended text formatting */}
                <div style={toolbarGroupStyle}>
                  <button
                    type="button"
                    style={toolbarButtonStyle}
                    onClick={() => onInsertMarkdown('~~', '~~')}
                    title="Strikethrough"
                    disabled={readOnly}
                    aria-label="Strikethrough"
                  >
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        textDecoration: 'line-through',
                      }}
                    >
                      S
                    </span>
                  </button>
                  <button
                    type="button"
                    style={toolbarButtonStyle}
                    onClick={() => onInsertMarkdown('__', '__')}
                    title="Underline (Ctrl+U)"
                    disabled={readOnly}
                    aria-label="Underline"
                  >
                    <span
                      style={{ fontSize: '0.75rem', fontWeight: 500, textDecoration: 'underline' }}
                    >
                      U
                    </span>
                  </button>
                  <button
                    type="button"
                    style={toolbarButtonStyle}
                    onClick={() => onInsertMarkdown('`', '`')}
                    title="Inline Code"
                    disabled={readOnly}
                    aria-label="Code"
                  >
                    <svg
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                      />
                    </svg>
                  </button>
                </div>

                {/* Quote button */}
                <div style={toolbarGroupStyle}>
                  <button
                    type="button"
                    style={toolbarButtonStyle}
                    onClick={handleInsertQuote}
                    title="Quote"
                    disabled={readOnly}
                    aria-label="Quote"
                  >
                    <svg
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </button>
                </div>
              </>
            )}

            {/* Heading dropdown - always visible */}
            <div style={{ position: 'relative' }}>
              <select
                style={toolbarDropdownStyle}
                onChange={handleHeadingChange}
                title="Heading"
                disabled={readOnly}
              >
                <option value="">H</option>
                <option value="#">H1</option>
                <option value="##">H2</option>
                <option value="###">H3</option>
                <option value="####">H4</option>
                <option value="#####">H5</option>
                <option value="######">H6</option>
              </select>
              <svg
                style={{
                  position: 'absolute',
                  right: '0.25rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  width: '14px',
                  height: '14px',
                  color: 'rgb(156, 163, 175)',
                }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>

            {/* Lists dropdown - hidden on mobile (moved to More menu) */}
            {!isMobile && (
              <div style={{ position: 'relative' }}>
                <select
                  style={toolbarDropdownStyle}
                  onChange={handleListChange}
                  title="Lists"
                  disabled={readOnly}
                >
                  <option value="">List</option>
                  <option value="- ">• Bullet</option>
                  <option value="1. ">1. Number</option>
                  <option value="- [ ] ">☐ Task</option>
                </select>
                <svg
                  style={{
                    position: 'absolute',
                    right: '0.25rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    width: '14px',
                    height: '14px',
                    color: 'rgb(156, 163, 175)',
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            )}

            {/* Extended tools - Desktop */}
            {!isMobile && (
              <div style={toolbarGroupStyle}>
                <button
                  type="button"
                  style={toolbarButtonStyle}
                  onClick={() => onInsertMarkdown('[[', ']]')}
                  title="Wiki Link"
                  disabled={readOnly}
                  aria-label="Wiki Link"
                >
                  <span style={{ fontSize: '0.625rem', fontWeight: 600 }}>Wiki</span>
                </button>
                <button
                  type="button"
                  style={toolbarButtonStyle}
                  onClick={() => onInsertMarkdown('[[library:', ']]')}
                  title="Library Link"
                  disabled={readOnly}
                  aria-label="Library Link"
                >
                  <span style={{ fontSize: '0.625rem', fontWeight: 600 }}>Lib</span>
                </button>
                <button
                  type="button"
                  style={toolbarButtonStyle}
                  onClick={handleInsertTable}
                  title="Insert Table"
                  disabled={readOnly}
                  aria-label="Table"
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  style={toolbarButtonStyle}
                  onClick={handleInsertHR}
                  title="Horizontal Rule"
                  disabled={readOnly}
                  aria-label="Horizontal Rule"
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 12h14"
                    />
                  </svg>
                </button>
              </div>
            )}

            {/* More Tools - Mobile */}
            {isMobile && (
              <div style={{ position: 'relative' }} className="more-tools-container">
                <button
                  type="button"
                  style={{
                    ...toolbarButtonStyle,
                    background: showMoreTools ? 'rgba(59, 130, 246, 0.3)' : 'rgb(55, 65, 81)',
                    border: showMoreTools
                      ? '1px solid rgba(59, 130, 246, 0.5)'
                      : '1px solid transparent',
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    setShowMoreTools(!showMoreTools);
                  }}
                  onMouseDown={e => e.preventDefault()} // Prevent focus loss on editor
                  title="More Tools"
                  disabled={readOnly}
                  aria-label="More Tools"
                  aria-expanded={showMoreTools}
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showMoreTools ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                      />
                    )}
                  </svg>
                </button>

                {showMoreTools && (
                  <div style={moreToolsDropdownStyle}>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'rgb(156, 163, 175)',
                        marginBottom: '0.5rem',
                        fontWeight: 600,
                      }}
                    >
                      Extended Tools
                    </div>

                    {/* Text Formatting Section */}
                    <div style={{ marginBottom: '0.5rem' }}>
                      <button
                        type="button"
                        style={moreToolsButtonStyle}
                        onClick={() => {
                          onInsertMarkdown('~~', '~~');
                          setShowMoreTools(false);
                        }}
                        disabled={readOnly}
                      >
                        <span style={{ textDecoration: 'line-through' }}>S</span>
                        <span>Strikethrough</span>
                      </button>
                      <button
                        type="button"
                        style={moreToolsButtonStyle}
                        onClick={() => {
                          onInsertMarkdown('__', '__');
                          setShowMoreTools(false);
                        }}
                        disabled={readOnly}
                      >
                        <span style={{ textDecoration: 'underline' }}>U</span>
                        <span>Underline</span>
                      </button>
                      <button
                        type="button"
                        style={moreToolsButtonStyle}
                        onClick={() => {
                          onInsertMarkdown('`', '`');
                          setShowMoreTools(false);
                        }}
                        disabled={readOnly}
                      >
                        <svg
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                          />
                        </svg>
                        <span>Inline Code</span>
                      </button>
                      <button
                        type="button"
                        style={moreToolsButtonStyle}
                        onClick={() => {
                          const prefix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
                          onInsertMarkdown(prefix + '```\n', '\n```');
                          setShowMoreTools(false);
                        }}
                        disabled={readOnly}
                      >
                        <svg
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span>Code Block</span>
                      </button>
                    </div>

                    <div
                      style={{
                        borderTop: '1px solid rgb(55, 65, 81)',
                        paddingTop: '0.5rem',
                        marginBottom: '0.5rem',
                      }}
                    />

                    {/* Lists Section */}
                    <div style={{ marginBottom: '0.5rem' }}>
                      <button
                        type="button"
                        style={moreToolsButtonStyle}
                        onClick={() => {
                          const prefix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
                          onInsertMarkdown(prefix + '- ');
                          setShowMoreTools(false);
                        }}
                        disabled={readOnly}
                      >
                        <span style={{ fontSize: '1rem' }}>•</span>
                        <span>Bullet List</span>
                      </button>
                      <button
                        type="button"
                        style={moreToolsButtonStyle}
                        onClick={() => {
                          const prefix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
                          onInsertMarkdown(prefix + '1. ');
                          setShowMoreTools(false);
                        }}
                        disabled={readOnly}
                      >
                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>1.</span>
                        <span>Numbered List</span>
                      </button>
                      <button
                        type="button"
                        style={moreToolsButtonStyle}
                        onClick={() => {
                          const prefix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
                          onInsertMarkdown(prefix + '- [ ] ');
                          setShowMoreTools(false);
                        }}
                        disabled={readOnly}
                      >
                        <span style={{ fontSize: '1rem' }}>☐</span>
                        <span>Task List</span>
                      </button>
                    </div>

                    <div
                      style={{
                        borderTop: '1px solid rgb(55, 65, 81)',
                        paddingTop: '0.5rem',
                        marginBottom: '0.5rem',
                      }}
                    />

                    {/* Links Section */}
                    <div style={{ marginBottom: '0.5rem' }}>
                      <button
                        type="button"
                        style={moreToolsButtonStyle}
                        onClick={() => {
                          onInsertMarkdown('[[', ']]');
                          setShowMoreTools(false);
                        }}
                        disabled={readOnly}
                      >
                        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Wiki</span>
                        <span>Wiki Link</span>
                      </button>
                      <button
                        type="button"
                        style={moreToolsButtonStyle}
                        onClick={() => {
                          onInsertMarkdown('[[library:', ']]');
                          setShowMoreTools(false);
                        }}
                        disabled={readOnly}
                      >
                        <svg
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                          />
                        </svg>
                        <span>Library Link</span>
                      </button>
                    </div>

                    <div
                      style={{
                        borderTop: '1px solid rgb(55, 65, 81)',
                        paddingTop: '0.5rem',
                        marginBottom: '0.5rem',
                      }}
                    />

                    {/* Structure Section */}
                    <div>
                      <button
                        type="button"
                        style={moreToolsButtonStyle}
                        onClick={() => {
                          handleInsertTable();
                          setShowMoreTools(false);
                        }}
                        disabled={readOnly}
                      >
                        <svg
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        <span>Insert Table</span>
                      </button>
                      <button
                        type="button"
                        style={moreToolsButtonStyle}
                        onClick={() => {
                          handleInsertHR();
                          setShowMoreTools(false);
                        }}
                        disabled={readOnly}
                      >
                        <svg
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5 12h14"
                          />
                        </svg>
                        <span>Horizontal Rule</span>
                      </button>
                      <button
                        type="button"
                        style={moreToolsButtonStyle}
                        onClick={() => {
                          handleInsertQuote();
                          setShowMoreTools(false);
                        }}
                        disabled={readOnly}
                      >
                        <svg
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          />
                        </svg>
                        <span>Quote Block</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right side: Action buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              marginLeft: '0.5rem',
              flexShrink: 0,
            }}
          >
            {showPreview && (
              <button
                type="button"
                style={{
                  ...actionButtonStyle,
                  background: 'rgb(55, 65, 81)',
                  color: 'rgb(209, 213, 219)',
                }}
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                title={isPreviewMode ? 'Edit Mode' : 'Preview Mode'}
              >
                {isPreviewMode ? (
                  <>
                    <svg
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                    <span style={{ display: isMobile ? 'none' : 'inline' }}>Edit</span>
                  </>
                ) : (
                  <>
                    <svg
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    <span style={{ display: isMobile ? 'none' : 'inline' }}>Preview</span>
                  </>
                )}
              </button>
            )}
            {onSave && (
              <button
                type="button"
                style={{ ...actionButtonStyle, background: 'rgb(37, 99, 235)', color: 'white' }}
                onClick={onSave}
                title="Save (Ctrl+S)"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2"
                  />
                </svg>
                <span style={{ display: isMobile ? 'none' : 'inline' }}>Save</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MarkdownEditorToolbar;
