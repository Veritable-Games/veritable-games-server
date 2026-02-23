'use client';

/**
 * Admin Context Banner
 * Displayed at the top of pages for admin users
 * Provides quick access to relevant admin functions
 */

import Link from 'next/link';
import { Settings, TrendingUp, DollarSign, FileText, Target } from 'lucide-react';

interface AdminContextBannerProps {
  context?: 'donations' | 'general';
}

export function AdminContextBanner({ context = 'donations' }: AdminContextBannerProps) {
  return (
    <div className="border-b border-yellow-500/30 bg-yellow-900/20 px-4 py-3">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-yellow-400" />
          <span className="text-sm font-medium text-yellow-200">Admin Controls</span>
        </div>

        <div className="flex items-center gap-4">
          {context === 'donations' && (
            <>
              <Link
                href="/admin/campaigns"
                className="flex items-center gap-1 text-sm text-yellow-300 transition-colors hover:text-yellow-100"
              >
                <Target className="h-4 w-4" />
                <span>Manage Campaigns</span>
              </Link>

              <Link
                href="/admin/expenses"
                className="flex items-center gap-1 text-sm text-yellow-300 transition-colors hover:text-yellow-100"
              >
                <DollarSign className="h-4 w-4" />
                <span>View Expenses</span>
              </Link>
            </>
          )}

          <Link
            href="/admin"
            className="flex items-center gap-1 rounded bg-yellow-600/30 px-3 py-1 text-sm font-medium text-yellow-100 transition-colors hover:bg-yellow-600/40"
          >
            <TrendingUp className="h-4 w-4" />
            <span>Admin Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
