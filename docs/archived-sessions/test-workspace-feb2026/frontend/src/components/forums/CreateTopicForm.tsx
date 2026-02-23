'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { UnifiedMarkdownEditor } from '@/components/editor/UnifiedMarkdownEditor';
import { LoginWidget } from '@/components/forums/LoginWidget';
import { fetchJSON } from '@/lib/utils/csrf';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { logger } from '@/lib/utils/logger';
import type { User } from '@/lib/auth/server';

interface ForumCategory {
  id: number;
  slug: string;
  name: string;
  description?: string;
  section: string;
  color: string;
}

interface ForumSection {
  id: string;
  display_name: string;
  sort_order: number;
}

interface CreateTopicFormProps {
  user: User;
}

export function CreateTopicForm({ user }: CreateTopicFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [sections, setSections] = useState<ForumSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load categories and sections on mount
  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetch('/api/forums/categories');
        const data = await response.json();

        if (data.success && data.data?.categories && Array.isArray(data.data.categories)) {
          setCategories(data.data.categories);

          // Also load sections for display names
          if (data.data?.sections && Array.isArray(data.data.sections)) {
            setSections(data.data.sections);
          }

          // Set category from URL if specified (can be ID or slug)
          const urlCategory = searchParams.get('category');
          if (urlCategory) {
            // Try parsing as ID first
            const parsedId = parseInt(urlCategory);
            if (!isNaN(parsedId)) {
              setCategoryId(parsedId);
            } else {
              // It's a slug, find the category by slug
              const category = data.data.categories.find(
                (cat: ForumCategory) => cat.slug === urlCategory
              );
              if (category) {
                setCategoryId(category.id);
              }
            }
          } else if (data.data.categories.length > 0) {
            // Auto-select first category if no URL parameter
            setCategoryId(data.data.categories[0].id);
          }
        }
      } catch (error) {
        logger.error('Error loading categories:', error);
        setError('Failed to load categories');
      }
    }

    loadCategories();
  }, [searchParams]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    if (!content.trim()) {
      setError('Please enter content');
      return;
    }

    if (!categoryId) {
      setError('Please select a category');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await fetchJSON<{
        success: boolean;
        data?: { topic: { id: number } };
        error?: string;
      }>('/api/forums/topics', {
        method: 'POST',
        body: {
          title: title.trim(),
          content: content.trim(),
          category_id: categoryId,
        },
      });

      if (data.success && data.data?.topic) {
        // Redirect to the new topic
        router.push(`/forums/topic/${data.data.topic.id}`);
      } else {
        setError(data.error || 'Failed to create topic');
      }
    } catch (error) {
      logger.error('Create topic error:', error);
      setError(
        error instanceof Error ? error.message : 'An error occurred while creating your topic'
      );
    } finally {
      setLoading(false);
    }
  };

  // Sort sections by sort_order for proper grouping
  const sortedSections = [...sections].sort((a, b) => a.sort_order - b.sort_order);

  // Group categories by section, ordered by section sort_order
  const groupedCategories = sortedSections
    .map(section => ({
      section,
      categories: categories.filter(cat => cat.section === section.id),
    }))
    .filter(group => group.categories.length > 0);

  const canSubmit = title.trim() && content.trim() && categoryId && !loading;

  return (
    <div className="mx-auto max-w-5xl px-8 py-6">
      {/* Breadcrumb navigation */}
      <nav className="mb-4 text-sm text-gray-400" aria-label="Breadcrumb">
        <ol className="flex items-center">
          <li>
            <Link href="/forums" className="transition-colors hover:text-blue-400">
              Forums
            </Link>
          </li>
          <li>
            <span className="mx-2">›</span>
          </li>
          <li>
            <span className="text-gray-300">Create Topic</span>
          </li>
        </ol>
      </nav>

      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Create New Topic</h1>
        <LoginWidget />
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-700/50 bg-red-900/20 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Category Select */}
        <div>
          <label htmlFor="category" className="mb-2 block text-sm font-medium text-gray-300">
            Category
          </label>
          <select
            id="category"
            value={categoryId || ''}
            onChange={e => setCategoryId(parseInt(e.target.value))}
            className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
            required
            disabled={loading}
          >
            <option value="">Select a category...</option>
            {groupedCategories.map(({ section, categories: cats }) => (
              <optgroup key={section.id} label={section.display_name}>
                {cats.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Title Input */}
        <div>
          <label htmlFor="title" className="mb-2 block text-sm font-medium text-gray-300">
            Title
          </label>
          <input
            type="text"
            id="title"
            data-testid="topic-title-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Enter a descriptive title for your topic..."
            className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            required
            maxLength={200}
            disabled={loading}
          />
          <p className="mt-1 text-xs text-gray-500">{title.length}/200 characters</p>
        </div>

        {/* Content Editor */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-300">Content</label>
          <UnifiedMarkdownEditor
            content={content}
            onChange={setContent}
            placeholder="Write your topic content here... Markdown is supported."
            features="simple"
            minRows={12}
            disabled={loading}
          />
        </div>

        {/* Action buttons at bottom */}
        <div className="mt-6 flex justify-end space-x-3">
          <Link
            href="/forums"
            className="rounded border border-gray-600 bg-gray-700 px-4 py-2 text-gray-300 transition-colors hover:bg-gray-600 hover:text-white"
          >
            Cancel
          </Link>
          <button
            type="button"
            data-testid="create-topic-submit"
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
              'Create Topic'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
