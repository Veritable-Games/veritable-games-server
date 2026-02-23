/**
 * x402 Payment Dashboard API
 *
 * GET /api/admin/x402 - Get dashboard statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { requireAdmin } from '@/lib/auth/server';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

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

interface StatsRow {
  total_transactions: string;
  total_revenue_usd: string;
  unique_payers: string;
  unique_endpoints: string;
  avg_transaction_usd: string;
  last_transaction_at: string;
}

interface CountRow {
  count: string;
  revenue: string;
}

interface TransactionRow {
  id: number;
  payment_id: string;
  from_address: string;
  amount_usd: string;
  endpoint: string;
  status: string;
  created_at: string;
}

interface EndpointRow {
  endpoint: string;
  request_count: string;
  total_revenue_usd: string;
}

interface DailyRow {
  date: string;
  transactions: string;
  revenue: string;
}

export const GET = withSecurity(async (request: NextRequest) => {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.response) {
      return authResult.response;
    }

    // Get overall stats
    const statsResult = await dbAdapter.query<StatsRow>(
      `
      SELECT
        COUNT(*) as total_transactions,
        COALESCE(SUM(amount_usd), 0) as total_revenue_usd,
        COUNT(DISTINCT from_address) as unique_payers,
        COUNT(DISTINCT endpoint) as unique_endpoints,
        COALESCE(AVG(amount_usd), 0) as avg_transaction_usd,
        MAX(created_at) as last_transaction_at
      FROM transactions
      WHERE status = 'completed'
    `,
      [],
      { schema: 'x402_payments' }
    );

    // Get today's stats
    const todayResult = await dbAdapter.query<CountRow>(
      `
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(amount_usd), 0) as revenue
      FROM transactions
      WHERE status = 'completed'
        AND created_at >= CURRENT_DATE
    `,
      [],
      { schema: 'x402_payments' }
    );

    // Get this week's stats
    const weekResult = await dbAdapter.query<CountRow>(
      `
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(amount_usd), 0) as revenue
      FROM transactions
      WHERE status = 'completed'
        AND created_at >= CURRENT_DATE - INTERVAL '7 days'
    `,
      [],
      { schema: 'x402_payments' }
    );

    // Get recent transactions
    const recentResult = await dbAdapter.query<TransactionRow>(
      `
      SELECT
        id,
        payment_id,
        from_address,
        amount_usd,
        endpoint,
        status,
        created_at
      FROM transactions
      ORDER BY created_at DESC
      LIMIT 20
    `,
      [],
      { schema: 'x402_payments' }
    );

    // Get top endpoints by revenue
    const topEndpointsResult = await dbAdapter.query<EndpointRow>(
      `
      SELECT
        endpoint,
        COUNT(*) as request_count,
        SUM(amount_usd) as total_revenue_usd
      FROM transactions
      WHERE status = 'completed'
      GROUP BY endpoint
      ORDER BY total_revenue_usd DESC
      LIMIT 10
    `,
      [],
      { schema: 'x402_payments' }
    );

    // Get daily revenue for the last 30 days
    const dailyRevenueResult = await dbAdapter.query<DailyRow>(
      `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as transactions,
        SUM(amount_usd) as revenue
      FROM transactions
      WHERE status = 'completed'
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `,
      [],
      { schema: 'x402_payments' }
    );

    const stats = statsResult.rows[0];
    const today = todayResult.rows[0];
    const week = weekResult.rows[0];

    const dashboardData: DashboardStats = {
      totalTransactions: parseInt(stats?.total_transactions || '0'),
      totalRevenueUSD: parseFloat(stats?.total_revenue_usd || '0'),
      uniquePayers: parseInt(stats?.unique_payers || '0'),
      uniqueEndpoints: parseInt(stats?.unique_endpoints || '0'),
      avgTransactionUSD: parseFloat(stats?.avg_transaction_usd || '0'),
      lastTransactionAt: stats?.last_transaction_at || null,
      todayTransactions: parseInt(today?.count || '0'),
      todayRevenueUSD: parseFloat(today?.revenue || '0'),
      weekTransactions: parseInt(week?.count || '0'),
      weekRevenueUSD: parseFloat(week?.revenue || '0'),
    };

    const recentTransactions: RecentTransaction[] = recentResult.rows.map(row => ({
      id: row.id,
      paymentId: row.payment_id,
      fromAddress: row.from_address,
      amountUSD: parseFloat(row.amount_usd),
      endpoint: row.endpoint,
      status: row.status,
      createdAt: row.created_at,
    }));

    const topEndpoints: TopEndpoint[] = topEndpointsResult.rows.map(row => ({
      endpoint: row.endpoint,
      requestCount: parseInt(row.request_count),
      totalRevenueUSD: parseFloat(row.total_revenue_usd),
    }));

    const dailyRevenue = dailyRevenueResult.rows.map(row => ({
      date: row.date,
      transactions: parseInt(row.transactions),
      revenue: parseFloat(row.revenue),
    }));

    return NextResponse.json({
      success: true,
      data: {
        stats: dashboardData,
        recentTransactions,
        topEndpoints,
        dailyRevenue,
      },
    });
  } catch (error) {
    logger.error('Error fetching x402 dashboard stats:', error);

    // If schema doesn't exist yet, return empty data
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('x402_payments') || errorMessage.includes('does not exist')) {
      return NextResponse.json({
        success: true,
        data: {
          stats: {
            totalTransactions: 0,
            totalRevenueUSD: 0,
            uniquePayers: 0,
            uniqueEndpoints: 0,
            avgTransactionUSD: 0,
            lastTransactionAt: null,
            todayTransactions: 0,
            todayRevenueUSD: 0,
            weekTransactions: 0,
            weekRevenueUSD: 0,
          },
          recentTransactions: [],
          topEndpoints: [],
          dailyRevenue: [],
          notice: 'x402 schema not yet initialized. Run the migration to enable.',
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch x402 dashboard stats' },
      { status: 500 }
    );
  }
});
