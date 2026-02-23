'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { fetchJSON } from '@/lib/utils/csrf';
import { useRouter } from 'next/navigation';
import type { Expense } from '@/lib/donations/types';
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

interface ExpenseFormProps {
  expense?: Expense;
  mode: 'create' | 'edit';
}

export default function ExpenseForm({ expense, mode }: ExpenseFormProps) {
  const router = useRouter();

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
          category_id: 1,
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

  const onSubmit = async (data: ExpenseFormData) => {
    try {
      const endpoint =
        mode === 'create' ? '/api/admin/expenses' : `/api/admin/expenses/${expense!.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const result = await fetchJSON(endpoint, {
        method,
        body: JSON.stringify(data),
      });

      if (result.success) {
        router.push('/admin/expenses');
      } else {
        alert(result.error || `Failed to ${mode} expense`);
      }
    } catch (err: any) {
      logger.error(`Error ${mode}ing expense:`, err);
      alert(err.message || `Failed to ${mode} expense`);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      {/* Category */}
      <div>
        <label htmlFor="category_id" className="mb-2 block text-neutral-300">
          Category *
        </label>
        <select
          id="category_id"
          {...register('category_id', { valueAsNumber: true })}
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-white focus:border-neutral-500 focus:outline-none"
        >
          <option value="1">Development</option>
          <option value="2">API Services</option>
          <option value="3">Assets</option>
          <option value="4">Infrastructure</option>
          <option value="5">Marketing</option>
        </select>
        {errors.category_id && (
          <p className="mt-1 text-sm text-red-400">{errors.category_id.message}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="mb-2 block text-neutral-300">
          Description *
        </label>
        <textarea
          id="description"
          {...register('description')}
          rows={3}
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-white focus:border-neutral-500 focus:outline-none"
          placeholder="Brief description of the expense"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-400">{errors.description.message}</p>
        )}
      </div>

      {/* Amount and Currency */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label htmlFor="amount" className="mb-2 block text-neutral-300">
            Amount *
          </label>
          <input
            id="amount"
            type="number"
            step="0.01"
            {...register('amount', { valueAsNumber: true })}
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-white focus:border-neutral-500 focus:outline-none"
          />
          {errors.amount && <p className="mt-1 text-sm text-red-400">{errors.amount.message}</p>}
        </div>

        <div>
          <label htmlFor="currency" className="mb-2 block text-neutral-300">
            Currency
          </label>
          <select
            id="currency"
            {...register('currency')}
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-white focus:border-neutral-500 focus:outline-none"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </div>
      </div>

      {/* Expense Date */}
      <div>
        <label htmlFor="expense_date" className="mb-2 block text-neutral-300">
          Expense Date *
        </label>
        <input
          id="expense_date"
          type="date"
          {...register('expense_date')}
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-white focus:border-neutral-500 focus:outline-none"
        />
        {errors.expense_date && (
          <p className="mt-1 text-sm text-red-400">{errors.expense_date.message}</p>
        )}
      </div>

      {/* Receipt URL */}
      <div>
        <label htmlFor="receipt_url" className="mb-2 block text-neutral-300">
          Receipt URL (Optional)
        </label>
        <input
          id="receipt_url"
          type="url"
          {...register('receipt_url')}
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-white focus:border-neutral-500 focus:outline-none"
          placeholder="https://example.com/receipt.pdf"
        />
        {errors.receipt_url && (
          <p className="mt-1 text-sm text-red-400">{errors.receipt_url.message}</p>
        )}
      </div>

      {/* Project ID */}
      <div>
        <label htmlFor="project_id" className="mb-2 block text-neutral-300">
          Project ID (Optional)
        </label>
        <input
          id="project_id"
          type="number"
          {...register('project_id', { valueAsNumber: true })}
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-white focus:border-neutral-500 focus:outline-none"
          placeholder="Leave empty for general expenses"
        />
        {errors.project_id && (
          <p className="mt-1 text-sm text-red-400">{errors.project_id.message}</p>
        )}
      </div>

      {/* Recurring */}
      <div>
        <label className="flex items-center gap-2 text-neutral-300">
          <input type="checkbox" {...register('is_recurring')} className="rounded" />
          <span>Recurring expense</span>
        </label>
      </div>

      {/* Recurrence Period */}
      {isRecurring && (
        <div>
          <label htmlFor="recurrence_period" className="mb-2 block text-neutral-300">
            Recurrence Period
          </label>
          <select
            id="recurrence_period"
            {...register('recurrence_period')}
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-white focus:border-neutral-500 focus:outline-none"
          >
            <option value="">Select period...</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          {errors.recurrence_period && (
            <p className="mt-1 text-sm text-red-400">{errors.recurrence_period.message}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-neutral-700 px-6 py-2 text-white transition-colors hover:bg-neutral-600 disabled:bg-neutral-800"
        >
          {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Expense' : 'Update Expense'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg bg-neutral-700 px-6 py-2 text-white transition-colors hover:bg-neutral-600"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
