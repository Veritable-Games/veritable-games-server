'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { MonthlySummaryDisplay } from '@/lib/donations/types';

interface MonthlyTrendsChartProps {
  data: MonthlySummaryDisplay[];
}

export function MonthlyTrendsChart({ data }: MonthlyTrendsChartProps) {
  // Transform data for the chart
  const chartData = data.map(month => ({
    month: month.month_abbr,
    Donations: month.total_donations,
    Expenses: month.total_expenses,
    Net: month.net_amount,
  }));

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
      <h3 className="mb-4 text-lg font-bold text-white">Monthly Trends</h3>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
          <XAxis dataKey="month" stroke="#a3a3a3" tick={{ fill: '#a3a3a3', fontSize: 12 }} />
          <YAxis
            stroke="#a3a3a3"
            tick={{ fill: '#a3a3a3', fontSize: 12 }}
            tickFormatter={value => `$${value.toLocaleString()}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#262626',
              border: '1px solid #404040',
              borderRadius: '8px',
              color: '#fff',
            }}
            formatter={(value: number | undefined) =>
              value !== undefined ? [`$${value.toFixed(2)}`, ''] : ['', '']
            }
            labelStyle={{ color: '#d4d4d4' }}
          />
          <Legend wrapperStyle={{ color: '#a3a3a3' }} iconType="line" />
          <Line
            type="monotone"
            dataKey="Donations"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={{ fill: '#60a5fa', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="Expenses"
            stroke="#f87171"
            strokeWidth={2}
            dot={{ fill: '#f87171', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="Net"
            stroke="#34d399"
            strokeWidth={2}
            dot={{ fill: '#34d399', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
