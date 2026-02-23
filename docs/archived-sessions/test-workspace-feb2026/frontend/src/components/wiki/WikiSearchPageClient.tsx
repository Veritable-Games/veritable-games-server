'use client';

import { useState, useMemo } from 'react';
import { UnifiedSearchHeader, SearchResultTable } from '@/components/ui/SearchResultTable';
import ClientWikiHeader from '@/components/wiki/ClientWikiHeader';

interface WikiSearchPageClientProps {
  initialPages: any[];
  initialQuery?: string;
  categories: any[];
  userRole?: string;
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

export function WikiSearchPageClient({
  initialPages,
  initialQuery = '',
  categories,
  userRole,
}: WikiSearchPageClientProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Real-time filtering with useMemo (like Library)
  const filteredPages = useMemo(() => {
    let results = initialPages;

    // Filter by search query
    if (query.trim()) {
      const q = query.toLowerCase();
      results = results.filter(
        page =>
          page.title.toLowerCase().includes(q) ||
          (page.content && page.content.toLowerCase().includes(q)) ||
          (page.categories &&
            page.categories.some((cat: string) => cat.toLowerCase().includes(q))) ||
          (page.tags && page.tags.some((tag: string) => tag.toLowerCase().includes(q)))
      );
    }

    // Filter by category
    if (selectedCategory) {
      results = results.filter(
        page => page.category_ids && page.category_ids.includes(selectedCategory)
      );
    }

    return results;
  }, [initialPages, query, selectedCategory]);

  // Convert to unified format for SearchResultTable
  const unifiedPages = filteredPages.map(wikiPage => ({
    id: wikiPage.id,
    type: 'wiki' as const,
    title: wikiPage.title,
    content: getPlainTextPreview(wikiPage.content, 200),
    slug: wikiPage.slug,

    // Wiki-specific fields (SearchResultTable expects these at root level)
    author: wikiPage.author || undefined,
    categories: wikiPage.categories || [],
    total_views: wikiPage.total_views || 0,
    created_at: wikiPage.created_at,
    updated_at: wikiPage.updated_at,
  }));

  // Breadcrumbs
  const breadcrumbs = [{ label: 'Wiki', href: '/wiki' }, { label: 'Search' }];

  // Category filter options
  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...categories.map(cat => ({ value: cat.id, label: cat.name })),
  ];

  const actionButtons = (
    <div className="flex items-center gap-2">
      <select
        value={selectedCategory}
        onChange={e => setSelectedCategory(e.target.value)}
        className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
      >
        {categoryOptions.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col px-6 py-2">
      <UnifiedSearchHeader
        title="Wiki Search"
        description={
          query ? `Found ${filteredPages.length} pages matching "${query}"` : 'Search wiki pages'
        }
        breadcrumbs={breadcrumbs}
        searchPlaceholder="Search wiki pages..."
        searchValue={query}
        onSearchChange={setQuery} // ✅ Now working!
        onSearchSubmit={q => setQuery(q)}
        actionButtons={actionButtons}
        resultCount={filteredPages.length}
        resultType={filteredPages.length === 1 ? 'page' : 'pages'}
        loginWidget={<ClientWikiHeader />}
      />

      <div className="flex-1 overflow-y-auto pr-0 [scrollbar-width:none] md:pr-2 md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block">
        <SearchResultTable items={unifiedPages} type="wiki" loading={false} />
      </div>
    </div>
  );
}
