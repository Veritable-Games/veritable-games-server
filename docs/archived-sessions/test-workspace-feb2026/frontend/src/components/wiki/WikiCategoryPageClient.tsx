'use client';

import { useState, useMemo } from 'react';
import { UnifiedSearchHeader, SearchResultTable } from '@/components/ui/SearchResultTable';
import ClientWikiHeader from '@/components/wiki/ClientWikiHeader';
import Link from 'next/link';

interface WikiCategoryPageClientProps {
  categoryId: string;
  categoryName: string;
  initialPages: any[];
  subcategories: any[];
}

// Helper to get plain text preview - handles both HTML and Markdown content
function getPlainTextPreview(content: string | null | undefined, maxLength: number = 200): string {
  if (!content) return '';

  // Detect if content is HTML (starts with HTML tags) or Markdown
  const isHTML = /^\s*<[a-z][^>]*>/i.test(content);

  let text = content;

  if (isHTML) {
    // For HTML content: strip tags and decode entities
    text = content.replace(/<[^>]*>/g, '');

    // Decode common HTML entities
    const entities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&apos;': "'",
      '&#39;': "'",
      '&nbsp;': ' ',
    };

    text = text.replace(/&[a-z0-9#]+;/gi, match => entities[match] || match);
  } else {
    // For Markdown content: strip markdown formatting for cleaner preview
    text = content
      .replace(/^#{1,6}\s+/gm, '') // Remove markdown headers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Remove links, keep text
  }

  // Truncate and add ellipsis
  return text.length > maxLength ? text.substring(0, maxLength).trim() + '...' : text;
}

export function WikiCategoryPageClient({
  categoryId,
  categoryName,
  initialPages,
  subcategories,
}: WikiCategoryPageClientProps) {
  const [query, setQuery] = useState('');

  // Real-time filtering within this category
  const filteredPages = useMemo(() => {
    if (!query.trim()) {
      return initialPages;
    }

    const q = query.toLowerCase();
    return initialPages.filter(
      page =>
        page.title.toLowerCase().includes(q) ||
        (page.content && page.content.toLowerCase().includes(q)) ||
        (page.tags && page.tags.some((tag: string) => tag.toLowerCase().includes(q)))
    );
  }, [initialPages, query]);

  // Convert to unified format for SearchResultTable
  const unifiedPages = filteredPages.map(wikiPage => ({
    id: wikiPage.id,
    type: 'wiki' as const,
    title: wikiPage.title,
    content: getPlainTextPreview(wikiPage.content, 200),
    slug: wikiPage.slug,

    // Wiki-specific fields (SearchResultTable expects these at root level)
    author: wikiPage.author || undefined,
    categories: wikiPage.categories || [categoryName],
    total_views: wikiPage.total_views || 0,
    created_at: wikiPage.created_at,
    updated_at: wikiPage.updated_at,
  }));

  const breadcrumbs = [{ label: 'Wiki', href: '/wiki' }, { label: categoryName }];

  const actionButtons = (
    <>
      <Link
        href="/wiki/create"
        className="flex h-8 items-center rounded border border-blue-500/50 bg-gray-800/40 px-3 text-sm text-blue-400 transition-colors hover:border-blue-400/70 hover:bg-gray-700/60 hover:text-blue-300"
      >
        Create Page
      </Link>
      <Link
        href="/wiki"
        className="flex h-8 items-center rounded border border-gray-600/40 bg-gray-800/40 px-3 text-sm text-gray-300 transition-colors hover:border-gray-500/60 hover:bg-gray-700/60 hover:text-white"
      >
        ← Back
      </Link>
    </>
  );

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col px-6 py-2">
      <UnifiedSearchHeader
        title={categoryName}
        description={
          query
            ? `Found ${filteredPages.length} pages in ${categoryName} matching "${query}"`
            : `${initialPages.length} pages in this category`
        }
        breadcrumbs={breadcrumbs}
        searchPlaceholder={`Search within ${categoryName}...`}
        searchValue={query}
        onSearchChange={setQuery} // ✅ Now working!
        onSearchSubmit={q => setQuery(q)}
        actionButtons={actionButtons}
        resultCount={filteredPages.length}
        resultType={filteredPages.length === 1 ? 'page' : 'pages'}
        loginWidget={<ClientWikiHeader />}
      />

      {/* Subcategories */}
      {subcategories.length > 0 && !query && (
        <div className="mb-4 flex-shrink-0">
          <h3 className="mb-2 text-sm font-medium text-gray-400">Subcategories</h3>
          <div className="flex flex-wrap gap-2">
            {subcategories.map((subcat: any) => (
              <Link
                key={subcat.id}
                href={`/wiki/category/${subcat.id}`}
                className="rounded border border-gray-600/40 bg-gray-800/40 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:border-blue-500/50 hover:bg-gray-700/60 hover:text-white"
              >
                {subcat.name} ({subcat.page_count})
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto pr-0 [scrollbar-width:none] md:pr-2 md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block">
        <SearchResultTable items={unifiedPages} type="wiki" loading={false} />
      </div>
    </div>
  );
}
