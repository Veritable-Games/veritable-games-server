'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { UnifiedMarkdownEditor } from '@/components/editor/UnifiedMarkdownEditor';
import { useAuth } from '@/contexts/AuthContext';
import { BackButton, CancelButton, SaveButton } from '@/components/ui/Button';
import { fetchJSON } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';

interface LibraryDocument {
  id: number;
  title: string;
  slug: string;
  content: string;
  content_format: string;
  namespace: string;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: number;
  username?: string;
  display_name?: string;
  categories?: string[];
  tags?: string[];
  total_views?: number;
  document_author?: string;
  publication_date?: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
}

export default function LibraryEditPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const fullSlug = `library/${slug}`;
  const { user, isAuthenticated, canEditWiki, loading: authLoading } = useAuth();
  const [document, setDocument] = useState<LibraryDocument | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<any>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'library', // Default to library category
    tags: '',
    summary: '',
    document_author: '',
    publication_date: '',
  });

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        // Fetch document using library endpoint and categories in parallel
        const [documentResponse, categoriesResponse] = await Promise.all([
          fetch(`/api/library/documents/${encodeURIComponent(slug)}`),
          fetch('/api/wiki/categories'),
        ]);

        if (!documentResponse.ok) {
          if (documentResponse.status === 404) {
            setError('Library document not found');
          } else {
            setError('Failed to load library document');
          }
          return;
        }

        const documentData = await documentResponse.json();
        const categoriesData = await categoriesResponse.json();

        setDocument(documentData);
        setFormData({
          title: documentData.title,
          content: documentData.content,
          category: 'library', // Always library for these pages
          tags: documentData.tags?.map((tag: any) => tag.name).join(', ') || '',
          summary: '',
          document_author: documentData.document_author || '',
          publication_date: documentData.publication_date || '',
        });

        if (categoriesData.success) {
          setCategories(categoriesData.data);
        }
      } catch (err) {
        logger.error('Error fetching data:', err);
        setError('Failed to load page data');
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchData();
    }
  }, [slug, fullSlug]);

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      setError('Title and content are required');
      return;
    }

    // CSRF protection has been removed

    try {
      setSaving(true);
      setError(null);

      const data = await fetchJSON(`/api/library/documents/${encodeURIComponent(slug)}`, {
        method: 'PUT',
        body: {
          title: formData.title.trim(),
          content: formData.content.trim(),
          category: 'library', // Always library
          tags: formData.tags
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean),
          summary: formData.summary.trim() || 'Library document updated',
          authorId: user?.id || null,
          document_author: formData.document_author.trim(),
          publication_date: formData.publication_date,
        },
      });

      if (data.success) {
        // Stay on edit page and show success message
        setError(null);
        setSuccess('Document saved successfully!');
        setFormData(prev => ({ ...prev, summary: '' })); // Clear edit summary

        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || data || 'Failed to save document');
      }
    } catch (err: any) {
      logger.error('Save error:', err);
      setError({
        error: 'Failed to save document',
        message: err.message || 'An unexpected error occurred while saving',
        debug: { fetchError: err.message, stack: err.stack },
      });
    } finally {
      setSaving(false);
    }
  };

  // Check permissions
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/forums');
    } else if (!authLoading && document && !canEditWiki() && user?.id !== document.created_by) {
      setError('You do not have permission to edit this library document');
    }
  }, [authLoading, isAuthenticated, document, canEditWiki, user, router]);

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <div className="text-gray-400">Loading library document editor...</div>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-8">
            <div className="text-center">
              <div className="mb-4 rounded-lg border border-red-600/50 bg-red-900/20 p-4">
                <p className="text-red-400">
                  {typeof error === 'object'
                    ? error.message || 'Error loading library document'
                    : error || 'Library document not found'}
                </p>
              </div>
              <BackButton href={`/library/${slug}`}>← Back to Document</BackButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Permission check
  if (!canEditWiki() && user?.id !== document.created_by) {
    return (
      <div className="min-h-screen">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-8 text-center">
            <div className="mb-4 text-gray-300">
              You do not have permission to edit this library document
            </div>
            <BackButton href={`/library/${slug}`}>← Back to Document</BackButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col px-6 py-6">
        {/* Breadcrumb */}
        <nav className="mb-4 text-sm text-gray-400" aria-label="Breadcrumb navigation">
          <ol className="flex items-center">
            <li>
              <Link href="/library" className="transition-colors hover:text-blue-400">
                Library
              </Link>
            </li>
            <li>
              <span className="mx-2 text-gray-500">›</span>
              <Link href={`/library/${slug}`} className="transition-colors hover:text-blue-400">
                {document.title}
              </Link>
            </li>
            <li>
              <span className="mx-2 text-gray-500">›</span>
              <span className="text-gray-200">Edit</span>
            </li>
          </ol>
        </nav>

        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Edit Library Document</h1>
          <div className="flex items-center space-x-3">
            <Link
              href={`/library/${slug}`}
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

        {/* Success Display */}
        {success && (
          <div className="mb-4">
            <div className="rounded-lg border border-green-700 bg-green-900/20 px-4 py-3 text-green-400">
              {success}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4">
            <div className="rounded-lg border border-red-700 bg-red-900/20 px-4 py-3 text-red-400">
              {typeof error === 'object' ? error.message || 'Save error occurred' : error}
            </div>
          </div>
        )}

        {/* CSRF protection has been removed */}

        {/* Title Field with blue accent */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-300">Document Title</label>
          <input
            type="text"
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
            className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Enter document title..."
          />
        </div>

        {/* Metadata Fields */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Document Author</label>
            <input
              type="text"
              value={formData.document_author}
              onChange={e => setFormData({ ...formData, document_author: e.target.value })}
              className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Original author (e.g., Christopher Alexander)"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Publication Date</label>
            <input
              type="date"
              value={formData.publication_date}
              onChange={e => setFormData({ ...formData, publication_date: e.target.value })}
              className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Tags Field */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-300">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={formData.tags}
            onChange={e => setFormData({ ...formData, tags: e.target.value })}
            className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="architecture, urban planning, design patterns..."
          />
        </div>

        {/* Edit Summary */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-300">
            Edit Summary (optional)
          </label>
          <input
            type="text"
            value={formData.summary}
            onChange={e => setFormData({ ...formData, summary: e.target.value })}
            className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Brief description of changes..."
          />
        </div>

        {/* Content Editor */}
        <div className="flex flex-1 flex-col">
          <label className="mb-2 block text-sm font-medium text-gray-300">Document Content</label>
          <UnifiedMarkdownEditor
            key={`editor-${document?.id || 'new'}`}
            content={formData.content}
            onChange={value => setFormData({ ...formData, content: value })}
            placeholder="Enter document content in Markdown format..."
            features="full"
            minRows={20}
            onSave={handleSave}
          />
        </div>
      </div>
    </div>
  );
}
