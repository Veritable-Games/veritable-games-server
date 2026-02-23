/**
 * Admin Test Donations Panel
 * Embedded panel for adding test donations (admin only)
 */

'use client';

import { useState } from 'react';
import { fetchWithCSRF } from '@/lib/utils/csrf';

interface AdminTestPanelProps {
  onDonationAdded?: () => void;
}

export function AdminTestPanel({ onDonationAdded }: AdminTestPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    donation?: any;
  } | null>(null);

  const addTestDonation = async (amount: number) => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetchWithCSRF('/api/admin/test-donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      const data = await response.json();
      setResult(data);

      // Trigger page refresh if donation was successful
      if (data.success && onDonationAdded) {
        setTimeout(() => {
          onDonationAdded();
        }, 1500);
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create donation',
      });
    } finally {
      setLoading(false);
    }
  };

  const clearTestDonations = async () => {
    if (!confirm('Delete all test donations? This cannot be undone.')) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetchWithCSRF('/api/admin/test-donations', {
        method: 'DELETE',
      });

      const data = await response.json();
      setResult(data);

      // Trigger page refresh if deletion was successful
      if (data.success && onDonationAdded) {
        setTimeout(() => {
          onDonationAdded();
        }, 1500);
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete donations',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 rounded-lg border border-orange-800 bg-orange-900/10 p-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded bg-orange-900/30 px-2 py-1 text-xs font-medium text-orange-400">
          ADMIN
        </div>
        <h3 className="text-lg font-semibold text-white">Test Donations</h3>
      </div>

      {/* Quick Add Buttons */}
      <div className="mb-4">
        <p className="mb-3 text-sm text-neutral-400">Add test donation:</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {[5, 10, 25, 50, 100, 250, 500, 1000].map(amount => (
            <button
              key={amount}
              onClick={() => addTestDonation(amount)}
              disabled={loading}
              className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ${amount}
            </button>
          ))}
        </div>
      </div>

      {/* Clear Button */}
      <div className="mb-4">
        <button
          onClick={clearTestDonations}
          disabled={loading}
          className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear All Test Donations
        </button>
        <p className="mt-1 text-xs text-neutral-500">
          Removes all donations with payment_processor = 'other'
        </p>
      </div>

      {/* Result Display */}
      {result && (
        <div
          className={`rounded border p-3 ${
            result.success
              ? 'border-green-800 bg-green-900/20 text-green-300'
              : 'border-red-800 bg-red-900/20 text-red-300'
          }`}
        >
          <div className="flex items-start gap-2">
            <span className="text-lg">{result.success ? '✓' : '✗'}</span>
            <div className="flex-1 text-sm">
              <p className="font-medium">{result.message}</p>
              {result.donation && (
                <p className="mt-1 text-xs opacity-75">
                  ID: {result.donation.id} • ${result.donation.amount} {result.donation.currency}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-700 border-t-blue-500" />
        </div>
      )}
    </div>
  );
}
