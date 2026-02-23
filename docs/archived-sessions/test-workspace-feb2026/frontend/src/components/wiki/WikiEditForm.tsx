'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UnifiedMarkdownEditor } from '@/components/editor/UnifiedMarkdownEditor';
import { fetchJSON } from '@/lib/utils/csrf';

interface WikiEditFormProps {
  slug: string;
  initialData: {
    title: string;
    content: string;
    category: string;
    tags: string;
    summary: string;
  };
  categories: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  userId: number;
}

/**
 * WikiEditForm - Client component for wiki page editing
 * Handles form state and submission
 */
export function WikiEditForm({ slug, initialData, categories, userId }: WikiEditFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(initialData);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null); // Clear previous errors

    if (!formData.title.trim() || !formData.content.trim()) {
      setError('Title and content are required');
      return;
    }

    try {
      setSaving(true);

      // URL-encode the slug to handle namespace prefixes (e.g., "library/page-name" → "library%2Fpage-name")
      // This ensures it's treated as a single URL segment instead of two
      const encodedSlug = encodeURIComponent(slug);

      const data = await fetchJSON(`/api/wiki/pages/${encodedSlug}`, {
        method: 'PUT',
        body: {
          title: formData.title.trim(),
          content: formData.content.trim(),
          categories: formData.category ? [formData.category] : [],
          tags: formData.tags
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean),
          summary: formData.summary.trim() || 'Page updated',
          authorId: userId,
        },
      });

      if (data.success) {
        // AGGRESSIVE cache clearing
        if (typeof window !== 'undefined') {
          // Clear all client-side caches
          sessionStorage.clear();
          localStorage.removeItem('wiki-cache');

          // Clear service worker cache if present
          if ('caches' in window) {
            caches.keys().then(names => {
              names.forEach(name => {
                caches.delete(name);
              });
            });
          }
        }

        // Get the new slug from the API response (in case title changed)
        // CRITICAL: This must be the NEW slug from the updated page
        const newSlug = data.data?.slug;
        const namespace = data.data?.namespace;

        if (!newSlug || !namespace) {
          setError('Invalid response from server: missing slug or namespace');
          return;
        }

        // Build the correct path with namespace if needed
        const fullPath = namespace !== 'main' ? `${namespace}/${newSlug}` : newSlug;

        // URL-encode the ENTIRE path as a SINGLE segment
        // This is required because /wiki/[slug] matches ONE segment, not two
        // Example: "library/doom-bible" → "library%2Fdoom-bible"
        // Result: /wiki/library%2Fdoom-bible (one segment, auto-decoded by Next.js)
        const encodedPath = encodeURIComponent(fullPath);

        // Add a small delay to ensure API response is fully processed
        // and to prevent race conditions with Hot Refresh in development
        await new Promise(resolve => setTimeout(resolve, 500));

        // Force a full page reload to bypass ALL caches
        window.location.href = `/wiki/${encodedPath}`;
      } else {
        setError(data.error || 'Failed to save changes');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden px-6 py-4">
      {/* Header */}
      <div className="mb-4 flex-shrink-0">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Edit Wiki Page</h1>
            <nav className="mt-1 text-sm text-gray-400" aria-label="Breadcrumb">
              <ol className="inline-flex items-center">
                <li className="inline-flex items-center">
                  <Link href="/wiki" className="transition-colors hover:text-blue-400">
                    Wiki
                  </Link>
                </li>
                <li>
                  <span className="mx-2">›</span>
                </li>
                <li className="inline-flex items-center">
                  <Link
                    href={`/wiki/${encodeURIComponent(slug)}`}
                    className="transition-colors hover:text-blue-400"
                  >
                    {formData.title}
                  </Link>
                </li>
                <li>
                  <span className="mx-2">›</span>
                </li>
                <li className="inline-flex items-center">
                  <span className="text-white">Edit</span>
                </li>
              </ol>
            </nav>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 rounded border border-red-500/50 bg-red-900/20 px-4 py-3">
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-400">Failed to save changes</p>
                  <p className="mt-1 text-sm text-red-300">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-400 transition-colors hover:text-red-300"
                  aria-label="Dismiss error"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div className="flex space-x-2">
            <Link
              href={`/wiki/${encodeURIComponent(slug)}`}
              className="flex h-8 items-center rounded border border-gray-600/40 bg-gray-800/40 px-3 text-sm text-gray-300 transition-colors hover:border-gray-500/60 hover:bg-gray-700/60 hover:text-white"
            >
              Cancel
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex h-8 items-center rounded border border-blue-500/50 bg-gray-800/40 px-3 text-sm text-blue-400 transition-colors hover:border-blue-400/70 hover:bg-gray-700/60 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto pr-4">
        <div className="space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="mb-2 block text-sm font-medium text-gray-300">
              Page Title
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              placeholder="Enter page title..."
            />
          </div>

          {/* Category and Tags */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="category" className="mb-2 block text-sm font-medium text-gray-300">
                Category
              </label>
              <select
                id="category"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select a category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tags" className="mb-2 block text-sm font-medium text-gray-300">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                id="tags"
                value={formData.tags}
                onChange={e => setFormData({ ...formData, tags: e.target.value })}
                className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                placeholder="tag1, tag2, tag3"
              />
            </div>
          </div>

          {/* Edit Summary */}
          <div>
            <label htmlFor="summary" className="mb-2 block text-sm font-medium text-gray-300">
              Edit Summary
            </label>
            <input
              type="text"
              id="summary"
              value={formData.summary}
              onChange={e => setFormData({ ...formData, summary: e.target.value })}
              className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              placeholder="Briefly describe your changes..."
            />
          </div>

          {/* Content Editor */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Page Content</label>
            <UnifiedMarkdownEditor
              content={formData.content}
              onChange={value => setFormData({ ...formData, content: value })}
              placeholder="Enter your wiki content using Markdown..."
              features="full"
              minRows={15}
              onSave={handleSave}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
