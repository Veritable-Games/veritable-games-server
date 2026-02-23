'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { HybridMarkdownRenderer } from '@/components/ui/HybridMarkdownRenderer';
import InlineTagEditor from '@/components/wiki/InlineTagEditor';
import { useAuth } from '@/contexts/AuthContext';
import { fetchJSON } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';

// Note: Metadata is set via document.title in useEffect since this is a client component

interface NewsArticle {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author: string;
  published_at: string;
  featured_image?: string;
  tags?: Array<{
    id: number;
    name: string;
    color?: string;
  }>;
  views: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function NewsArticlePage() {
  const params = useParams();
  const router = useRouter();
  const slug = decodeURIComponent(params.slug as string);
  const { user } = useAuth();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editExcerpt, setEditExcerpt] = useState('');
  const [allTags, setAllTags] = useState<Array<{ id: number; name: string; color?: string }>>([]);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchArticle();
  }, [slug]);

  // Update document title when article loads
  useEffect(() => {
    if (article) {
      document.title = `${article.title} - News - Veritable Games`;
    }
  }, [article]);

  const fetchArticle = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/news/${encodeURIComponent(slug)}`);

      if (!response.ok) {
        if (response.status === 404) {
          router.push('/news');
          return;
        }
        throw new Error('Failed to fetch article');
      }

      const data = await response.json();
      if (data.success) {
        setArticle(data.data);
        setEditContent(data.data.content);
        setEditExcerpt(data.data.excerpt || '');

        // Fetch tags
        const tagsResponse = await fetch(`/api/news/${encodeURIComponent(slug)}/tags`);
        if (tagsResponse.ok) {
          const tagsData = await tagsResponse.json();
          if (tagsData.success) {
            setAllTags(tagsData.allTags || []);
            // Update article with proper tag objects
            if (tagsData.currentTags) {
              setArticle(prev => (prev ? { ...prev, tags: tagsData.currentTags } : null));
            }
          }
        }
      }
    } catch (err) {
      logger.error('Error fetching article:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!article || !isAdmin || !user) return;

    // Extract title from first markdown header (# Title)
    const titleMatch = editContent.match(/^#\s+(.+)$/m);
    const extractedTitle = titleMatch ? titleMatch[1]?.trim() : article.title || 'Untitled';

    // Get author from current user
    const authorName = user.username || user.email || 'Staff';

    setSaving(true);
    try {
      const data = await fetchJSON(`/api/news/${encodeURIComponent(slug)}`, {
        method: 'PUT',
        body: {
          title: extractedTitle,
          excerpt: editExcerpt,
          content: editContent,
          author: authorName,
        },
      });

      if (data.success) {
        await fetchArticle();
        setIsEditing(false);
      } else {
        alert(data.error || 'Failed to save article');
      }
    } catch (error) {
      logger.error('Error saving article:', error);
      alert('Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (article) {
      setEditContent(article.content);
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!article || !isAdmin) return;

    if (
      !confirm(`Are you sure you want to delete "${article.title}"? This action cannot be undone.`)
    ) {
      return;
    }

    try {
      const data = await fetchJSON(`/api/news/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
      });

      if (data.success) {
        router.push('/news');
      } else {
        alert(data.error || 'Failed to delete article');
      }
    } catch (error) {
      logger.error('Error deleting article:', error);
      alert('Failed to delete article');
    }
  };

  const handleTagsChange = async (
    updatedTags: Array<{ id: number; name: string; color?: string }>
  ) => {
    // Update article state with new tags
    setArticle(prev => (prev ? { ...prev, tags: updatedTags } : null));
  };

  if (loading) {
    return (
      <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden px-8 py-6">
        <div className="flex h-64 items-center justify-center">
          <div className="text-gray-400">Loading article...</div>
        </div>
      </div>
    );
  }

  if (!article) {
    return null;
  }

  const publishDate = new Date(article.published_at);
  const formattedDate = publishDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="mx-auto max-w-5xl px-8 py-6">
      {/* Back Link */}
      <div className="mb-4">
        <Link href="/news" className="text-sm text-blue-400 hover:text-blue-300 hover:underline">
          ← Back to News
        </Link>
      </div>

      {/* Content */}
      <div>
        {isEditing ? (
          /* Edit Mode */
          <>
            <div className="rounded border border-gray-700 bg-gray-900/70 p-6">
              <div className="mb-6">
                <MarkdownEditor
                  initialContent={editContent}
                  onChange={setEditContent}
                  height="600px"
                />
              </div>
            </div>

            {/* Footer below editor - outside content card */}
            <div className="mt-4 border-t border-gray-700 pt-6">
              <div className="flex items-center justify-between text-sm text-gray-400">
                <div>Created on {new Date(article.created_at).toLocaleDateString()}</div>
                <div className="flex items-center space-x-4">
                  {!saving && (
                    <button
                      onClick={handleCancel}
                      className="text-sm transition-colors hover:text-gray-300"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    className="text-sm transition-colors hover:text-blue-400"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* View Mode */
          <>
            <div className="rounded border border-gray-700 bg-gray-900/70 p-6">
              {/* Article Header */}
              <header className="mb-6">
                <h1 className="mb-4 text-3xl font-bold text-white">{article.title}</h1>

                <div className="mb-4 flex items-center gap-4 text-sm text-gray-400">
                  {article.author && <span>By {article.author}</span>}
                  {article.author && <span>•</span>}
                  <span>Created on {new Date(article.created_at).toLocaleDateString()}</span>
                </div>

                {/* Excerpt */}
                {article.excerpt && (
                  <div className="rounded border-l-4 border-blue-500 bg-gray-800/50 p-4">
                    <p className="italic text-gray-300">{article.excerpt}</p>
                  </div>
                )}
              </header>

              {/* Featured Image */}
              {article.featured_image && (
                <div className="mb-6 overflow-hidden rounded">
                  <img src={article.featured_image} alt={article.title} className="h-auto w-full" />
                </div>
              )}

              {/* Article Content */}
              <HybridMarkdownRenderer
                content={article.content.replace(/^#\s+.+$/m, '').trim()}
                className="prose prose-gray prose-invert max-w-none prose-headings:font-bold prose-headings:text-white prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:mb-4 prose-p:leading-relaxed prose-p:text-gray-300 prose-a:text-blue-400 prose-a:hover:text-blue-300 prose-blockquote:border-l-4 prose-blockquote:border-gray-600 prose-blockquote:pl-4 prose-blockquote:italic prose-strong:font-semibold prose-strong:text-white prose-code:rounded prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:text-blue-300 prose-pre:border prose-pre:border-gray-700 prose-pre:bg-gray-800 prose-ol:text-gray-300 prose-ul:text-gray-300 prose-li:text-gray-300"
              />
            </div>

            {/* Tag Editor - outside content card */}
            <InlineTagEditor
              pageSlug={slug}
              initialTags={article.tags || []}
              allTags={allTags}
              canEdit={isAdmin}
              onTagsChange={handleTagsChange}
              apiPrefix="/api/news"
            />

            {/* Footer - outside content card - admin only */}
            {isAdmin && (
              <div className="mt-4 border-t border-gray-700 pt-6">
                <div className="flex items-center justify-end text-sm text-gray-400">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-sm transition-colors hover:text-blue-400"
                    >
                      Edit Article
                    </button>
                    <button
                      onClick={handleDelete}
                      className="text-sm text-gray-300 transition-colors hover:text-red-400"
                    >
                      Delete Article
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
