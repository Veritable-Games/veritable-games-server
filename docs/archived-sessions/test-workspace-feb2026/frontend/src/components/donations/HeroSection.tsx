'use client';

import { Heart, Target } from 'lucide-react';

interface HeroSectionProps {
  totalRaised: number;
  activeCampaignsCount: number;
}

export default function HeroSection({ totalRaised, activeCampaignsCount }: HeroSectionProps) {
  const formatCurrency = (amount: number) => {
    const numericAmount = Number(amount) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numericAmount);
  };

  return (
    <section className="relative mb-8 overflow-hidden rounded-lg border border-blue-500/20 bg-gradient-to-br from-blue-900/40 via-purple-900/30 to-gray-900/40 p-8">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute left-0 top-0 h-full w-full bg-[url('/grid-pattern.svg')] bg-repeat"></div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Icon */}
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-blue-500 bg-blue-600/20">
          <Heart className="h-6 w-6 text-blue-400" />
        </div>

        {/* Headline */}
        <h1 className="mb-3 text-4xl font-bold text-white">Support Veritable Games</h1>

        {/* Tagline */}
        <p className="mb-6 text-xl text-gray-300">
          Perpetual funding for community-driven development
        </p>

        {/* Description */}
        <p className="mb-6 max-w-2xl text-gray-400">
          Help us build memorable gaming experiences through transparent, community-funded
          development. Choose to support specific projects or contribute to all our initiatives.
        </p>

        {/* Quick Stats */}
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600/20">
              <span className="text-2xl">💰</span>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Raised</p>
              <p className="text-lg font-bold text-white">{formatCurrency(totalRaised)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/20">
              <Target className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Active Campaigns</p>
              <p className="text-lg font-bold text-white">{activeCampaignsCount}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
