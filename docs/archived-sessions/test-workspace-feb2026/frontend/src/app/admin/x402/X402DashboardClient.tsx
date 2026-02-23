'use client';

import { useEffect, useState, useCallback } from 'react';
import { logger } from '@/lib/utils/logger';

interface DashboardStats {
  totalTransactions: number;
  totalRevenueUSD: number;
  uniquePayers: number;
  uniqueEndpoints: number;
  avgTransactionUSD: number;
  lastTransactionAt: string | null;
  todayTransactions: number;
  todayRevenueUSD: number;
  weekTransactions: number;
  weekRevenueUSD: number;
}

interface RecentTransaction {
  id: number;
  paymentId: string;
  fromAddress: string;
  amountUSD: number;
  endpoint: string;
  status: string;
  createdAt: string;
}

interface TopEndpoint {
  endpoint: string;
  requestCount: number;
  totalRevenueUSD: number;
}

interface DailyRevenue {
  date: string;
  transactions: number;
  revenue: number;
}

interface BotClient {
  id: number;
  clientId: string;
  clientName: string;
  contactEmail: string | null;
  billingType: 'instant' | 'aggregated';
  walletAddress: string | null;
  monthlyLimitUSD: number;
  currentMonthUsageUSD: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
}

interface DashboardData {
  stats: DashboardStats;
  recentTransactions: RecentTransaction[];
  topEndpoints: TopEndpoint[];
  dailyRevenue: DailyRevenue[];
  notice?: string;
}

