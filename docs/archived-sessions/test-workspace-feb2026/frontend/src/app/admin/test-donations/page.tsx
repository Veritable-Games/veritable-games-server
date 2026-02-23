/**
 * Admin Test Donations Interface
 * Simple UI to add test donations without running CLI commands
 */

'use client';

import { useState } from 'react';
import { fetchWithCSRF } from '@/lib/utils/csrf';

export default function TestDonationsPage() {
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
    <div className="min-h-screen bg-neutral-950 p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Test Donations</h1>
          <p className="mt-2 text-neutral-400">
            Add or remove test donations to preview the donation management view
          </p>
        </div>

        {/* Quick Add Buttons */}
        <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Add Test Donation</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[5, 10, 25, 50, 100, 250, 500, 1000].map(amount => (
              <button
                key={amount}
                onClick={() => addTestDonation(amount)}
                disabled={loading}
                className="rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ${amount}
              </button>
            ))}
          </div>
        </div>

        {/* Clear Button */}
        <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Manage Test Data</h2>
          <button
            onClick={clearTestDonations}
            disabled={loading}
            className="rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear All Test Donations
          </button>
          <p className="mt-2 text-sm text-neutral-500">
            Removes all donations with payment_processor = 'other' (test donations only)
          </p>
        </div>

        {/* Result Display */}
        {result && (
          <div
            className={`rounded-lg border p-6 ${
              result.success ? 'border-green-800 bg-green-900/20' : 'border-red-800 bg-red-900/20'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 text-2xl ${result.success ? 'text-green-400' : 'text-red-400'}`}
              >
                {result.success ? '✓' : '✗'}
              </div>
              <div className="flex-1">
                <p className={`font-medium ${result.success ? 'text-green-300' : 'text-red-300'}`}>
                  {result.message}
                </p>
                {result.donation && (
                  <div className="mt-3 space-y-1 text-sm text-neutral-300">
                    <p>
                      <span className="text-neutral-500">Donation ID:</span> {result.donation.id}
                    </p>
                    <p>
                      <span className="text-neutral-500">Amount:</span> ${result.donation.amount}{' '}
                      {result.donation.currency}
                    </p>
                    <p>
                      <span className="text-neutral-500">Project:</span>{' '}
                      {result.donation.projectName}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-700 border-t-blue-500" />
          </div>
        )}

        {/* Quick Link */}
        <div className="mt-8 rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 text-center">
          <p className="mb-3 text-neutral-400">Ready to test?</p>
          <a
            href="/donate"
            className="inline-block rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-purple-500"
          >
            View Donation Page
          </a>
        </div>
      </div>
    </div>
  );
}
