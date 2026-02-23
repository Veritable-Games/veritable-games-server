'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UnifiedMarkdownEditor } from '@/components/editor/UnifiedMarkdownEditor';
import { LoginWidget } from '@/components/shared/LoginWidget';
import { fetchJSON } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';
import { Loader2 } from 'lucide-react';

interface WikiCreateFormProps {
  categories: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  userId: number;
  username: string;
}

/**
 * WikiCreateForm - Client component for creating new wiki pages
 * Handles form state and submission
 */
export function WikiCreateForm({ categories, userId, username }: WikiCreateFormProps) {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    // Client-side validation
    if (!title.trim()) {
      setError('Page title is required');
      setLoading(false);
      return;
    }

    if (!content.trim()) {
      setError('Page content is required');
      setLoading(false);
      return;
    }

    // Validate category if provided
    if (category && !categories.find(cat => cat.id === category)) {
      setError('Selected category is invalid. Please choose a valid category or leave it empty.');
      setLoading(false);
      return;
    }

    try {
      const data = await fetchJSON('/api/wiki/pages', {
        method: 'POST',
        body: {
          title: title.trim(),
          content: content.trim(),
          author: userId,
          category: category || null,
          tags: tags
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0),
        },
      });

      if (data.success) {
        // Redirect to the created page
        router.push(`/wiki/${data.data.slug}`);
        router.refresh();
      } else {
        setError(data.error || 'Failed to create wiki page');
      }
    } catch (err) {
      logger.error('Error creating wiki page', { error: err });
      setError('Failed to create wiki page');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = title.trim() && content.trim() && !loading;

  return (
    <div className="mx-auto max-w-5xl px-8 py-6">
      {/* Breadcrumb navigation */}
      <nav className="mb-4 text-sm text-gray-400" aria-label="Breadcrumb">
        <ol className="flex items-center">
          <li>
            <Link href="/wiki" className="transition-colors hover:text-blue-400">
              Wiki
            </Link>
          </li>
          <li>
            <span className="mx-2">›</span>
          </li>
          <li>
            <span className="text-gray-300">Create Page</span>
          </li>
        </ol>
      </nav>

      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Create Wiki Page</h1>
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
            Page Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            placeholder="Enter a descriptive title for your wiki page"
            required
            disabled={loading}
          />
        </div>

        {/* Category and Tags Row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="category" className="mb-2 block text-sm font-medium text-gray-300">
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              disabled={loading}
            >
              <option value="">Select a category (optional)</option>
              {Array.isArray(categories) &&
                categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label htmlFor="tags" className="mb-2 block text-sm font-medium text-gray-300">
              Tags
            </label>
            <input
              type="text"
              id="tags"
              value={tags}
              onChange={e => setTags(e.target.value)}
              className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              placeholder="game, strategy, tips (comma-separated)"
              disabled={loading}
            />
          </div>
        </div>

        {/* Content Editor */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-300">
            Page Content <span className="text-red-400">*</span>
          </label>
          <UnifiedMarkdownEditor
            content={content}
            onChange={setContent}
            placeholder="# Start writing your wiki page here..."
            features="full"
            minRows={15}
            disabled={loading}
          />
          <p className="mt-2 text-xs text-gray-500">
            Use Markdown syntax for formatting. Wiki links: [[Page Name]], Library links:
            [[library:Document]]
          </p>
        </div>

        {/* Action buttons at bottom */}
        <div className="mt-6 flex justify-end space-x-3">
          <Link
            href="/wiki"
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
                Creating...
              </span>
            ) : (
              'Create Page'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
