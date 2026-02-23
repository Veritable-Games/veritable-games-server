'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DollarSign, TrendingUp, Target, Award } from 'lucide-react';

interface QuickDonateSidebarProps {
  totalRaised: number;
  thisYearRaised: number;
  activeCampaignsCount: number;
  avgProgress: number;
  onDonate: (amount: number | 'custom') => void;
}

export default function QuickDonateSidebar({
  totalRaised,
  thisYearRaised,
  activeCampaignsCount,
  avgProgress,
  onDonate,
}: QuickDonateSidebarProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | 'custom' | null>(null);

  const formatCurrency = (amount: number) => {
    const numericAmount = Number(amount) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numericAmount);
  };

  const presetAmounts = [5, 10, 25, 50, 100];

  const handleDonate = (amount: number | 'custom') => {
    setSelectedAmount(amount);
    onDonate(amount);
  };

  return (
    <div className="sticky top-4 space-y-6">
      {/* Funding Stats Card */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-6">
        <h3 className="mb-4 text-lg font-bold text-white">Funding Overview</h3>

        <div className="space-y-4">
          {/* Total Raised */}
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-green-600/20">
              <DollarSign className="h-5 w-5 text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-400">Total Raised</p>
              <p className="text-xl font-bold text-white">{formatCurrency(totalRaised)}</p>
            </div>
          </div>

          {/* This Year */}
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600/20">
              <TrendingUp className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-400">This Year</p>
              <p className="text-xl font-bold text-white">{formatCurrency(thisYearRaised)}</p>
            </div>
          </div>

          {/* Active Campaigns */}
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-purple-600/20">
              <Target className="h-5 w-5 text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-400">Active Campaigns</p>
              <p className="text-xl font-bold text-white">{activeCampaignsCount}</p>
            </div>
          </div>

          {/* Average Progress */}
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-orange-600/20">
              <Award className="h-5 w-5 text-orange-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-400">Avg Progress</p>
              <p className="text-xl font-bold text-white">{Number(avgProgress || 0).toFixed(0)}%</p>
            </div>
          </div>
        </div>

        {/* Transparency Link */}
        <Link
          href="/donate/transparency"
          className="mt-4 block text-center text-sm text-blue-400 transition-colors hover:text-blue-300"
        >
          View Full Transparency Dashboard →
        </Link>
      </div>

      {/* Quick Donate Card */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-6">
        <h3 className="mb-4 text-lg font-bold text-white">Support Veritable Games</h3>

        {/* Preset Amounts */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          {presetAmounts.map(amount => (
            <button
              key={amount}
              onClick={() => handleDonate(amount)}
              className={`rounded-lg px-4 py-3 font-semibold transition-colors ${
                selectedAmount === amount
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              ${amount}
            </button>
          ))}
        </div>

        {/* Custom Amount Button */}
        <button
          onClick={() => handleDonate('custom')}
          className={`w-full rounded-lg px-4 py-3 font-semibold transition-colors ${
            selectedAmount === 'custom'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Custom Amount
        </button>

        {/* Trust Badges */}
        <div className="mt-6 border-t border-gray-700 pt-6">
          <p className="mb-3 text-center text-xs text-gray-400">Secure payments powered by</p>
          <div className="flex items-center justify-center gap-3">
            <div className="rounded bg-gray-700 px-3 py-1 text-xs font-semibold text-gray-300">
              🔒 Stripe
            </div>
            <div className="rounded bg-gray-700 px-3 py-1 text-xs font-semibold text-gray-300">
              ₿ Crypto
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