export default function X402DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [clients, setClients] = useState<BotClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'clients'>('overview');

  // New client form state
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientLimit, setNewClientLimit] = useState('100');
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/x402');
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to load dashboard');
      }
    } catch (err) {
      setError('Network error loading dashboard');
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/x402/clients');
      const result = await response.json();
      if (result.success) {
        setClients(result.data);
      }
    } catch (err) {
      logger.error('Failed to load clients:', err);
    }
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([fetchDashboard(), fetchClients()]);
      setLoading(false);
    }
    load();
  }, [fetchDashboard, fetchClients]);

  const createClient = async () => {
    try {
      const response = await fetch('/api/admin/x402/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: newClientName,
          contactEmail: newClientEmail || undefined,
          monthlyLimitUSD: parseFloat(newClientLimit),
          billingType: 'aggregated',
        }),
      });
      const result = await response.json();
      if (result.success) {
        setCreatedApiKey(result.data.apiKey);
        setClients([result.data.client, ...clients]);
        setNewClientName('');
        setNewClientEmail('');
        setNewClientLimit('100');
      } else {
        alert(result.error || 'Failed to create client');
      }
    } catch (err) {
      alert('Network error creating client');
    }
  };

  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatAddress = (address: string) => {
    if (!address) return '-';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-900/20 p-6">
        <h3 className="text-lg font-semibold text-red-400">Error</h3>
        <p className="mt-2 text-neutral-300">{error}</p>
        <button
          onClick={() => {
            setError(null);
            fetchDashboard();
          }}
          className="mt-4 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Notice Banner */}
      {data?.notice && (
        <div className="rounded-lg border border-yellow-800 bg-yellow-900/20 p-4">
          <p className="text-yellow-200">{data.notice}</p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-neutral-800 pb-4">
        {(['overview', 'transactions', 'clients'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-t px-4 py-2 font-medium transition-colors ${
              activeTab === tab ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && data && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Revenue"
              value={formatUSD(data.stats.totalRevenueUSD)}
              subtitle={`${data.stats.totalTransactions} transactions`}
              color="green"
            />
            <StatCard
              title="Today"
              value={formatUSD(data.stats.todayRevenueUSD)}
              subtitle={`${data.stats.todayTransactions} transactions`}
              color="blue"
            />
            <StatCard
              title="This Week"
              value={formatUSD(data.stats.weekRevenueUSD)}
              subtitle={`${data.stats.weekTransactions} transactions`}
              color="purple"
            />
            <StatCard
              title="Unique Payers"
              value={data.stats.uniquePayers.toString()}
              subtitle={`Avg: ${formatUSD(data.stats.avgTransactionUSD)}`}
              color="yellow"
            />
          </div>

          {/* Top Endpoints */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">Top Endpoints by Revenue</h3>
            {data.topEndpoints.length === 0 ? (
              <p className="text-neutral-500">No data yet</p>
            ) : (
              <div className="space-y-3">
                {data.topEndpoints.map((endpoint, i) => (
                  <div
                    key={endpoint.endpoint}
                    className="flex items-center justify-between rounded bg-neutral-800/50 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-neutral-500">#{i + 1}</span>
                      <code className="text-sm text-neutral-300">{endpoint.endpoint}</code>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-green-400">
                        {formatUSD(endpoint.totalRevenueUSD)}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {endpoint.requestCount} requests
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Daily Revenue Chart (simplified) */}
          {data.dailyRevenue.length > 0 && (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
              <h3 className="mb-4 text-lg font-semibold text-white">Last 30 Days</h3>
              <div className="flex h-40 items-end gap-1">
                {data.dailyRevenue
                  .slice(0, 30)
                  .reverse()
                  .map(day => {
                    const maxRevenue = Math.max(...data.dailyRevenue.map(d => d.revenue));
                    const height = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
                    return (
                      <div
                        key={day.date}
                        className="flex-1 rounded-t bg-blue-500 transition-all hover:bg-blue-400"
                        style={{ height: `${Math.max(height, 2)}%` }}
                        title={`${day.date}: ${formatUSD(day.revenue)} (${day.transactions} tx)`}
                      />
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && data && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Recent Transactions</h3>
          {data.recentTransactions.length === 0 ? (
            <p className="text-neutral-500">No transactions yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-700 text-left text-sm text-neutral-400">
                    <th className="pb-3">Time</th>
                    <th className="pb-3">From</th>
                    <th className="pb-3">Endpoint</th>
                    <th className="pb-3 text-right">Amount</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {data.recentTransactions.map(tx => (
                    <tr key={tx.id} className="border-b border-neutral-800">
                      <td className="py-3 text-neutral-300">{formatDate(tx.createdAt)}</td>
                      <td className="py-3">
                        <code className="text-blue-400">{formatAddress(tx.fromAddress)}</code>
                      </td>
                      <td className="py-3">
                        <code className="text-neutral-400">{tx.endpoint}</code>
                      </td>
                      <td className="py-3 text-right text-green-400">{formatUSD(tx.amountUSD)}</td>
                      <td className="py-3">
                        <span
                          className={`rounded px-2 py-1 text-xs ${
                            tx.status === 'completed'
                              ? 'bg-green-900/50 text-green-400'
                              : tx.status === 'failed'
                                ? 'bg-red-900/50 text-red-400'
                                : 'bg-yellow-900/50 text-yellow-400'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Clients Tab */}
      {activeTab === 'clients' && (
        <div className="space-y-6">
          {/* New Client Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewClientForm(true)}
              className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
            >
              + Register Bot Client
            </button>
          </div>

          {/* New Client Form Modal */}
          {showNewClientForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="w-full max-w-md rounded-lg border border-neutral-700 bg-neutral-900 p-6">
                <h3 className="mb-4 text-lg font-semibold text-white">Register New Bot Client</h3>

                {createdApiKey ? (
                  <div>
                    <div className="mb-4 rounded border border-green-700 bg-green-900/20 p-4">
                      <p className="mb-2 font-medium text-green-400">
                        Client created successfully!
                      </p>
                      <p className="mb-2 text-sm text-neutral-300">
                        API Key (copy now, shown only once):
                      </p>
                      <code className="block break-all rounded bg-neutral-800 p-2 text-xs text-yellow-400">
                        {createdApiKey}
                      </code>
                    </div>
                    <button
                      onClick={() => {
                        setCreatedApiKey(null);
                        setShowNewClientForm(false);
                      }}
                      className="w-full rounded bg-neutral-700 px-4 py-2 text-white hover:bg-neutral-600"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1 block text-sm text-neutral-400">Client Name *</label>
                        <input
                          type="text"
                          value={newClientName}
                          onChange={e => setNewClientName(e.target.value)}
                          className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
                          placeholder="e.g., OpenAI GPT Crawler"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-neutral-400">Contact Email</label>
                        <input
                          type="email"
                          value={newClientEmail}
                          onChange={e => setNewClientEmail(e.target.value)}
                          className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
                          placeholder="billing@example.com"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-neutral-400">
                          Monthly Limit (USD)
                        </label>
                        <input
                          type="number"
                          value={newClientLimit}
                          onChange={e => setNewClientLimit(e.target.value)}
                          className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
                          min="1"
                        />
                      </div>
                    </div>
                    <div className="mt-6 flex gap-3">
                      <button
                        onClick={() => setShowNewClientForm(false)}
                        className="flex-1 rounded border border-neutral-700 px-4 py-2 text-white hover:bg-neutral-800"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={createClient}
                        disabled={!newClientName}
                        className="flex-1 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Create Client
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Clients List */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">Registered Bot Clients</h3>
            {clients.length === 0 ? (
              <p className="text-neutral-500">No clients registered yet</p>
            ) : (
              <div className="space-y-4">
                {clients.map(client => (
                  <div
                    key={client.id}
                    className="rounded border border-neutral-700 bg-neutral-800/50 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-white">{client.clientName}</h4>
                        <p className="text-sm text-neutral-400">
                          {client.contactEmail || 'No email'}
                        </p>
                      </div>
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          client.isActive
                            ? 'bg-green-900/50 text-green-400'
                            : 'bg-red-900/50 text-red-400'
                        }`}
                      >
                        {client.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-neutral-500">Billing:</span>{' '}
                        <span className="text-neutral-300">{client.billingType}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500">Monthly Limit:</span>{' '}
                        <span className="text-neutral-300">
                          {formatUSD(client.monthlyLimitUSD)}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500">Usage:</span>{' '}
                        <span className="text-neutral-300">
                          {formatUSD(client.currentMonthUsageUSD)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Documentation Link */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
        <h3 className="mb-2 text-lg font-semibold text-white">x402 Protocol Documentation</h3>
        <p className="mb-4 text-neutral-400">
          Learn more about the x402 payment protocol and how to integrate it with your bots.
        </p>
        <div className="flex gap-4">
          <a
            href="https://docs.x402.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            x402 Documentation
          </a>
          <a
            href="https://github.com/coinbase/x402"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            GitHub Repository
          </a>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: 'green' | 'blue' | 'purple' | 'yellow';
}) {
  const colorClasses = {
    green: 'border-green-800 bg-green-900/20',
    blue: 'border-blue-800 bg-blue-900/20',
    purple: 'border-purple-800 bg-purple-900/20',
    yellow: 'border-yellow-800 bg-yellow-900/20',
  };

  const valueColors = {
    green: 'text-green-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    yellow: 'text-yellow-400',
  };

  return (
    <div className={`rounded-lg border p-6 ${colorClasses[color]}`}>
      <h3 className="text-sm font-medium text-neutral-400">{title}</h3>
      <p className={`mt-2 text-2xl font-bold ${valueColors[color]}`}>{value}</p>
      <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
    </div>
  );
}
