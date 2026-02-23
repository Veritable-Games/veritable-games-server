'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect, useState } from 'react';
import type { Expense, ExpenseCategory } from '@/lib/donations/types';
import { logger } from '@/lib/utils/logger';

const expenseFormSchema = z.object({
  category_id: z.number().int().positive('Category is required'),
  project_id: z.number().int().positive().optional().nullable(),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('USD'),
  description: z.string().min(1, 'Description is required'),
  receipt_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  is_recurring: z.boolean().default(false),
  recurrence_period: z.enum(['monthly', 'yearly']).optional().nullable(),
});

type ExpenseFormData = z.infer<typeof expenseFormSchema>;

interface InlineExpenseFormProps {
  mode: 'create' | 'edit';
  expense?: Expense;
  onSave: (data: ExpenseFormData) => Promise<void>;
  onCancel: () => void;
}

export function InlineExpenseForm({ mode, expense, onSave, onCancel }: InlineExpenseFormProps) {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      const response = await fetch('/api/admin/expenses/categories');
      const result = await response.json();
      if (result.success) {
        setCategories(result.data || []);
      }
    } catch (err) {
      logger.error('Failed to fetch categories:', err);
    } finally {
      setLoadingCategories(false);
    }
  }

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: expense
      ? {
          category_id: expense.category_id,
          project_id: expense.project_id,
          amount: expense.amount,
          currency: expense.currency,
          description: expense.description,
          receipt_url: expense.receipt_url || '',
          expense_date: expense.expense_date,
          is_recurring: expense.is_recurring,
          recurrence_period: expense.recurrence_period,
        }
      : {
          category_id: categories[0]?.id || 1,
          project_id: null,
          amount: 0,
          currency: 'USD',
          description: '',
          receipt_url: '',
          expense_date: new Date().toISOString().split('T')[0],
          is_recurring: false,
          recurrence_period: null,
        },
  });

  const isRecurring = watch('is_recurring');

  if (loadingCategories) {
    return (
      <tr className="bg-neutral-800/50">
        <td colSpan={99} className="px-4 py-8 text-center text-neutral-400">
          Loading categories...
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-neutral-800/50">
      <td colSpan={99}>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4 p-4">
          <div className="grid grid-cols-3 gap-4">
            {/* Category */}
            <div>
              <label
                htmlFor="category_id"
                className="mb-1 block text-sm font-medium text-neutral-400"
              >
                Category *
              </label>
              <select
                id="category_id"
                {...register('category_id', { valueAsNumber: true })}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {errors.category_id && (
                <p className="mt-1 text-xs text-red-400">{errors.category_id.message}</p>
              )}
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="amount" className="mb-1 block text-sm font-medium text-neutral-400">
                Amount *
              </label>
              <input
                id="amount"
                type="number"
                step="0.01"
                {...register('amount', { valueAsNumber: true })}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {errors.amount && (
                <p className="mt-1 text-xs text-red-400">{errors.amount.message}</p>
              )}
            </div>

            {/* Currency */}
            <div>
              <label htmlFor="currency" className="mb-1 block text-sm font-medium text-neutral-400">
                Currency
              </label>
              <select
                id="currency"
                {...register('currency')}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>

            {/* Expense Date */}
            <div>
              <label
                htmlFor="expense_date"
                className="mb-1 block text-sm font-medium text-neutral-400"
              >
                Date *
              </label>
              <input
                id="expense_date"
                type="date"
                {...register('expense_date')}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {errors.expense_date && (
                <p className="mt-1 text-xs text-red-400">{errors.expense_date.message}</p>
              )}
            </div>

            {/* Receipt URL */}
            <div>
              <label
                htmlFor="receipt_url"
                className="mb-1 block text-sm font-medium text-neutral-400"
              >
                Receipt URL (Optional)
              </label>
              <input
                id="receipt_url"
                type="url"
                {...register('receipt_url')}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="https://..."
              />
              {errors.receipt_url && (
                <p className="mt-1 text-xs text-red-400">{errors.receipt_url.message}</p>
              )}
            </div>

            {/* Project ID */}
            <div>
              <label
                htmlFor="project_id"
                className="mb-1 block text-sm font-medium text-neutral-400"
              >
                Project ID (Optional)
              </label>
              <input
                id="project_id"
                type="number"
                {...register('project_id', { valueAsNumber: true })}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="General"
              />
              {errors.project_id && (
                <p className="mt-1 text-xs text-red-400">{errors.project_id.message}</p>
              )}
            </div>

            {/* Recurring Checkbox and Period */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-neutral-400">
                <input
                  type="checkbox"
                  {...register('is_recurring')}
                  className="rounded border-neutral-700"
                />
                <span>Recurring</span>
              </label>

              {isRecurring && (
                <select
                  {...register('recurrence_period')}
                  className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Period...</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              )}
              {errors.recurrence_period && (
                <p className="mt-1 text-xs text-red-400">{errors.recurrence_period.message}</p>
              )}
            </div>
          </div>

          {/* Description (full width) */}
          <div>
            <label
              htmlFor="description"
              className="mb-1 block text-sm font-medium text-neutral-400"
            >
              Description *
            </label>
            <textarea
              id="description"
              {...register('description')}
              rows={2}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Brief description of the expense"
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-400">{errors.description.message}</p>
            )}
          </div>

          {/* Actions */}
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
