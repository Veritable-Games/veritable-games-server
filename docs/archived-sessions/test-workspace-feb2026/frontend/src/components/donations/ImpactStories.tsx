'use client';

import { Check, ExternalLink } from 'lucide-react';

interface CompletedGoal {
  id: number;
  title: string;
  amount: number;
  outcome: string;
  completedDate: string;
  projectLink?: string;
}

interface ImpactStoriesProps {
  completedGoals: CompletedGoal[];
  maxItems?: number;
}

export default function ImpactStories({ completedGoals, maxItems = 5 }: ImpactStoriesProps) {
  const formatCurrency = (amount: number) => {
    const numericAmount = Number(amount) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numericAmount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  };

  const displayGoals = completedGoals.slice(0, maxItems);

  if (displayGoals.length === 0) {
    return null;
  }

  return (
    <section className="py-8">
      <h2 className="mb-6 text-2xl font-bold text-white">What Your Support Built</h2>
      <p className="mb-6 text-gray-400">
        See the real impact of community funding. Here's what we've accomplished together.
      </p>

      <div className="space-y-4">
        {displayGoals.map(goal => (
          <div
            key={goal.id}
            className="rounded-lg border border-green-700/30 bg-gray-800/30 p-5 transition-colors hover:border-green-500/50"
          >
            <div className="flex items-start gap-4">
              {/* Checkmark Icon */}
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-green-500 bg-green-600/20">
                <Check className="h-6 w-6 text-green-400" />
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="mb-2 flex items-start justify-between gap-4">
                  <h3 className="text-lg font-bold text-white">{goal.title}</h3>
                  <span className="whitespace-nowrap font-semibold text-green-400">
                    {formatCurrency(goal.amount)}
                  </span>
                </div>

                <p className="mb-2 text-gray-300">{goal.outcome}</p>

                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Completed {formatDate(goal.completedDate)}
                  </p>

                  {goal.projectLink && (
                    <a
                      href={goal.projectLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-blue-400 transition-colors hover:text-blue-300"
                    >
                      <span>View Project</span>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
