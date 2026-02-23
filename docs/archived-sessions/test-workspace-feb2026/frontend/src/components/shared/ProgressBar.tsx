/**
 * Shared ProgressBar Component
 *
 * Reusable progress bar for displaying campaign goals, project funding, and other metrics.
 * Used in transparency page and donation management.
 *
 * Design:
 * - Dark theme with site colors (#0a0a0a, #ededed, #60a5fa)
 * - Gradient fills for editorial flair
 * - Percentage or amount display
 * - Optional labels and custom colors
 */

import React from 'react';

export interface ProgressBarProps {
  /** Current value */
  current: number;
  /** Target/goal value */
  target: number;
  /** Show percentage text */
  showPercentage?: boolean;
  /** Show amount text (e.g., "$1,234 / $5,000") */
  showAmount?: boolean;
  /** Amount formatter function */
  formatAmount?: (value: number) => string;
  /** Custom height */
  height?: 'sm' | 'md' | 'lg';
  /** Custom color */
  color?: 'blue' | 'green' | 'purple' | 'gradient';
  /** Optional className for custom styling */
  className?: string;
  /** Optional label */
  label?: string;
}

/**
 * ProgressBar Component
 *
 * @example
 * ```tsx
 * <ProgressBar
 *   current={1234.56}
 *   target={5000}
 *   showPercentage
 *   showAmount
 *   formatAmount={(v) => `$${v.toFixed(2)}`}
 *   color="gradient"
 *   label="Campaign Progress"
 * />
 * ```
 */
export function ProgressBar({
  current,
  target,
  showPercentage = false,
  showAmount = false,
  formatAmount = (v: number) => v.toFixed(2),
  height = 'md',
  color = 'blue',
  className = '',
  label,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (current / target) * 100));

  // Height classes
  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  // Color classes
  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    purple: 'bg-purple-600',
    gradient: 'bg-gradient-to-r from-blue-600 to-purple-600',
  };

  return (
    <div className={className}>
      {/* Label and percentage/amount */}
      {(label || showPercentage || showAmount) && (
        <div className="mb-2 flex items-center justify-between text-sm">
          {label && <span className="text-gray-300">{label}</span>}
          <div className="flex items-center gap-3 text-gray-400">
            {showAmount && (
              <span>
                {formatAmount(current)} / {formatAmount(target)}
              </span>
            )}
            {showPercentage && (
              <span className="font-medium text-white">{percentage.toFixed(0)}%</span>
            )}
          </div>
        </div>
      )}

      {/* Progress bar track */}
      <div className="overflow-hidden rounded-full bg-gray-700/50">
        {/* Progress bar fill */}
        <div
          className={`${heightClasses[height]} ${colorClasses[color]} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={0}
          aria-valuemax={target}
          aria-label={label || 'Progress'}
        />
      </div>
    </div>
  );
}
