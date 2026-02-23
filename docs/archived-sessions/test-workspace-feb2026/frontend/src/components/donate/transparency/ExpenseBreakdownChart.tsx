'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { ExpenseCategoryBreakdown } from '@/lib/donations/types';

interface ExpenseBreakdownChartProps {
  data: ExpenseCategoryBreakdown[];
}

export function ExpenseBreakdownChart({ data }: ExpenseBreakdownChartProps) {
  // Transform data for the chart
  const chartData = data.map(item => ({
    name: item.category.name,
    value: item.total,
    percentage: item.percentage,
    color: item.category.color,
  }));

  // Custom label to show percentage
  const renderLabel = (entry: any) => {
    return `${entry.percentage.toFixed(1)}%`;
  };

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
      <h3 className="mb-4 text-lg font-bold text-white">Expense Breakdown</h3>

      {chartData.length === 0 ? (
        <p className="py-8 text-center text-neutral-400">No expense data available</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderLabel}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#262626',
                  border: '1px solid #404040',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                formatter={(value: number | undefined, name: string | undefined, props: any) =>
                  value !== undefined && props?.payload
                    ? [`$${value.toFixed(2)} (${props.payload.percentage.toFixed(1)}%)`, name || '']
                    : ['', '']
                }
              />
              <Legend wrapperStyle={{ color: '#a3a3a3' }} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>

          {/* Category breakdown list */}
          <div className="mt-4 space-y-2">
            {chartData.map((entry, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-neutral-300">{entry.name}</span>
                </div>
                <span className="text-white">
                  ${entry.value.toFixed(2)} ({entry.percentage.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
