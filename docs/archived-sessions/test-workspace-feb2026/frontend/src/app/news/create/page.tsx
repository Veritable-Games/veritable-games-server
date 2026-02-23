'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UnifiedMarkdownEditor } from '@/components/editor/UnifiedMarkdownEditor';
import { useAuth } from '@/contexts/AuthContext';
import { LoginWidget } from '@/components/shared/LoginWidget';
import { fetchJSON } from '@/lib/utils/csrf';
import { Loader2, ShieldAlert } from 'lucide-react';
import { logger } from '@/lib/utils/logger';

// Available icons for news articles (matches NewsArticlesList getTagIcon)
const ARTICLE_ICONS = [
  {
    id: 'announcement',
    label: 'Announcement',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
        />
      </svg>
    ),
  },
  {
    id: 'update',
    label: 'Update',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    ),
  },
  {
    id: 'features',
    label: 'Features',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
        />
      </svg>
    ),
  },
  {
    id: 'development',
    label: 'Development',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
        />
      </svg>
    ),
  },
  {
    id: 'security',
    label: 'Security',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
  },
  {
    id: 'performance',
    label: 'Performance',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
  },
  {
    id: 'community',
    label: 'Community',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
  },
  {
    id: 'documentation',
    label: 'Documentation',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    id: 'welcome',
    label: 'Welcome',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    id: 'platform',
    label: 'Platform',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
        />
      </svg>
    ),
  },
];

