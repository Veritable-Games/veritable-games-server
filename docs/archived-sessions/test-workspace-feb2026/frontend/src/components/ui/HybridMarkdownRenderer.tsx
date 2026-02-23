'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
// Temporarily disable syntax highlighting to address security vulnerability
// TODO: Implement secure syntax highlighting alternative
import { remarkWikiLinks } from '@/lib/markdown/wikilink-plugin';
import { convertTailwindClasses } from '@/lib/theme/colorConversion';

interface HybridMarkdownRendererProps {
  content: string;
  className?: string;
  namespace?: string;
}

/**
 * React element props with children (for type safety with React nodes)
 */
interface ReactPropsWithChildren {
  children?: React.ReactNode;
}

/**
 * React element props with className (for code blocks)
 */
interface ReactPropsWithClassName {
  className?: string;
}

// Generate a URL-safe ID from header content
function generateHeaderId(children: React.ReactNode): string {
  const text = React.Children.toArray(children)
    .map(child => {
      if (typeof child === 'string') {
        return child;
      }
      if (React.isValidElement(child) && child.props) {
        const props = child.props as ReactPropsWithChildren;
        if (typeof props.children === 'string') {
          return props.children;
        }
      }
      return '';
    })
    .join('')
    .trim();

  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

export function HybridMarkdownRenderer({
  content,
  className = '',
  namespace,
}: HybridMarkdownRendererProps) {
  if (!content || typeof content !== 'string') {
    return null;
  }

  // Pre-process content to handle centered text
  // Support both ::: center ... ::: and <center>...</center>
  let processedContent = content;

  // Convert @mentions to profile links
  // Matches @username (alphanumeric, underscores, hyphens)
  // Excludes @mentions inside code blocks or already in links
  processedContent = processedContent.replace(
    /(?<![`\[])@([a-zA-Z0-9_-]+)(?![`\]])/g,
    '[@$1](/profile/$1)'
  );

  // Convert ::: center blocks to HTML center tags
  processedContent = processedContent.replace(
    /^:::[ ]*center\s*\n([\s\S]*?)\n:::[ ]*$/gm,
    '<div class="text-center">$1</div>'
  );

  // Also support inline centering with -> text <-
  processedContent = processedContent.replace(
    /^->[ ]*(.*?)[ ]*<-$/gm,
    '<div class="text-center">$1</div>'
  );

  return (
    <div className={`prose prose-sm prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkWikiLinks]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Custom heading renderer with proper sizing and auto-generated IDs
          h1: ({ children }) => {
            const id = generateHeaderId(children);
            return (
              <h1
                id={id}
                className="mb-4 border-b border-gray-600 pb-2 text-2xl font-bold text-white"
              >
                {children}
              </h1>
            );
          },
          h2: ({ children }) => {
            const id = generateHeaderId(children);
            return (
              <h2 id={id} className="mb-3 text-xl font-bold text-white">
                {children}
              </h2>
            );
          },
          h3: ({ children }) => {
            const id = generateHeaderId(children);
            return (
              <h3 id={id} className="mb-2 text-lg font-semibold text-white">
                {children}
              </h3>
            );
          },
          h4: ({ children }) => {
            const id = generateHeaderId(children);
            return (
              <h4 id={id} className="mb-2 text-base font-semibold text-gray-200">
                {children}
              </h4>
            );
          },
          h5: ({ children }) => {
            const id = generateHeaderId(children);
            return (
              <h5 id={id} className="mb-1 text-sm font-semibold text-gray-200">
                {children}
              </h5>
            );
          },
          h6: ({ children }) => {
            const id = generateHeaderId(children);
            return (
              <h6 id={id} className="mb-1 text-sm font-medium text-gray-300">
                {children}
              </h6>
            );
          },

          // Paragraph styling - filter out block-level elements to prevent nesting violations
          p: ({ children }) => {
            // Check if children contains block-level elements (pre, div)
            const hasBlockElements = React.Children.toArray(children).some(child => {
              if (React.isValidElement(child)) {
                const type = child.type;
                // Check if it's a block-level element
                if (
                  typeof type === 'string' &&
                  ['pre', 'div', 'blockquote', 'table'].includes(type)
                ) {
                  return true;
                }
              }
              return false;
            });

            // If paragraph contains block-level elements, render as fragment to avoid nesting violations
            if (hasBlockElements) {
              return <>{children}</>;
            }

            return <p className="mb-4 leading-relaxed text-gray-300">{children}</p>;
          },

          // Strong and emphasis
          strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
          em: ({ children }) => <em className="italic text-gray-200">{children}</em>,

          // Lists
          ul: ({ children }) => (
            <ul className="mb-4 list-inside list-disc space-y-1 text-gray-300">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 list-inside list-decimal space-y-1 text-gray-300">{children}</ol>
          ),
          li: ({ children }) => <li className="text-gray-300">{children}</li>,

          // Links (with special handling for wiki links and @mentions)
          a: ({ href, children, title }) => {
            const isWikiLink = href?.startsWith('/wiki/');
            const isExternal = href?.startsWith('http');
            const isMention =
              href?.startsWith('/profile/') &&
              typeof children === 'object' &&
              React.Children.toArray(children).some(
                child => typeof child === 'string' && child.startsWith('@')
              );

            let linkClasses = 'transition-colors';

            if (isMention) {
              // @mention styling - purple/pink with subtle background
              linkClasses +=
                ' text-pink-400 hover:text-pink-300 bg-pink-500/10 hover:bg-pink-500/20 px-1 rounded font-medium';
            } else if (isWikiLink) {
              // Wiki link styling - blue for all wiki links
              linkClasses +=
                ' text-blue-400 hover:text-blue-300 border-b border-blue-400/50 hover:border-blue-300/50';
            } else if (isExternal) {
              // External link styling
              linkClasses += ' text-green-400 hover:text-green-300 underline';
            } else {
              // Regular internal link styling - blue for all links
              linkClasses += ' text-blue-400 hover:text-blue-300 underline';
            }

            return (
              <a
                href={href}
                className={linkClasses}
                title={
                  title ||
                  (isMention ? `View ${String(children).replace('@', '')}'s profile` : undefined)
                }
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
              >
                {children}
                {isExternal && (
                  <svg
                    className="ml-1 inline h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                )}
              </a>
            );
          },

          // Code blocks - handle inline vs block-level properly to avoid nesting violations
          code: ({ inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';

            // Block-level code (has language or explicitly not inline)
            if (!inline) {
              // Use a wrapper div for the styled container
              // This entire component will be handled by the pre wrapper
              return (
                <code className="font-mono text-sm text-gray-200" {...props}>
                  {String(children).replace(/\n$/, '')}
                </code>
              );
            }

            // Inline code
            const codeClasses = 'px-1.5 py-0.5 rounded text-sm font-mono bg-gray-800 text-gray-200';

            return (
              <code className={codeClasses} {...props}>
                {children}
              </code>
            );
          },

          // Pre blocks - wrap code blocks with styling
          pre: ({ children, ...props }: any) => {
            // Extract language from code element if present
            const codeChild = React.Children.toArray(children).find(
              child => React.isValidElement(child) && child.type === 'code'
            );

            let language = '';
            if (React.isValidElement(codeChild) && codeChild.props) {
              const codeProps = codeChild.props as ReactPropsWithClassName;
              const className = codeProps.className || '';
              const match = /language-(\w+)/.exec(className);
              language = match && match[1] ? match[1] : '';
            }

            // Render with language label if present
            if (language) {
              return (
                <div className="mb-4 rounded-md border border-gray-700 bg-gray-900">
                  <div className="border-b border-gray-700 bg-gray-800 px-4 py-2 text-xs text-gray-400">
                    {language}
                  </div>
                  <pre className="overflow-x-auto p-4" {...props}>
                    {children}
                  </pre>
                </div>
              );
            }

            // Plain pre block without language
            return (
              <pre
                className="mb-4 overflow-x-auto rounded-md border border-gray-700 bg-gray-900 p-4"
                {...props}
              >
                {children}
              </pre>
            );
          },

          // Blockquotes
          blockquote: ({ children }) => {
            const blockquoteClasses = 'border-l-4 pl-4 mb-4 italic border-gray-600 text-gray-400';

            return <blockquote className={blockquoteClasses}>{children}</blockquote>;
          },

          // Tables
          table: ({ children }) => (
            <div className="mb-4 overflow-x-auto">
              <table className="min-w-full rounded-lg border border-gray-600">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-gray-600 bg-gray-800 px-3 py-2 text-left font-semibold text-white">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-600 px-3 py-2 text-gray-300">{children}</td>
          ),

          // Horizontal rule
          hr: () => <hr className="my-6 border-gray-600" />,

          // Line breaks
          br: () => <br />,

          // Custom div handler for centered text
          div: ({ children, ...props }: any) => {
            // Handle centered text
            const className = props.className || '';
            if (className.includes('text-center')) {
              return <div className="my-4 text-center">{children}</div>;
            }
            return <div {...props}>{children}</div>;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
