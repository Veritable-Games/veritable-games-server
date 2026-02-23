'use client';

import { useState, useEffect } from 'react';
import { fetchJSON } from '@/lib/utils/csrf';
import type { FundingGoal } from '@/lib/donations/types';
import { InlineCampaignForm } from './InlineCampaignForm';
import { logger } from '@/lib/utils/logger';

interface CampaignsTableProps {
  initialCampaigns: FundingGoal[];
}

export function CampaignsTable({ initialCampaigns }: CampaignsTableProps) {
  const [campaigns, setCampaigns] = useState<FundingGoal[]>(initialCampaigns);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  async function fetchCampaigns() {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/campaigns');
      const result = await response.json();

      if (result.success) {
        setCampaigns(result.data || []);
      } else {
        setError(result.error || 'Failed to load campaigns');
      }
    } catch (err) {
      setError('Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(data: any) {
    try {
      const result = await fetchJSON('/api/admin/campaigns', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (result.success) {
        setCreatingNew(false);
        await fetchCampaigns();
      } else {
        alert(result.error || 'Failed to create campaign');
      }
    } catch (err: any) {
      logger.error('Error creating campaign:', err);
      alert(err.message || 'Failed to create campaign');
    }
  }

  async function handleUpdate(campaignId: number, data: any) {
    try {
      const result = await fetchJSON(`/api/admin/campaigns/${campaignId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      if (result.success) {
        setEditingId(null);
        await fetchCampaigns();
      } else {
        alert(result.error || 'Failed to update campaign');
      }
    } catch (err: any) {
      logger.error('Error updating campaign:', err);
      alert(err.message || 'Failed to update campaign');
    }
  }

  async function handleDelete(campaignId: number) {
    if (!confirm('Are you sure you want to delete this campaign?')) {
      return;
    }

    try {
      const result = await fetchJSON(`/api/admin/campaigns/${campaignId}`, {
        method: 'DELETE',
      });

      if (result.success) {
        await fetchCampaigns();
      } else {
        alert(result.error || 'Failed to delete campaign');
      }
    } catch (err: any) {
      logger.error('Error deleting campaign:', err);
      alert(err.message || 'Failed to delete campaign');
    }
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-700 bg-red-900/30 p-4 text-red-300">{error}</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setCreatingNew(true)}
          disabled={creatingNew || loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-400"
        >
          + Create Campaign
        </button>
      </div>

      {/* Campaigns Table */}
      <div className="overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full">
          <thead className="bg-neutral-800/50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-300">Title</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-300">Target</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-300">Raised</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-300">Start</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-300">End</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-300">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-300">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800 bg-neutral-900/30">
            {/* Inline Create Form */}
            {creatingNew && (
              <InlineCampaignForm
                mode="create"
                onSave={handleCreate}
                onCancel={() => setCreatingNew(false)}
              />
            )}

            {/* Campaign Rows */}
            {campaigns.length === 0 && !creatingNew ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-neutral-400">
                  No campaigns yet. Create one to get started.
                </td>
              </tr>
            ) : (
              campaigns.map(campaign =>
                editingId === campaign.id ? (
                  <InlineCampaignForm
                    key={campaign.id}
                    mode="edit"
                    campaign={campaign}
                    onSave={data => handleUpdate(campaign.id, data)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <CampaignRow
                    key={campaign.id}
                    campaign={campaign}
                    onClick={() => setEditingId(campaign.id)}
                    onDelete={() => handleDelete(campaign.id)}
                  />
                )
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface CampaignRowProps {
  campaign: FundingGoal;
  onClick: () => void;
  onDelete: () => void;
}

function CampaignRow({ campaign, onClick, onDelete }: CampaignRowProps) {
  const progress = campaign.target_amount
    ? (campaign.current_amount / campaign.target_amount) * 100
    : 0;

  return (
    <tr
      className="cursor-pointer transition-colors hover:bg-neutral-800/30"
      onClick={onClick}
      title="Click to edit"
    >
      <td className="px-6 py-4 text-sm text-white">{campaign.title}</td>
      <td className="px-6 py-4 text-sm text-neutral-400">${campaign.target_amount.toFixed(2)}</td>
      <td className="px-6 py-4">
        <div className="space-y-1">
          <div className="text-sm text-white">${campaign.current_amount.toFixed(2)}</div>
          <div className="h-1 w-20 overflow-hidden rounded-full bg-neutral-700">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="text-xs text-neutral-400">{progress.toFixed(1)}%</div>
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-neutral-400">
        {new Date(campaign.start_date).toLocaleDateString()}
      </td>
      <td className="px-6 py-4 text-sm text-neutral-400">
        {campaign.end_date ? new Date(campaign.end_date).toLocaleDateString() : 'No end date'}
      </td>
      <td className="px-6 py-4">
        <span
          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
            campaign.is_active
              ? 'bg-green-900/50 text-green-400'
              : 'bg-neutral-800 text-neutral-400'
          }`}
        >
          {campaign.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-6 py-4">
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
