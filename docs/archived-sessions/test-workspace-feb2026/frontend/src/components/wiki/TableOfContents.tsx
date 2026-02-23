'use client';

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { logger } from '@/lib/utils/logger';

interface TOCItem {
  id: string;
  title: string;
  level: number;
  element?: HTMLElement;
}

interface TableOfContentsProps {
  content: string;
  className?: string;
  minLevel?: number;
  maxLevel?: number;
  sticky?: boolean;
}

// Extract headers from markdown or HTML content
function extractHeadersFromMarkdown(
  content: string,
  minLevel: number = 1,
  maxLevel: number = 6
): TOCItem[] {
  const headers: TOCItem[] = [];

  // Detect if content is HTML or Markdown
  const isHTML = /^\s*<[a-z][^>]*>/i.test(content);

  if (isHTML) {
    // Extract from HTML format: <h1>Title</h1>
    const htmlHeaderRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
    let match;

    while ((match = htmlHeaderRegex.exec(content)) !== null) {
      const level = parseInt(match[1]!);
      let title = match[2]!.trim();

      // Strip any inner HTML tags from title
      title = title.replace(/<[^>]*>/g, '');

      // Decode HTML entities
      const entities: Record<string, string> = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&apos;': "'",
        '&#39;': "'",
        '&nbsp;': ' ',
      };
      title = title.replace(/&[a-z0-9#]+;/gi, match => entities[match] || match);

      // Filter by level range
      if (level >= minLevel && level <= maxLevel) {
        // Generate a URL-safe ID from the title (matching HybridMarkdownRenderer logic)
        const id = title
          .toLowerCase()
          .replace(/[^\w\s-]/g, '') // Remove special characters
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single
          .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

        headers.push({
          id,
          title,
          level,
        });
      }
    }
  } else {
    // Extract from Markdown format: ## Title
    const markdownHeaderRegex = /^(#{1,6})\s+(.+)$/gm;
    let match;

    while ((match = markdownHeaderRegex.exec(content)) !== null) {
      const level = match[1]!.length;
      const title = match[2]!.trim();

      // Filter by level range
      if (level >= minLevel && level <= maxLevel) {
        // Generate a URL-safe ID from the title (matching HybridMarkdownRenderer logic)
        const id = title
          .toLowerCase()
          .replace(/[^\w\s-]/g, '') // Remove special characters
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single
          .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

        headers.push({
          id,
          title,
          level,
        });
      }
    }
  }

  return headers;
}

// Extract headers from rendered DOM
function extractHeadersFromDOM(minLevel: number = 1, maxLevel: number = 6): TOCItem[] {
  const headers: TOCItem[] = [];
  const headerSelectors = [];

  for (let i = minLevel; i <= maxLevel; i++) {
    headerSelectors.push(`h${i}`);
  }

  const headerElements = document.querySelectorAll(headerSelectors.join(', '));

  headerElements.forEach(element => {
    const htmlElement = element as HTMLElement;
    const level = parseInt(element.tagName.charAt(1));
    const title = element.textContent?.trim() || '';

    if (title) {
      let id = htmlElement.id;

      // Generate ID if it doesn't exist (matching HybridMarkdownRenderer logic)
      if (!id) {
        id = title
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
        htmlElement.id = id;
      }

      headers.push({
        id,
        title,
        level,
        element: htmlElement,
      });
    }
  });

  return headers;
}

export const TableOfContents = memo<TableOfContentsProps>(
  ({ content, className = '', minLevel = 1, maxLevel = 6, sticky = true }) => {
    const [headers, setHeaders] = useState<TOCItem[]>([]);
    const [activeId, setActiveId] = useState<string>('');
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Extract headers from markdown content - memoized to prevent recalculation
    const markdownHeaders = useMemo(() => {
      if (!content) return [];
      return extractHeadersFromMarkdown(content, minLevel, maxLevel);
    }, [content, minLevel, maxLevel]);

    // Memoized class string to prevent recreation
    const tocClasses = useMemo(
      () =>
        `${sticky ? 'sticky top-4' : ''} bg-gray-900/90 border border-gray-600 rounded-lg p-4 backdrop-blur-sm ${className}`.trim(),
      [sticky, className]
    );

    // Memoized update headers function to prevent recreation
    const updateHeaders = useCallback(() => {
      const domHeaders = extractHeadersFromDOM(minLevel, maxLevel);
      setHeaders(domHeaders.length > 0 ? domHeaders : markdownHeaders);
    }, [minLevel, maxLevel, markdownHeaders]);

    // Update headers from DOM on component mount and content change
    useEffect(() => {
      // Initial extraction
      const timer = setTimeout(updateHeaders, 100);

      // Set up mutation observer to track dynamic content changes
      const observer = new MutationObserver(mutations => {
        let shouldUpdate = false;
        mutations.forEach(mutation => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as Element;
                if (
                  element.matches('h1, h2, h3, h4, h5, h6') ||
                  element.querySelector('h1, h2, h3, h4, h5, h6')
                ) {
                  shouldUpdate = true;
                }
              }
            });
          }
        });

        if (shouldUpdate) {
          setTimeout(updateHeaders, 100);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      return () => {
        clearTimeout(timer);
        observer.disconnect();
      };
    }, [updateHeaders]);

    // Set up intersection observer for active section tracking
    useEffect(() => {
      if (headers.length === 0) return;

      const observer = new IntersectionObserver(
        entries => {
          const visibleHeaders = entries
            .filter(entry => entry.isIntersecting)
            .sort((a, b) => {
              const aRect = a.boundingClientRect;
              const bRect = b.boundingClientRect;
              return Math.abs(aRect.top) - Math.abs(bRect.top);
            });

          if (visibleHeaders.length > 0) {
            const firstHeader = visibleHeaders[0];
            if (firstHeader) {
              const target = firstHeader.target as HTMLElement;
              setActiveId(target.id);
            }
          }
        },
        {
          rootMargin: '-20% 0% -70% 0%',
          threshold: 0,
        }
      );

      headers.forEach(header => {
        if (header.element) {
          observer.observe(header.element);
        }
      });

      return () => observer.disconnect();
    }, [headers]);

    // Memoized toggle function to prevent recreation
    const toggleCollapse = useCallback(() => {
      setIsCollapsed(!isCollapsed);
    }, [isCollapsed]);

    // Memoized scroll handler to prevent recreation
    const scrollToHeader = useCallback((id: string) => {
      const element = document.getElementById(id);
      if (element) {
        // Find the nearest scrollable container (the one with overflow-y-auto)
        const scrollContainer =
          element.closest('.overflow-y-auto') ||
          element.closest('[data-scroll-container]') ||
          document.documentElement;

        if (scrollContainer && scrollContainer !== document.documentElement) {
          // Calculate position relative to scroll container
          const containerRect = scrollContainer.getBoundingClientRect();
          const elementRect = element.getBoundingClientRect();
          const yOffset = -80; // Account for any fixed headers
          const targetScrollTop =
            scrollContainer.scrollTop + (elementRect.top - containerRect.top) + yOffset;

          // Scroll the container instead of the window
          scrollContainer.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth',
          });
        } else {
          // Fallback to window scroll if no container found
          const yOffset = -80;
          const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;

          window.scrollTo({
            top: y,
            behavior: 'smooth',
          });
        }

        setActiveId(id);
      } else {
        logger.warn('TOC: Element not found for ID', { id });
      }
    }, []);

    // Memoized header click handler generator
    const createHeaderClickHandler = useCallback(
      (id: string) => () => scrollToHeader(id),
      [scrollToHeader]
    );

    if (headers.length === 0) {
      return null;
    }

    return (
      <nav className={tocClasses} aria-label="Table of contents">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-white">Contents</h3>
          <button
            onClick={toggleCollapse}
            className="p-1 text-gray-400 transition-colors hover:text-white"
            aria-label={isCollapsed ? 'Expand table of contents' : 'Collapse table of contents'}
          >
            <svg
              className={`h-4 w-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>

        {/* TOC List */}
        <div
          className={`overflow-hidden transition-all duration-200 ${isCollapsed ? 'max-h-0' : 'max-h-96'}`}
        >
          <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
            {headers.map((header, index) => {
              const isActive = activeId === header.id;
              const indent = (header.level - minLevel) * 12;

              return (
                <li key={`${header.id}-${index}`} style={{ paddingLeft: `${indent}px` }}>
                  <button
                    onClick={createHeaderClickHandler(header.id)}
                    className={`w-full rounded px-2 py-1 text-left text-sm transition-colors hover:bg-gray-800/50 hover:text-blue-300 ${
                      isActive
                        ? 'border-l-2 border-blue-400 bg-blue-900/20 text-blue-400'
                        : 'text-gray-300'
                    }`.trim()}
                    title={header.title}
                  >
                    <span className="line-clamp-2">{header.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer */}
        {!isCollapsed && headers.length > 5 && (
          <div className="mt-3 border-t border-gray-700 pt-3">
            <div className="text-center text-xs text-gray-500">{headers.length} sections</div>
          </div>
        )}
      </nav>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for TableOfContents optimization
    return (
      prevProps.content === nextProps.content &&
      prevProps.className === nextProps.className &&
      prevProps.minLevel === nextProps.minLevel &&
      prevProps.maxLevel === nextProps.maxLevel &&
      prevProps.sticky === nextProps.sticky
    );
  }
);

TableOfContents.displayName = 'TableOfContents';

// Hook for generating TOC data
export function useTableOfContents(content: string, minLevel: number = 1, maxLevel: number = 6) {
  const [headers, setHeaders] = useState<TOCItem[]>([]);

  useEffect(() => {
    if (!content) {
      setHeaders([]);
      return;
    }

    const markdownHeaders = extractHeadersFromMarkdown(content, minLevel, maxLevel);
    setHeaders(markdownHeaders);
  }, [content, minLevel, maxLevel]);

  return headers;
}

// Wikipedia-style inline TOC component (positioned next to title, not floating)
export function WikipediaStyleTOC({
  content,
  className = '',
  minLevel = 1,
  maxLevel = 6,
}: TableOfContentsProps) {
  const [isCollapsed, setIsCollapsed] = useState(true); // Default to collapsed
  const headers = useTableOfContents(content, minLevel, maxLevel);
  const tocRef = React.useRef<HTMLDivElement>(null);

  // Close TOC when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tocRef.current && !tocRef.current.contains(event.target as Node) && !isCollapsed) {
        setIsCollapsed(true);
      }
    }

    // Add event listener when TOC is open
    if (!isCollapsed) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    // Cleanup event listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCollapsed]);

  const scrollToHeader = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      // Find the nearest scrollable container (the one with overflow-y-auto)
      const scrollContainer =
        element.closest('.overflow-y-auto') ||
        element.closest('[data-scroll-container]') ||
        document.documentElement;

      if (scrollContainer && scrollContainer !== document.documentElement) {
        // Calculate position relative to scroll container
        const containerRect = scrollContainer.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const yOffset = -80; // Account for any fixed headers
        const targetScrollTop =
          scrollContainer.scrollTop + (elementRect.top - containerRect.top) + yOffset;

        // Scroll the container instead of the window
        scrollContainer.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth',
        });
      } else {
        // Fallback to window scroll if no container found
        const yOffset = -80;
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;

        window.scrollTo({
          top: y,
          behavior: 'smooth',
        });
      }
    } else {
      logger.warn('WikipediaStyleTOC: Element not found for ID', { id });
    }
  };

  if (headers.length === 0) {
    return null;
  }

  return (
    <div ref={tocRef}>
      {/* Fixed TOC icon that always stays visible */}
      <div className="h-12 w-12 flex-shrink-0 rounded border border-gray-600 bg-gray-900">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex h-full w-full items-center justify-center transition-colors hover:bg-gray-800/60"
          title={isCollapsed ? 'Show table of contents' : 'Hide table of contents'}
        >
          {/* Heroicons list-bullet icon */}
          <svg
            className="h-6 w-6 text-gray-400 hover:text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
            />
          </svg>
        </button>
      </div>

      {/* Expandable TOC box that appears separately */}
      {!isCollapsed && (
        <div
          className={`absolute left-0 z-10 w-64 rounded border border-gray-600 bg-gray-900 text-sm transition-all duration-300 ${className}`}
          style={{
            fontSize: '88%',
            lineHeight: '1.6em',
            top: '60px', // Position below title when expanded
          }}
        >
          {/* Header - Wikipedia style */}
          <div className="border-b border-gray-600 bg-gray-800/60 px-2 py-1.5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-gray-200">Contents</div>
              <button
                onClick={() => setIsCollapsed(true)}
                className="text-xs text-blue-400 hover:text-blue-300 hover:underline"
                style={{ fontSize: '11px' }}
              >
                [hide]
              </button>
            </div>
          </div>

          {/* Content - scrollable */}
          <div className="max-h-[32rem] overflow-y-auto px-2 py-2">
            <ol className="list-none space-y-0.5" style={{ margin: 0, padding: 0 }}>
              {headers.map((header, index) => {
                const indent = Math.max(0, (header.level - 1) * 12);

                return (
                  <li
                    key={`${header.id}-${index}`}
                    className="leading-tight"
                    style={{
                      paddingLeft: `${indent}px`,
                      margin: 0,
                    }}
                  >
                    <button
                      onClick={() => scrollToHeader(header.id)}
                      className="w-full py-0.5 text-left text-blue-400 hover:text-blue-300 hover:underline"
                      style={{ fontSize: '11px', lineHeight: '1.4' }}
                    >
                      <span className="mr-1 text-gray-400">
                        {header.level === 1
                          ? `${index + 1}`
                          : header.level === 2
                            ? `${Math.floor(index / 2) + 1}.${(index % 2) + 1}`
                            : `${Math.floor(index / 4) + 1}.${Math.floor((index % 4) / 2) + 1}.${(index % 2) + 1}`}
                      </span>
                      {header.title}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

// Legacy alias for backward compatibility
export const FloatingTOC = WikipediaStyleTOC;

export default TableOfContents;
