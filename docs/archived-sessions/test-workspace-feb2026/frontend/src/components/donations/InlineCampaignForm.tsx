'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { FundingGoal } from '@/lib/donations/types';

const campaignFormSchema = z.object({
  project_id: z.number().int().positive().optional().nullable(),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required'),
  target_amount: z.number().positive('Target amount must be positive'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
    .optional()
    .nullable(),
  is_recurring: z.boolean().default(false),
  recurrence_period: z.enum(['monthly', 'quarterly', 'yearly']).optional().nullable(),
});

type CampaignFormData = z.infer<typeof campaignFormSchema>;

interface InlineCampaignFormProps {
  mode: 'create' | 'edit';
  campaign?: FundingGoal;
  onSave: (data: CampaignFormData) => Promise<void>;
  onCancel: () => void;
}

export function InlineCampaignForm({ mode, campaign, onSave, onCancel }: InlineCampaignFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: campaign
      ? {
          project_id: campaign.project_id,
          title: campaign.title,
          description: campaign.description,
          target_amount: campaign.target_amount,
          start_date: campaign.start_date,
          end_date: campaign.end_date,
          is_recurring: campaign.is_recurring,
          recurrence_period: campaign.recurrence_period,
        }
      : {
          title: '',
          description: '',
          target_amount: 0,
          start_date: new Date().toISOString().split('T')[0],
          end_date: null,
          is_recurring: false,
          recurrence_period: null,
          project_id: null,
        },
  });

  const isRecurring = watch('is_recurring');

  return (
    <tr className="bg-neutral-800/50">
      <td colSpan={99}>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Title */}
            <div>
              <label htmlFor="title" className="mb-1 block text-sm font-medium text-neutral-400">
                Title *
              </label>
              <input
                id="title"
                type="text"
                {...register('title')}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title.message}</p>}
            </div>

            {/* Target Amount */}
            <div>
              <label
                htmlFor="target_amount"
                className="mb-1 block text-sm font-medium text-neutral-400"
              >
                Target Amount (USD) *
              </label>
              <input
                id="target_amount"
                type="number"
                step="0.01"
                {...register('target_amount', { valueAsNumber: true })}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {errors.target_amount && (
                <p className="mt-1 text-xs text-red-400">{errors.target_amount.message}</p>
              )}
            </div>

            {/* Start Date */}
            <div>
              <label
                htmlFor="start_date"
                className="mb-1 block text-sm font-medium text-neutral-400"
              >
                Start Date *
              </label>
              <input
                id="start_date"
                type="date"
                {...register('start_date')}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {errors.start_date && (
                <p className="mt-1 text-xs text-red-400">{errors.start_date.message}</p>
              )}
            </div>

            {/* End Date */}
            <div>
              <label htmlFor="end_date" className="mb-1 block text-sm font-medium text-neutral-400">
                End Date (Optional)
              </label>
              <input
                id="end_date"
                type="date"
                {...register('end_date')}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {errors.end_date && (
                <p className="mt-1 text-xs text-red-400">{errors.end_date.message}</p>
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
                placeholder="Leave empty for general fund"
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
                <span>Recurring campaign</span>
              </label>

              {isRecurring && (
                <select
                  {...register('recurrence_period')}
                  className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select period...</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
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
              rows={3}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
