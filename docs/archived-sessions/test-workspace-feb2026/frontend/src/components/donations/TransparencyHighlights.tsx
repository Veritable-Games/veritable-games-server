'use client';

import Link from 'next/link';
import { TrendingUp, DollarSign, MinusCircle } from 'lucide-react';

interface TransparencyHighlightsProps {
  thisYearRaised: number;
  thisYearExpenses: number;
  netThisYear: number;
}

export default function TransparencyHighlights({
  thisYearRaised,
  thisYearExpenses,
  netThisYear,
}: TransparencyHighlightsProps) {
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
    <section className="py-8">
      <h2 className="mb-6 text-2xl font-bold text-white">Financial Transparency</h2>

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* This Year Raised */}
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-6">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-600/20">
              <TrendingUp className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Raised This Year</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(thisYearRaised)}</p>
            </div>
          </div>
        </div>

        {/* This Year Expenses */}
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-6">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-600/20">
              <MinusCircle className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Expenses This Year</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(thisYearExpenses)}</p>
            </div>
          </div>
        </div>

        {/* Net This Year */}
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-6">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600/20">
              <DollarSign className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Available for Projects</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(netThisYear)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-blue-500/30 bg-blue-900/20 p-4">
        <p className="mb-3 text-gray-300">
          Want to see detailed expense breakdowns, funding history, and how every dollar is spent?
        </p>
        <Link
          href="/donate/transparency"
          className="inline-flex items-center gap-2 font-medium text-blue-400 transition-colors hover:text-blue-300"
        >
          View Full Transparency Dashboard →
        </Link>
      </div>
    </section>
  );
}
