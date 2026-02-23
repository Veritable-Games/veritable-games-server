'use client';

import { useState } from 'react';
import { SubscriptionWithProject } from '@/lib/donations/types';

interface SubscriptionsListProps {
  subscriptions: SubscriptionWithProject[];
}

export function SubscriptionsList({ subscriptions }: SubscriptionsListProps) {
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSubscriptions = subscriptions.filter(
    s => s.status === 'active' || s.status === 'trialing'
  );
  const inactiveSubscriptions = subscriptions.filter(
    s => s.status !== 'active' && s.status !== 'trialing'
  );

  async function handleManageSubscription(stripeCustomerId: string) {
    try {
      setLoadingPortal(true);
      setError(null);

      const response = await fetch('/api/donations/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stripeCustomerId }),
      });

      const result = await response.json();

      if (result.success && result.portalUrl) {
        window.location.href = result.portalUrl;
      } else {
        const errorMsg = typeof result.error === 'object' ? result.error?.message : result.error;
        setError(errorMsg || 'Failed to open subscription portal');
      }
    } catch (err) {
      setError('Failed to open subscription portal');
    } finally {
      setLoadingPortal(false);
    }
  }

  if (subscriptions.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-12 text-center">
        <p className="text-neutral-400">No subscriptions yet</p>
        <p className="mt-2 text-sm text-neutral-500">
          Set up a recurring donation to support ongoing development
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Active Subscriptions */}
      {activeSubscriptions.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-bold text-white">Active Subscriptions</h2>
          <div className="space-y-4">
            {activeSubscriptions.map(subscription => (
              <div
                key={subscription.id}
                className="rounded-lg border border-green-800/50 bg-green-900/10 p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-white">
                        ${subscription.amount.toFixed(2)}
                      </span>
                      <span className="text-sm text-neutral-400">/ {subscription.interval}</span>
                      <span className="rounded-full bg-green-900/50 px-2 py-1 text-xs text-green-400">
                        {subscription.status}
                      </span>
                    </div>
                    {subscription.project && (
                      <p className="mt-2 text-sm text-neutral-400">
                        Supporting: {subscription.project.name}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-neutral-500">
                      Started {new Date(subscription.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleManageSubscription(subscription.stripe_customer_id)}
                    disabled={loadingPortal}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                  >
                    {loadingPortal ? 'Loading...' : 'Manage'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inactive Subscriptions */}
      {inactiveSubscriptions.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-bold text-white">Past Subscriptions</h2>
          <div className="space-y-4">
            {inactiveSubscriptions.map(subscription => (
              <div
                key={subscription.id}
                className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 opacity-60"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold text-white">
                        ${subscription.amount.toFixed(2)}
                      </span>
                      <span className="text-sm text-neutral-400">/ {subscription.interval}</span>
                      <span className="rounded-full bg-neutral-800 px-2 py-1 text-xs text-neutral-400">
                        {subscription.status}
                      </span>
                    </div>
                    {subscription.project && (
                      <p className="mt-2 text-sm text-neutral-400">
                        Supported: {subscription.project.name}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-neutral-500">
                      {new Date(subscription.created_at).toLocaleDateString()} -{' '}
                      {subscription.canceled_at
                        ? new Date(subscription.canceled_at).toLocaleDateString()
                        : 'Present'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
