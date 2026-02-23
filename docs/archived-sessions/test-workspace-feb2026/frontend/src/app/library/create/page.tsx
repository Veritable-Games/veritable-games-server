'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { UnifiedMarkdownEditor } from '@/components/editor/UnifiedMarkdownEditor';
import { LoginWidget } from '@/components/shared/LoginWidget';
import { fetchJSON } from '@/lib/utils/csrf';
import { Loader2, ChevronLeft, ChevronRight, X, Plus, CheckCircle } from 'lucide-react';

export default function CreateLibraryDocumentPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  // Document metadata
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [publicationDate, setPublicationDate] = useState('');
  const [documentType, setDocumentType] = useState('book');
  const [description, setDescription] = useState('');
  const [abstract, setAbstract] = useState('');

  // Content and categorization
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'metadata' | 'content'>('metadata');

  // Predefined tag suggestions
  const tagSuggestions = {
    source: [
      'book',
      'manifesto',
      'technical-manual',
      'research-paper',
      'guide',
      'reference',
      'field-guide',
      'design-doc',
      'primary-source',
      'philosophical',
      'case-study',
    ],
    theme: [
      'anarchism',
      'mutual-aid',
      'prison-abolition',
      'game-design',
      'ai-ethics',
      'permaculture',
      'cooperative-economics',
      'community-organization',
      'environmental-justice',
      'critical-consciousness',
      'social-ecology',
      'machine-learning',
    ],
    method: [
      'empirical-study',
      'critical-theory',
      'case-study',
      'theoretical',
      'practical-guide',
      'systematic-review',
    ],
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSuggestedTag = (fullTag: string) => {
    if (!tags.includes(fullTag)) {
      setTags([...tags, fullTag]);
    } else {
      handleRemoveTag(fullTag);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    if (!title.trim()) {
      setError({ message: 'Document title is required' });
      setLoading(false);
      setActiveTab('metadata');
      return;
    }

    if (!content.trim()) {
      setError({ message: 'Document content is required' });
      setLoading(false);
      setActiveTab('content');
      return;
    }

    try {
      const requestData = {
        title: title.trim(),
        author: author.trim() || undefined,
        publication_date: publicationDate || undefined,
        document_type: documentType,
        description: description.trim() || undefined,
        abstract: abstract.trim() || undefined,
        content: content.trim(),
        tags: tags.length > 0 ? tags : undefined,
      };

      const data = await fetchJSON('/api/library/documents', {
        method: 'POST',
        body: requestData,
      });

      if (data.success) {
        setSuccess('Document created successfully! Redirecting...');
        setError(null);
        setTimeout(() => {
          if (data.data && data.data.slug) {
            router.push(`/library/${data.data.slug}`);
          } else {
            router.push('/library');
          }
        }, 1500);
      } else {
        setError({ message: data.error || 'Failed to create library document' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError({ message });
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
          <p className="text-red-400">You must be logged in to create library documents.</p>
        </div>
        <div className="flex gap-4">
          <Link
            href="/library"
            className="rounded-lg border border-gray-700 px-4 py-2 text-gray-300 hover:bg-gray-800"
          >
            Back to Library
          </Link>
          <Link
            href="/forums"
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  const canSubmit = title.trim() && content.trim() && !loading;

  return (
    <div className="mx-auto max-w-5xl px-8 py-6">
      {/* Breadcrumb navigation */}
      <nav className="mb-4 text-sm text-gray-400" aria-label="Breadcrumb">
        <ol className="flex items-center">
          <li>
            <Link href="/library" className="transition-colors hover:text-blue-400">
              Library
            </Link>
          </li>
          <li>
            <span className="mx-2">›</span>
          </li>
          <li>
            <span className="text-gray-300">Create Document</span>
          </li>
        </ol>
      </nav>

      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Create Library Document</h1>
        <LoginWidget />
      </div>

      {/* User info */}
      {user && (
        <p className="mb-4 text-xs text-gray-500">
          Uploading as: <span className="text-blue-400">{user.display_name || user.username}</span>
        </p>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-600/50 bg-green-900/20 p-3">
          <CheckCircle size={18} className="text-green-400" />
          <p className="text-sm text-green-400">{success}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-700/50 bg-red-900/20 p-3">
          <p className="text-sm text-red-400">{error.message}</p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="mb-6 flex gap-1 border-b border-gray-700">
        <button
          type="button"
          onClick={() => setActiveTab('metadata')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'metadata'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Document Information
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('content')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'content'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Content & Tags
        </button>
      </div>

      <div className="space-y-6">
        {/* Metadata Tab */}
        {activeTab === 'metadata' && (
          <div className="space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="mb-2 block text-sm font-medium text-gray-300">
                Document Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                placeholder="e.g., A Pattern Language"
                required
                disabled={loading}
              />
            </div>

            {/* Author */}
            <div>
              <label htmlFor="author" className="mb-2 block text-sm font-medium text-gray-300">
                Author(s) <span className="text-xs text-gray-500">(Optional)</span>
              </label>
              <input
                type="text"
                id="author"
                value={author}
                onChange={e => setAuthor(e.target.value)}
                className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                placeholder="e.g., Christopher Alexander"
                disabled={loading}
              />
            </div>

            {/* Publication Date and Type */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="pubDate" className="mb-2 block text-sm font-medium text-gray-300">
                  Publication Date <span className="text-xs text-gray-500">(Optional)</span>
                </label>
                <input
                  type="date"
                  id="pubDate"
                  value={publicationDate}
                  onChange={e => setPublicationDate(e.target.value)}
                  className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="docType" className="mb-2 block text-sm font-medium text-gray-300">
                  Document Type
                </label>
                <select
                  id="docType"
                  value={documentType}
                  onChange={e => setDocumentType(e.target.value)}
                  className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                  disabled={loading}
                >
                  <option value="book">Book</option>
                  <option value="article">Article</option>
                  <option value="manifesto">Manifesto</option>
                  <option value="manual">Manual</option>
                  <option value="research">Research Paper</option>
                  <option value="guide">Guide</option>
                  <option value="reference">Reference</option>
                  <option value="case-study">Case Study</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="mb-2 block text-sm font-medium text-gray-300">
                Description <span className="text-xs text-gray-500">(Optional)</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                placeholder="Brief description of the document"
                disabled={loading}
              />
            </div>

            {/* Abstract */}
            <div>
              <label htmlFor="abstract" className="mb-2 block text-sm font-medium text-gray-300">
                Abstract / Summary <span className="text-xs text-gray-500">(Optional)</span>
              </label>
              <textarea
                id="abstract"
                value={abstract}
                onChange={e => setAbstract(e.target.value)}
                rows={5}
                className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                placeholder="Summary or abstract of the document content"
                disabled={loading}
              />
            </div>
          </div>
        )}

        {/* Content & Tags Tab */}
        {activeTab === 'content' && (
          <div className="space-y-6">
            {/* Content Editor */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Document Content <span className="text-red-400">*</span>
              </label>
              <UnifiedMarkdownEditor
                content={content}
                onChange={setContent}
                placeholder="Write your document content here... (Markdown supported)"
                features="full"
                minRows={15}
                disabled={loading}
              />
              <p className="mt-2 text-xs text-gray-500">
                Use Markdown syntax. Wiki links: [[Page Name]], Library links: [[library:Document]]
              </p>
            </div>

            {/* Tags Section */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Tags</label>

              {/* Tag Input */}
              <div className="mb-3 flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyPress={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className="flex-1 rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                  placeholder="Add custom tag and press Enter"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  disabled={loading || !tagInput.trim()}
                  className="flex items-center gap-1 rounded border border-gray-600 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50"
                >
                  <Plus size={14} />
                  Add
                </button>
              </div>

              {/* Tag Suggestions */}
              <div className="mb-4 space-y-3">
                {Object.entries(tagSuggestions).map(([category, suggestions]) => (
                  <div key={category}>
                    <p className="mb-1.5 text-xs capitalize text-gray-500">{category} Type:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.map(tag => {
                        const fullTag = `${category}:${tag}`;
                        const isSelected = tags.includes(fullTag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleSuggestedTag(fullTag)}
                            className={`rounded px-2.5 py-1 text-xs transition-colors ${
                              isSelected
                                ? 'border border-blue-500/50 bg-blue-500/20 text-blue-300'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                            }`}
                            disabled={loading}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Selected Tags */}
              {tags.length > 0 && (
                <div>
                  <p className="mb-2 text-xs text-gray-500">Selected Tags:</p>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded border border-gray-700 bg-gray-800 px-2.5 py-1 text-sm text-gray-300"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="text-gray-500 hover:text-gray-300"
                          disabled={loading}
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between border-t border-gray-700 pt-4">
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'metadata' ? 'content' : 'metadata')}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-blue-400 disabled:opacity-50"
          >
            {activeTab === 'metadata' ? (
              <>
                Next: Content
                <ChevronRight size={16} />
              </>
            ) : (
              <>
                <ChevronLeft size={16} />
                Back: Information
              </>
            )}
          </button>

          <div className="flex space-x-3">
            <Link
              href="/library"
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
                'Create Document'
              )}
            </button>
          </div>
        </div>

        {/* Help Text */}
        <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
          <h3 className="mb-2 font-medium text-white">Library Document Guidelines</h3>
          <div className="space-y-1 text-sm text-gray-400">
            <p>
              <strong>Required:</strong> Document title and content are both required
            </p>
            <p>
              <strong>Metadata:</strong> Author, publication date, and descriptions are optional but
              helpful
            </p>
            <p>
              <strong>Tags:</strong> Use predefined tags or create custom ones for categorization
            </p>
            <p>
              <strong>Images:</strong> Use markdown syntax: ![alt text](image-url)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
