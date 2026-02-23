'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJSON } from '@/lib/utils/csrf';

interface CreateDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateDocumentModal({ isOpen, onClose }: CreateDocumentModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    author: '',
    publication_date: '',
    document_type: 'article',
    description: '',
    abstract: '',
    content: '',
    tags: [] as string[],
  });

  const [tagInput, setTagInput] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // Validation
      if (!formData.content && !formData.abstract && !formData.description) {
        throw new Error('Content is required. Please provide content, abstract, or description.');
      }

      // Create the document using the library API
      const data = await fetchJSON('/api/library/documents', {
        method: 'POST',
        body: {
          title: formData.title,
          author: formData.author,
          publication_date: formData.publication_date,
          document_type: formData.document_type,
          description: formData.description,
          abstract: formData.abstract,
          content: formData.content || formData.abstract || formData.description,
          tags: formData.tags,
        },
      });

      if (!data.success) {
        throw new Error(data.error || 'Failed to create document');
      }

      // Navigate to the new document
      router.push(`/library/${data.data.slug}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create document');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()],
      });
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove),
    });
  };

  // Predefined tag suggestions
  const tagSuggestions = {
    source: ['manifesto', 'technical-manual', 'research-paper', 'guide', 'reference'],
    theme: ['anarchism', 'mutual-aid', 'prison-abolition', 'game-design', 'ai-ethics'],
    method: ['empirical-study', 'critical-theory', 'case-study', 'theoretical'],
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-gray-700 bg-gray-900">
        <div className="sticky top-0 border-b border-gray-700 bg-gray-900 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Create Library Document</h2>
            <button
              onClick={onClose}
              className="text-gray-400 transition-colors hover:text-gray-300"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && (
            <div className="rounded-lg border border-red-700 bg-red-900/20 p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium text-gray-300">
              Document Title *
            </label>
            <input
              type="text"
              id="title"
              required
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="e.g., The Anarchist Organizing Manual"
            />
          </div>

          {/* Author */}
          <div>
            <label htmlFor="author" className="mb-1 block text-sm font-medium text-gray-300">
              Author(s)
            </label>
            <input
              type="text"
              id="author"
              value={formData.author}
              onChange={e => setFormData({ ...formData, author: e.target.value })}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="e.g., Jane Doe, John Smith"
            />
          </div>

          {/* Publication Date and Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="publication_date"
                className="mb-1 block text-sm font-medium text-gray-300"
              >
                Publication Date
              </label>
              <input
                type="date"
                id="publication_date"
                value={formData.publication_date}
                onChange={e => setFormData({ ...formData, publication_date: e.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="document_type"
                className="mb-1 block text-sm font-medium text-gray-300"
              >
                Document Type
              </label>
              <select
                id="document_type"
                value={formData.document_type}
                onChange={e => setFormData({ ...formData, document_type: e.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="article">Article</option>
                <option value="manifesto">Manifesto</option>
                <option value="manual">Manual</option>
                <option value="research">Research Paper</option>
                <option value="guide">Guide</option>
                <option value="reference">Reference</option>
                <option value="fiction">Fiction</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-300">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Brief description of the document"
            />
          </div>

          {/* Abstract/Summary */}
          <div>
            <label htmlFor="abstract" className="mb-1 block text-sm font-medium text-gray-300">
              Abstract / Summary
            </label>
            <textarea
              id="abstract"
              value={formData.abstract}
              onChange={e => setFormData({ ...formData, abstract: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Summary or abstract of the document content"
            />
          </div>

          {/* Full Content */}
          <div>
            <label htmlFor="content" className="mb-1 block text-sm font-medium text-gray-300">
              Full Content (Markdown) <span className="text-red-400">*</span>
            </label>
            <textarea
              id="content"
              value={formData.content}
              onChange={e => setFormData({ ...formData, content: e.target.value })}
              rows={8}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 font-mono text-sm text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Full document content in Markdown format..."
            />
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="tags" className="mb-1 block text-sm font-medium text-gray-300">
              Tags
            </label>
            <div className="mb-2 flex gap-2">
              <input
                type="text"
                id="tags"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="Add a tag and press Enter"
              />
              <button
                type="button"
                onClick={addTag}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
              >
                Add
              </button>
            </div>

            {/* Tag suggestions */}
            <div className="mb-3 space-y-2">
              {Object.entries(tagSuggestions).map(([category, suggestions]) => (
                <div key={category}>
                  <p className="mb-1 text-xs text-gray-500">{category}:</p>
                  <div className="flex flex-wrap gap-1">
                    {suggestions.map(tag => {
                      const fullTag = `${category}:${tag}`;
                      const isSelected = formData.tags.includes(fullTag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() =>
                            isSelected
                              ? removeTag(fullTag)
                              : setFormData({ ...formData, tags: [...formData.tags, fullTag] })
                          }
                          className={`rounded px-2 py-1 text-xs transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Selected tags */}
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded bg-blue-900/30 px-2 py-1 text-sm text-blue-400"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-blue-500 hover:text-blue-300"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Submit buttons */}
          <div className="flex gap-3 border-t border-gray-700 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-gray-800 px-4 py-2 text-white transition-colors hover:bg-gray-700"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
