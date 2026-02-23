'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { exportDonations } from '@/lib/utils/csv-export';
import { logger } from '@/lib/utils/logger';

interface Donation {
  id: number;
  donor_name: string;
  amount: number;
  currency: string;
  project_names: string[];
  payment_processor: string;
  payment_status: string;
  message: string | null;
  is_anonymous: boolean;
  completed_at: string | null;
  created_at: string;
}

export const DonationsSection = forwardRef(function DonationsSection(_props, ref) {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  useEffect(() => {
    fetchDonations();
  }, [selectedStatus]);

  async function fetchDonations() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedStatus !== 'all') params.append('payment_status', selectedStatus);

      const response = await fetch(`/api/admin/donations?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch donations');
      }

      setDonations(result.data);
    } catch (err: any) {
      logger.error('Failed to fetch donations:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    await exportDonations({
      paymentStatus: selectedStatus === 'all' ? undefined : selectedStatus,
    });
  }

  useImperativeHandle(ref, () => ({
    handleExport,
  }));

  if (loading && donations.length === 0) {
    return <div className="text-neutral-400">Loading donations...</div>;
  }

  if (error) {
    return <div className="text-red-400">Error: {error}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-neutral-300">Status:</label>
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>

        <div className="text-sm text-neutral-400">
          {donations.length} donation{donations.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Donations Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-sm font-medium text-neutral-400">
              <th className="pb-3 pr-4">ID</th>
              <th className="pb-3 pr-4">Donor</th>
              <th className="pb-3 pr-4">Amount</th>
              <th className="pb-3 pr-4">Projects</th>
              <th className="pb-3 pr-4">Method</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3 pr-4">Date</th>
              <th className="pb-3">Message</th>
            </tr>
          </thead>
          <tbody>
            {donations.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-neutral-500">
                  No donations found
                </td>
              </tr>
            ) : (
              donations.map(donation => (
                <tr
                  key={donation.id}
                  className="border-b border-neutral-800/50 text-sm hover:bg-neutral-800/30"
                >
                  <td className="py-3 pr-4 text-neutral-400">#{donation.id}</td>
                  <td className="py-3 pr-4 text-neutral-200">
                    {donation.is_anonymous ? (
                      <span className="italic text-neutral-500">Anonymous</span>
                    ) : (
                      donation.donor_name
                    )}
                  </td>
                  <td className="py-3 pr-4 font-medium text-neutral-100">
                    ${Number(donation.amount).toFixed(2)} {donation.currency}
                  </td>
                  <td className="py-3 pr-4 text-neutral-300">
                    {donation.project_names.length > 0 ? donation.project_names.join(', ') : '—'}
                  </td>
                  <td className="py-3 pr-4 text-neutral-400">{donation.payment_processor}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                        donation.payment_status === 'completed'
                          ? 'bg-green-500/10 text-green-400'
                          : donation.payment_status === 'pending'
                            ? 'bg-yellow-500/10 text-yellow-400'
                            : donation.payment_status === 'failed'
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-neutral-500/10 text-neutral-400'
                      }`}
                    >
                      {donation.payment_status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-neutral-400">
                    {new Date(donation.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 text-neutral-400">
                    {donation.message ? (
                      <span className="line-clamp-1" title={donation.message}>
                        {donation.message}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});
