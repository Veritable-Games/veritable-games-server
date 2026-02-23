'use client';

/**
 * Goals Tab - Active Campaigns
 * Displays funding goals with progress and deadlines
 */

import { useState, useEffect } from 'react';
import { Calendar, TrendingUp } from 'lucide-react';
import { logger } from '@/lib/utils/logger';

interface FundingGoal {
  id: number;
  title: string;
  description: string;
  target_amount: number;
  current_amount: number;
  progress_percentage: number;
  start_date: string;
  end_date: string | null;
  days_remaining: number | null;
  is_active: boolean;
}

interface GoalsTabProps {
  onDonateClick: (goalId?: number) => void;
}

export function GoalsTab({ onDonateClick }: GoalsTabProps) {
  const [goals, setGoals] = useState<FundingGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGoals = async () => {
      try {
        const response = await fetch('/api/donations/transparency');
        if (!response.ok) throw new Error('Failed to fetch goals');

        const data = await response.json();
        setGoals(data.active_goals || []);
      } catch (err: any) {
        logger.error('Error fetching goals:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchGoals();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 animate-pulse rounded-lg bg-gray-800/50" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-900/20 p-4">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-8 text-center">
        <p className="text-gray-400">No active funding campaigns at the moment.</p>
        <button
          onClick={() => onDonateClick()}
          className="mt-4 rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700"
        >
          Make a General Donation
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-2xl font-bold text-white">Active Funding Campaigns</h2>
        <p className="text-gray-400">
          Help us reach our goals by contributing to these active campaigns. Every donation makes a
          difference.
        </p>
      </div>

      <div className="space-y-4">
        {goals.map(goal => {
          const isUrgent = goal.days_remaining !== null && goal.days_remaining < 30;

          return (
            <div
              key={goal.id}
              className={`rounded-lg border p-6 ${
                isUrgent
                  ? 'border-orange-500/50 bg-orange-900/10'
                  : 'border-gray-700 bg-gray-800/50'
              }`}
            >
              {isUrgent && (
                <div className="mb-3 flex items-center gap-2 text-orange-400">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {goal.days_remaining} {goal.days_remaining === 1 ? 'day' : 'days'} remaining
                  </span>
                </div>
              )}

              <h3 className="mb-2 text-xl font-bold text-white">{goal.title}</h3>
              <p className="mb-4 text-sm text-gray-400">{goal.description}</p>

              {/* Progress Stats */}
              <div className="mb-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-300">
                  <TrendingUp className="h-4 w-4" />
                  <span>
                    ${goal.current_amount.toLocaleString()} of $
                    {goal.target_amount.toLocaleString()} raised
                  </span>
                </div>
                <span className="font-semibold text-blue-400">
                  {Number(goal.progress_percentage || 0).toFixed(0)}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mb-4 h-3 overflow-hidden rounded-full bg-gray-700">
                <div
                  className={`h-full transition-all ${isUrgent ? 'bg-orange-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(goal.progress_percentage, 100)}%` }}
                />
              </div>

              {/* Dates */}
              <div className="mb-4 flex gap-4 text-xs text-gray-500">
                <div>
                  <span className="font-medium">Started:</span>{' '}
                  {new Date(goal.start_date).toLocaleDateString()}
                </div>
                {goal.end_date && (
                  <div>
                    <span className="font-medium">Ends:</span>{' '}
                    {new Date(goal.end_date).toLocaleDateString()}
                  </div>
                )}
              </div>

              {/* CTA Button */}
              <button
                onClick={() => onDonateClick(goal.id)}
                className={`w-full rounded-lg px-4 py-2 font-medium transition-colors ${
                  isUrgent
                    ? 'bg-orange-600 text-white hover:bg-orange-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                Contribute to This Campaign →
              </button>
            </div>
          );
        })}
      </div>

      {/* General Donation CTA */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-6 text-center">
        <p className="mb-4 text-gray-300">Want to support the project in general?</p>
        <button
          onClick={() => onDonateClick()}
          className="rounded-lg border border-blue-500 bg-blue-600/20 px-6 py-2 font-medium text-blue-300 transition-colors hover:bg-blue-600/30"
        >
          Make a General Donation
        </button>
      </div>
    </div>
  );
}
