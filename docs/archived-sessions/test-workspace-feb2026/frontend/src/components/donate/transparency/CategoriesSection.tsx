'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { fetchJSON } from '@/lib/utils/csrf';
import type { ExpenseCategory } from '@/lib/donations/types';
import { exportCategories } from '@/lib/utils/csv-export';
import { logger } from '@/lib/utils/logger';

export const CategoriesSection = forwardRef(function CategoriesSection(_props, ref) {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/expenses/categories');
      const result = await response.json();

      if (result.success) {
        setCategories(result.data || []);
      } else {
        const errorMsg =
          typeof result.error === 'string'
            ? result.error
            : result.error?.message || 'Failed to load categories';
        setError(errorMsg);
      }
    } catch (err) {
      setError('Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(data: Partial<ExpenseCategory>) {
    try {
      const result = await fetchJSON('/api/admin/expenses/categories', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (result.success) {
        setCreatingNew(false);
        await fetchCategories();
      } else {
        const errorMsg =
          typeof result.error === 'string'
            ? result.error
            : result.error?.message || 'Failed to create category';
        alert(errorMsg);
      }
    } catch (err: any) {
      logger.error('Error creating category:', err);
      alert(err.message || 'Failed to create category');
    }
  }

  async function handleUpdate(categoryId: number, data: Partial<ExpenseCategory>) {
    try {
      const result = await fetchJSON(`/api/admin/expenses/categories/${categoryId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      if (result.success) {
        setEditingId(null);
        await fetchCategories();
      } else {
        const errorMsg =
          typeof result.error === 'string'
            ? result.error
            : result.error?.message || 'Failed to update category';
        alert(errorMsg);
      }
    } catch (err: any) {
      logger.error('Error updating category:', err);
      alert(err.message || 'Failed to update category');
    }
  }

  async function handleDelete(categoryId: number) {
    if (
      !confirm('Are you sure you want to delete this category? This may affect existing expenses.')
    ) {
      return;
    }

    try {
      const result = await fetchJSON(`/api/admin/expenses/categories/${categoryId}`, {
        method: 'DELETE',
      });

      if (result.success) {
        await fetchCategories();
      } else {
        const errorMsg =
          typeof result.error === 'string'
            ? result.error
            : result.error?.message || 'Failed to delete category';
        alert(errorMsg);
      }
    } catch (err: any) {
      logger.error('Error deleting category:', err);
      alert(err.message || 'Failed to delete category');
    }
  }

  async function handleExport() {
    await exportCategories();
  }

  useImperativeHandle(ref, () => ({
    handleExport,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse text-neutral-400">Loading categories...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-700 bg-red-900/30 p-4 text-red-300">{error}</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create Button */}
      <button
        onClick={() => setCreatingNew(true)}
        disabled={creatingNew}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-neutral-700 disabled:text-neutral-400"
      >
        + Create Category
      </button>

      {/* Categories Table */}
      <div className="overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full">
          <thead className="bg-neutral-900">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-300">Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-300">Slug</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-300">
                Description
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-300">Color</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-300">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800 bg-neutral-900/50">
            {/* Inline Create Form */}
            {creatingNew && (
              <CategoryForm
                mode="create"
                onSave={handleCreate}
                onCancel={() => setCreatingNew(false)}
              />
            )}

            {/* Category Rows */}
            {categories.length === 0 && !creatingNew ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                  No categories yet. Create one to get started.
                </td>
              </tr>
            ) : (
              categories.map(category =>
                editingId === category.id ? (
                  <CategoryForm
                    key={category.id}
                    mode="edit"
                    category={category}
                    onSave={data => handleUpdate(category.id, data)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <CategoryRow
                    key={category.id}
                    category={category}
                    onClick={() => setEditingId(category.id)}
                    onDelete={() => handleDelete(category.id)}
                  />
                )
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

interface CategoryFormProps {
  mode: 'create' | 'edit';
  category?: ExpenseCategory;
  onSave: (data: Partial<ExpenseCategory>) => Promise<void>;
  onCancel: () => void;
}

function CategoryForm({ mode, category, onSave, onCancel }: CategoryFormProps) {
  const [name, setName] = useState(category?.name || '');
  const [slug, setSlug] = useState(category?.slug || '');
  const [description, setDescription] = useState(category?.description || '');
  const [color, setColor] = useState(category?.color || '#3b82f6');
  const [icon, setIcon] = useState(category?.icon || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave({ name, slug, description, color, icon, is_active: true });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <tr className="bg-neutral-800/50">
      <td colSpan={6}>
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-400">Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-400">Slug *</label>
              <input
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                required
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-400">Color</label>
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-400">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-neutral-700 disabled:text-neutral-400"
            >
              {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="rounded border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800 disabled:text-neutral-500"
            >
              Cancel
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

interface CategoryRowProps {
  category: ExpenseCategory;
  onClick: () => void;
  onDelete: () => void;
}

function CategoryRow({ category, onClick, onDelete }: CategoryRowProps) {
  return (
    <tr
      className="cursor-pointer transition-colors hover:bg-neutral-800/30"
      onClick={onClick}
      title="Click to edit"
    >
      <td className="px-4 py-3 text-sm text-white">{category.name}</td>
      <td className="px-4 py-3 text-sm text-neutral-400">{category.slug}</td>
      <td className="px-4 py-3 text-sm text-neutral-400">{category.description || '-'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className="h-4 w-4 rounded"
            style={{ backgroundColor: category.color || '#3b82f6' }}
          />
          <span className="text-xs text-neutral-400">{category.color}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
            category.is_active
              ? 'bg-green-900/30 text-green-400'
              : 'bg-neutral-800 text-neutral-400'
          }`}
        >
          {category.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={e => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded border border-neutral-700 px-3 py-1 text-xs text-red-400 transition-colors hover:border-red-600 hover:bg-red-900/20"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}