export default function CreateNewsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('announcement');
  const [additionalTags, setAdditionalTags] = useState('');
  const [featuredImage, setFeaturedImage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    if (!title.trim()) {
      setError('Article title is required');
      setLoading(false);
      return;
    }

    if (!excerpt.trim()) {
      setError('Article summary/excerpt is required');
      setLoading(false);
      return;
    }

    if (!content.trim()) {
      setError('Article content is required');
      setLoading(false);
      return;
    }

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 100);

    try {
      // Combine selected icon (as primary tag) with additional tags
      const additionalTagsList = additionalTags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0 && tag.toLowerCase() !== selectedIcon.toLowerCase());
      const allTags = [selectedIcon, ...additionalTagsList];

      const data = await fetchJSON('/api/news', {
        method: 'POST',
        body: {
          title: title.trim(),
          slug,
          summary: excerpt.trim(),
          content: content.trim(),
          author: user?.username || user?.email || 'Staff',
          published_at: new Date().toISOString(),
          status: 'published',
          featured_image: featuredImage.trim() || null,
          tags: allTags,
        },
      });

      if (data.success || data.id) {
        router.push(`/news/${slug}`);
      } else {
        setError(data.error || 'Failed to create news article');
      }
    } catch (err) {
      logger.error('Error creating news article:', err);
      setError('Failed to create news article. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Check authentication loading
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  // Check authentication
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-4">
        <div className="mb-6 rounded-lg border border-red-700/50 bg-red-900/20 p-4">
          <p className="text-red-400">You must be logged in to create news articles.</p>
        </div>
        <Link
          href="/news"
          className="rounded-lg border border-gray-700 px-4 py-2 text-gray-300 hover:bg-gray-800"
        >
          Back to News
        </Link>
      </div>
    );
  }

  // Check admin permissions
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-4">
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-yellow-700/50 bg-yellow-900/20 p-4">
          <ShieldAlert className="text-yellow-400" />
          <p className="text-yellow-400">Only administrators can create news articles.</p>
        </div>
        <Link
          href="/news"
          className="rounded-lg border border-gray-700 px-4 py-2 text-gray-300 hover:bg-gray-800"
        >
          Back to News
        </Link>
      </div>
    );
  }

  const canSubmit = title.trim() && excerpt.trim() && content.trim() && !loading;

  return (
    <div className="mx-auto max-w-5xl px-8 py-6">
      {/* Breadcrumb navigation */}
      <nav className="mb-4 text-sm text-gray-400" aria-label="Breadcrumb">
        <ol className="flex items-center">
          <li>
            <Link href="/news" className="transition-colors hover:text-blue-400">
              News
            </Link>
          </li>
          <li>
            <span className="mx-2">›</span>
          </li>
          <li>
            <span className="text-gray-300">Create Article</span>
          </li>
        </ol>
      </nav>

      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Create News Article</h1>
        <LoginWidget />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-700/50 bg-red-900/20 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Title */}
        <div>
          <label htmlFor="title" className="mb-2 block text-sm font-medium text-gray-300">
            Article Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            placeholder="Enter a descriptive title for your news article"
            required
            disabled={loading}
          />
        </div>

        {/* Excerpt */}
        <div>
          <label htmlFor="excerpt" className="mb-2 block text-sm font-medium text-gray-300">
            Summary/Excerpt <span className="text-red-400">*</span>
          </label>
          <textarea
            id="excerpt"
            value={excerpt}
            onChange={e => setExcerpt(e.target.value)}
            className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            placeholder="Brief summary of the article (shown in the news list)"
            rows={3}
            required
            disabled={loading}
          />
        </div>

        {/* Icon Selector */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-300">Article Icon</label>
          <div className="flex flex-wrap gap-2">
            {ARTICLE_ICONS.map(iconOption => (
              <button
                key={iconOption.id}
                type="button"
                onClick={() => setSelectedIcon(iconOption.id)}
                disabled={loading}
                className={`flex items-center gap-2 rounded border px-3 py-2 text-sm transition-colors ${
                  selectedIcon === iconOption.id
                    ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                    : 'border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                } disabled:cursor-not-allowed disabled:opacity-50`}
                title={iconOption.label}
              >
                {iconOption.icon}
                <span className="hidden sm:inline">{iconOption.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Additional Tags and Featured Image Row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="additionalTags"
              className="mb-2 block text-sm font-medium text-gray-300"
            >
              Additional Tags
            </label>
            <input
              type="text"
              id="additionalTags"
              value={additionalTags}
              onChange={e => setAdditionalTags(e.target.value)}
              className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              placeholder="stellar, 3d, features (comma-separated)"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="featuredImage" className="mb-2 block text-sm font-medium text-gray-300">
              Featured Image URL
            </label>
            <input
              type="url"
              id="featuredImage"
              value={featuredImage}
              onChange={e => setFeaturedImage(e.target.value)}
              className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              placeholder="https://example.com/image.jpg (optional)"
              disabled={loading}
            />
          </div>
        </div>

        {/* Content Editor */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-300">
            Article Content <span className="text-red-400">*</span>
          </label>
          <UnifiedMarkdownEditor
            content={content}
            onChange={setContent}
            placeholder="Start writing your news article here..."
            features="full"
            minRows={18}
            disabled={loading}
          />
        </div>

        {/* Action buttons at bottom */}
        <div className="mt-6 flex justify-end space-x-3">
          <Link
            href="/news"
            className="rounded border border-gray-600 bg-gray-700 px-4 py-2 text-gray-300 transition-colors hover:bg-gray-600 hover:text-white"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={!canSubmit}
            className="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Publishing...
              </span>
            ) : (
              'Publish Article'
            )}
          </button>
        </div>

        {/* Help Text */}
        <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
          <h3 className="mb-2 font-medium text-white">Formatting Help</h3>
          <div className="space-y-1 text-sm text-gray-400">
            <p>
              <strong>Toolbar:</strong> Click buttons to add formatting
            </p>
            <p>
              <strong>Keyboard:</strong> Ctrl+B (bold), Ctrl+I (italic), Ctrl+K (link)
            </p>
            <p>
              <strong>Preview:</strong> Click "Preview" to see rendered content
            </p>
            <p>
              <strong>Mobile:</strong> Tap the formatting bar at the bottom
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
