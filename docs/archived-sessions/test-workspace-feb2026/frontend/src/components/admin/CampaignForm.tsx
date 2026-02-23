'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { fetchJSON } from '@/lib/utils/csrf';
import { useRouter } from 'next/navigation';
import type { FundingGoal } from '@/lib/donations/types';
import { logger } from '@/lib/utils/logger';

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

interface CampaignFormProps {
  campaign?: FundingGoal;
  mode: 'create' | 'edit';
}

export default function CampaignForm({ campaign, mode }: CampaignFormProps) {
  const router = useRouter();

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

  const onSubmit = async (data: CampaignFormData) => {
    try {
      const endpoint =
        mode === 'create' ? '/api/admin/campaigns' : `/api/admin/campaigns/${campaign!.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const result = await fetchJSON(endpoint, {
        method,
        body: JSON.stringify(data),
      });

      if (result.success) {
        router.push('/admin/campaigns');
      } else {
        alert(result.error || `Failed to ${mode} campaign`);
      }
    } catch (err: any) {
      logger.error(`Error ${mode}ing campaign:`, err);
      alert(err.message || `Failed to ${mode} campaign`);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      {/* Title */}
      <div>
        <label htmlFor="title" className="mb-2 block text-neutral-300">
          Title *
        </label>
        <input
          id="title"
          type="text"
          {...register('title')}
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-white focus:border-neutral-500 focus:outline-none"
        />
        {errors.title && <p className="mt-1 text-sm text-red-400">{errors.title.message}</p>}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="mb-2 block text-neutral-300">
          Description *
        </label>
        <textarea
          id="description"
          {...register('description')}
          rows={4}
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-white focus:border-neutral-500 focus:outline-none"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-400">{errors.description.message}</p>
        )}
      </div>

      {/* Target Amount */}
      <div>
        <label htmlFor="target_amount" className="mb-2 block text-neutral-300">
          Target Amount (USD) *
        </label>
        <input
          id="target_amount"
          type="number"
          step="0.01"
          {...register('target_amount', { valueAsNumber: true })}
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-white focus:border-neutral-500 focus:outline-none"
        />
        {errors.target_amount && (
          <p className="mt-1 text-sm text-red-400">{errors.target_amount.message}</p>
        )}
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="start_date" className="mb-2 block text-neutral-300">
            Start Date *
          </label>
          <input
            id="start_date"
            type="date"
            {...register('start_date')}
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-white focus:border-neutral-500 focus:outline-none"
          />
          {errors.start_date && (
            <p className="mt-1 text-sm text-red-400">{errors.start_date.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="end_date" className="mb-2 block text-neutral-300">
            End Date (Optional)
          </label>
          <input
            id="end_date"
            type="date"
            {...register('end_date')}
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-white focus:border-neutral-500 focus:outline-none"
          />
          {errors.end_date && (
            <p className="mt-1 text-sm text-red-400">{errors.end_date.message}</p>
          )}
        </div>
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
          placeholder="Leave empty for general fund"
        />
        {errors.project_id && (
          <p className="mt-1 text-sm text-red-400">{errors.project_id.message}</p>
        )}
      </div>

      {/* Recurring */}
      <div>
        <label className="flex items-center gap-2 text-neutral-300">
          <input type="checkbox" {...register('is_recurring')} className="rounded" />
          <span>Recurring campaign</span>
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
            <option value="quarterly">Quarterly</option>
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
          {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Campaign' : 'Update Campaign'}
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
