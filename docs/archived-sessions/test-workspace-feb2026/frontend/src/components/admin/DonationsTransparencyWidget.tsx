'use client';

/**
 * Donations Transparency Widget for Admin
 * Displays donation campaigns, expenses, and transparency data for admin assessment
 *
 * NOTE: This component shows "Edit" buttons for campaigns and expenses, but the
 * corresponding edit pages do not yet exist. See plan documentation for details.
 */

import { useState, useEffect } from 'react';

interface Campaign {
  id: number;
  name: string;
  description: string;
  goal_amount: number;
  raised_amount: number;
  start_date: string;
  end_date: string | null;
  status: string;
}

interface Expense {
  id: number;
  category: string;
  amount: number;
  description: string;
  date: string;
  status: string;
}

interface TransparencyData {
  campaigns: Campaign[];
  expenses: Expense[];
  totalRaised: number;
  totalAllocated: number;
  totalExpenses: number;
}

export default function DonationsTransparencyWidget() {
  const [data, setData] = useState<TransparencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTransparencyData();
  }, []);

  async function fetchTransparencyData() {
    try {
      setLoading(true);
      const response = await fetch('/api/donations/transparency');
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to load transparency data');
      }
    } catch (err) {
      setError('Failed to fetch transparency data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-gray-400">Loading transparency data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-700 bg-red-900/30 p-6 text-red-300">{error}</div>
    );
  }

  if (!data) {
    return null;
  }

  const activeCampaigns = data.campaigns.filter(c => c.status === 'active');
  const avgProgress =
    activeCampaigns.length > 0
      ? activeCampaigns.reduce((acc, c) => acc + (c.raised_amount / c.goal_amount) * 100, 0) /
        activeCampaigns.length
      : 0;

  return (
    <div className="space-y-8">
      {/* Admin Assessment Notice */}
      <div className="rounded-lg border border-yellow-700 bg-yellow-900/30 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <svg
              className="h-6 w-6 text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="mb-2 text-lg font-semibold text-yellow-300">
              Assessment Notice: Edit Functionality Missing
            </h3>
            <p className="mb-4 text-sm text-yellow-200">
              This widget displays transparency data for admin review. While "Edit" buttons are
              shown for campaigns and expenses, the corresponding edit pages do not currently exist.
            </p>
            <div className="rounded bg-yellow-900/50 p-3 text-xs text-yellow-100">
              <p className="mb-2 font-semibold">What's Missing:</p>
              <ul className="list-inside list-disc space-y-1">
                <li>
                  <code>/admin/campaigns/[id]/edit</code> page (API exists, UI missing)
                </li>
                <li>
                  <code>/admin/expenses/[id]/edit</code> page (API exists, UI missing)
                </li>
              </ul>
              <p className="mt-3 text-yellow-200">
                Estimated 2-3 hours to implement both edit pages. See plan documentation for
                details.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total Raised" value={`$${data.totalRaised.toFixed(2)}`} icon="dollar" />
        <StatCard
          title="Active Campaigns"
          value={activeCampaigns.length.toString()}
          icon="target"
        />
        <StatCard title="Avg Progress" value={`${avgProgress.toFixed(1)}%`} icon="chart" />
      </div>

      {/* Active Campaigns */}
      <section>
        <h2 className="mb-4 text-xl font-semibold text-white">Active Campaigns</h2>
        {activeCampaigns.length === 0 ? (
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-6 text-center text-gray-400">
            No active campaigns
          </div>
        ) : (
          <div className="space-y-4">
            {activeCampaigns.map(campaign => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </section>

      {/* Monthly Expenses */}
      <section>
        <h2 className="mb-4 text-xl font-semibold text-white">Recent Expenses</h2>
        {data.expenses.length === 0 ? (
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-6 text-center text-gray-400">
            No expenses recorded
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-700">
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700 bg-gray-800/50">
                {data.expenses.slice(0, 10).map(expense => (
                  <tr key={expense.id}>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(expense.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">{expense.category}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{expense.description}</td>
                    <td className="px-4 py-3 text-sm font-medium text-white">
                      ${expense.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        disabled
                        className="rounded border border-gray-600 px-3 py-1 text-xs text-gray-500 opacity-50"
                        title="Edit page not yet implemented"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: 'dollar' | 'target' | 'chart';
}) {
  const icons = {
    dollar: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
    target: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
      />
    ),
    chart: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    ),
  };

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-blue-900/30 p-2">
          <svg
            className="h-5 w-5 text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {icons[icon]}
          </svg>
        </div>
        <div>
          <p className="text-sm text-gray-400">{title}</p>
          <p className="text-xl font-bold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const progress = (campaign.raised_amount / campaign.goal_amount) * 100;

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-white">{campaign.name}</h3>
          <p className="mt-1 text-sm text-gray-400">{campaign.description}</p>
        </div>
        <button
          disabled
          className="rounded border border-gray-600 px-4 py-2 text-sm text-gray-500 opacity-50"
          title="Edit page not yet implemented"
        >
          Edit
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-2">
        <div className="h-2 overflow-hidden rounded-full bg-gray-700">
          <div
            className="h-full bg-blue-600 transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">
          ${campaign.raised_amount.toFixed(2)} of ${campaign.goal_amount.toFixed(2)}
        </span>
        <span className="font-medium text-blue-400">{progress.toFixed(1)}%</span>
      </div>
    </div>
  );
}
