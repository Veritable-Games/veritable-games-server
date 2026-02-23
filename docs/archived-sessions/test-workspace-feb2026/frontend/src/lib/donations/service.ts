/**
 * Donations System - Service Layer
 *
 * Business logic for donation management and transparency
 * Uses dbAdapter for database operations (following CRITICAL_PATTERNS.md)
 */

import { dbAdapter } from '@/lib/database/adapter';
import { badgeService } from '@/lib/badges/service';
import { estimateAnnualTax, calculateQuarterlyPayment } from './tax-service';
import { logger } from '@/lib/utils/logger';
import type {
  Donation,
  DonationWithAllocations,
  CreateDonationDTO,
  FundingProject,
  FundingProjectWithProgress,
  FundingGoal,
  FundingGoalWithProgress,
  TransparencyMetrics,
  MonthlySummary,
  MonthlySummaryDisplay,
  Expense,
  ExpenseWithCategory,
  ExpenseCategory,
  ExpenseCategoryBreakdown,
  ExpenseCategoryWithItems,
  ExpenseLineItem,
  ProjectFundingTotal,
  DonationSummary,
  DonationWidgetData,
  CreateExpenseDTO,
  TopDonor,
  ProjectAllocation,
  DonationAllocation,
  PaymentProcessor,
  PaymentStatus,
} from './types';
import {
  validateAllocations,
  validateDonationAmount,
  calculateProgress,
  calculateDaysRemaining,
  formatMonth,
  UpdateFundingGoalDTO,
} from './types';

/**
 * Service for donation management
 */
export class DonationService {
  private schema = 'donations' as const;

  // ==========================================================================
  // FUNDING PROJECTS
  // ==========================================================================

  /**
   * Get all active funding projects
   */
  async getActiveFundingProjects(): Promise<FundingProject[]> {
    const result = await dbAdapter.query<FundingProject>(
      `
      SELECT * FROM funding_projects
      WHERE is_active = TRUE
      ORDER BY display_order ASC, name ASC
      `,
      [],
      { schema: this.schema }
    );

    return result.rows;
  }

  /**
   * Get funding projects with progress and stats
   */
  async getFundingProjectsWithProgress(): Promise<FundingProjectWithProgress[]> {
    const result = await dbAdapter.query<any>(
      `
      SELECT
        fp.*,
        COALESCE(
          ROUND((fp.current_amount / NULLIF(fp.target_amount, 0)) * 100, 2),
          0
        ) as progress_percentage,
        COUNT(DISTINCT da.donation_id) FILTER (WHERE d.payment_status = 'completed') as donor_count
      FROM funding_projects fp
      LEFT JOIN donation_allocations da ON fp.id = da.project_id
      LEFT JOIN donations d ON da.donation_id = d.id
      WHERE fp.is_active = TRUE
      GROUP BY fp.id
      ORDER BY fp.display_order ASC, fp.name ASC
      `,
      [],
      { schema: this.schema }
    );

    return result.rows.map(row => ({
      ...row,
      progress_percentage: parseFloat(row.progress_percentage || 0),
      donor_count: parseInt(row.donor_count || 0, 10),
    }));
  }

  /**
   * Get funding project by ID
   */
  async getFundingProjectById(projectId: number): Promise<FundingProject | null> {
    const result = await dbAdapter.query<FundingProject>(
      `SELECT * FROM funding_projects WHERE id = $1`,
      [projectId],
      { schema: this.schema }
    );

    return result.rows[0] || null;
  }

  /**
   * Get funding project by slug
   */
  async getFundingProjectBySlug(slug: string): Promise<FundingProject | null> {
    const result = await dbAdapter.query<FundingProject>(
      `SELECT * FROM funding_projects WHERE slug = $1`,
      [slug],
      { schema: this.schema }
    );

    return result.rows[0] || null;
  }

  // ==========================================================================
  // FUNDING GOALS
  // ==========================================================================

  /**
   * Get all active funding goals with progress
   */
  async getActiveFundingGoals(): Promise<FundingGoalWithProgress[]> {
    const result = await dbAdapter.query<any>(
      `
      SELECT
        fg.*,
        fp.name as project_name,
        fp.slug as project_slug,
        fp.color as project_color,
        ROUND((fg.current_amount / NULLIF(fg.target_amount, 0)) * 100, 2) as progress_percentage
      FROM funding_goals fg
      LEFT JOIN funding_projects fp ON fg.project_id = fp.id
      WHERE fg.is_active = TRUE
        AND (fg.end_date IS NULL OR fg.end_date >= CURRENT_DATE)
      ORDER BY fg.start_date DESC, fg.created_at DESC
      `,
      [],
      { schema: this.schema }
    );

    return result.rows.map(row => {
      const progress_percentage = parseFloat(row.progress_percentage || 0);
      const days_remaining = calculateDaysRemaining(row.end_date);
      const is_completed = progress_percentage >= 100;

      return {
        id: row.id,
        project_id: row.project_id,
        title: row.title,
        description: row.description,
        target_amount: parseFloat(row.target_amount),
        current_amount: parseFloat(row.current_amount),
        start_date: row.start_date,
        end_date: row.end_date,
        is_active: row.is_active,
        is_recurring: row.is_recurring,
        recurrence_period: row.recurrence_period,
        created_at: row.created_at,
        updated_at: row.updated_at,
        progress_percentage,
        days_remaining,
        is_completed,
        project: row.project_id
          ? {
              id: row.project_id,
              slug: row.project_slug,
              name: row.project_name,
              color: row.project_color,
            }
          : undefined,
      } as FundingGoalWithProgress;
    });
  }

  /**
   * Get all funding goals (admin only)
   * @param includeInactive Whether to include inactive goals
   */
  async getAllFundingGoals(includeInactive: boolean = true): Promise<FundingGoalWithProgress[]> {
    const whereClause = includeInactive ? '' : 'WHERE fg.is_active = TRUE';

    const result = await dbAdapter.query<any>(
      `
      SELECT
        fg.*,
        fp.name as project_name,
        fp.slug as project_slug,
        fp.color as project_color,
        ROUND((fg.current_amount / NULLIF(fg.target_amount, 0)) * 100, 2) as progress_percentage
      FROM funding_goals fg
      LEFT JOIN funding_projects fp ON fg.project_id = fp.id
      ${whereClause}
      ORDER BY fg.created_at DESC
      `,
      [],
      { schema: this.schema }
    );

    return result.rows.map(row => {
      const progress_percentage = parseFloat(row.progress_percentage || 0);
      const days_remaining = calculateDaysRemaining(row.end_date);
      const is_completed = progress_percentage >= 100;

      return {
        id: row.id,
        project_id: row.project_id,
        title: row.title,
        description: row.description,
        target_amount: parseFloat(row.target_amount),
        current_amount: parseFloat(row.current_amount),
        start_date: row.start_date,
        end_date: row.end_date,
        is_active: row.is_active,
        is_recurring: row.is_recurring,
        recurrence_period: row.recurrence_period,
        created_at: row.created_at,
        updated_at: row.updated_at,
        progress_percentage,
        days_remaining,
        is_completed,
        project: row.project_id
          ? {
              id: row.project_id,
              slug: row.project_slug,
              name: row.project_name,
              color: row.project_color,
            }
          : undefined,
      } as FundingGoalWithProgress;
    });
  }

  /**
   * Get funding goal by ID (admin only)
   */
  async getFundingGoalById(goalId: number): Promise<FundingGoalWithProgress | null> {
    const result = await dbAdapter.query<any>(
      `
      SELECT
        fg.*,
        fp.name as project_name,
        fp.slug as project_slug,
        fp.color as project_color,
        ROUND((fg.current_amount / NULLIF(fg.target_amount, 0)) * 100, 2) as progress_percentage
      FROM funding_goals fg
      LEFT JOIN funding_projects fp ON fg.project_id = fp.id
      WHERE fg.id = $1
      `,
      [goalId],
      { schema: this.schema }
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const progress_percentage = parseFloat(row.progress_percentage || 0);
    const days_remaining = calculateDaysRemaining(row.end_date);
    const is_completed = progress_percentage >= 100;

    return {
      id: row.id,
      project_id: row.project_id,
      title: row.title,
      description: row.description,
      target_amount: parseFloat(row.target_amount),
      current_amount: parseFloat(row.current_amount),
      start_date: row.start_date,
      end_date: row.end_date,
      is_active: row.is_active,
      is_recurring: row.is_recurring,
      recurrence_period: row.recurrence_period,
      created_at: row.created_at,
      updated_at: row.updated_at,
      progress_percentage,
      days_remaining,
      is_completed,
      project: row.project_id
        ? {
            id: row.project_id,
            slug: row.project_slug,
            name: row.project_name,
            color: row.project_color,
          }
        : undefined,
    } as FundingGoalWithProgress;
  }

  /**
   * Create funding goal (admin only)
   */
  async createFundingGoal(data: {
    project_id?: number;
    title: string;
    description: string;
    target_amount: number;
    start_date: string;
    end_date?: string | null;
    is_recurring?: boolean;
    recurrence_period?: 'monthly' | 'quarterly' | 'yearly' | null;
  }): Promise<FundingGoal> {
    const result = await dbAdapter.query<FundingGoal>(
      `
      INSERT INTO funding_goals (
        project_id, title, description, target_amount,
        start_date, end_date, is_recurring, recurrence_period
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [
        data.project_id || null,
        data.title,
        data.description,
        data.target_amount,
        data.start_date,
        data.end_date || null,
        data.is_recurring || false,
        data.recurrence_period || null,
      ],
      { schema: this.schema }
    );

    const goal = result.rows[0];
    if (!goal) {
      throw new Error('Failed to create funding goal');
    }

    return goal;
  }

  /**
   * Update funding goal (admin only)
   */
  async updateFundingGoal(goalId: number, data: UpdateFundingGoalDTO): Promise<FundingGoal> {
    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.target_amount !== undefined) {
      updates.push(`target_amount = $${paramIndex++}`);
      values.push(data.target_amount);
    }
    if (data.start_date !== undefined) {
      updates.push(`start_date = $${paramIndex++}`);
      values.push(data.start_date);
    }
    if (data.end_date !== undefined) {
      updates.push(`end_date = $${paramIndex++}`);
      values.push(data.end_date);
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(data.is_active);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    values.push(goalId);

    const result = await dbAdapter.query<FundingGoal>(
      `
      UPDATE funding_goals
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
      `,
      values,
      { schema: this.schema }
    );

    const goal = result.rows[0];
    if (!goal) {
      throw new Error(`Funding goal not found: ${goalId}`);
    }

    return goal;
  }

  /**
   * Delete funding goal (admin only)
   * Soft delete by setting is_active = false
   */
  async deleteFundingGoal(goalId: number): Promise<void> {
    const result = await dbAdapter.query(
      `
      UPDATE funding_goals
      SET is_active = FALSE, updated_at = NOW()
      WHERE id = $1
      RETURNING id
      `,
      [goalId],
      { schema: this.schema }
    );

    if (result.rows.length === 0) {
      throw new Error(`Funding goal not found: ${goalId}`);
    }
  }

  // ==========================================================================
  // DONATIONS
  // ==========================================================================

  /**
   * Create a new donation with multi-project allocation
   *
   * @param data Donation details
   * @param userId Optional user ID (null for anonymous)
   * @returns Created donation with allocations
   */
  async createDonation(data: CreateDonationDTO, userId?: number): Promise<DonationWithAllocations> {
    // Validate amount
    const amountValidation = validateDonationAmount(data.amount);
    if (!amountValidation.valid) {
      throw new Error(amountValidation.errors.join(', '));
    }

    // Validate allocations sum to 100%
    const allocationValidation = validateAllocations(data.allocations);
    if (!allocationValidation.valid) {
      throw new Error(allocationValidation.errors.join(', '));
    }

    return await dbAdapter.transaction(
      async () => {
        // 1. Insert donation record
        const donationResult = await dbAdapter.query<Donation>(
          `
        INSERT INTO donations (
          user_id, amount, currency, payment_processor,
          donor_name, donor_email, is_anonymous, message,
          payment_status, payment_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        `,
          [
            userId || null,
            data.amount,
            data.currency || 'USD',
            data.payment_processor,
            data.donor_name || null,
            data.donor_email || null,
            data.is_anonymous || false,
            data.message || null,
            'pending', // Will be updated via webhook
            data.payment_intent_id || null,
          ],
          { schema: this.schema }
        );

        const donation = donationResult.rows[0];
        if (!donation) {
          throw new Error('Failed to create donation');
        }

        // 2. Insert allocations
        const allocations: DonationAllocation[] = [];

        for (const allocation of data.allocations) {
          const allocationAmount = (data.amount * allocation.percentage) / 100;

          const allocationResult = await dbAdapter.query<DonationAllocation>(
            `
          INSERT INTO donation_allocations (
            donation_id, project_id, amount, percentage
          ) VALUES ($1, $2, $3, $4)
          RETURNING *
          `,
            [donation.id, allocation.project_id, allocationAmount, allocation.percentage],
            { schema: this.schema }
          );

          const allocationRow = allocationResult.rows[0];
          if (!allocationRow) {
            throw new Error('Failed to create allocation');
          }
          allocations.push(allocationRow);

          // 3. Update project current_amount (only when completed)
          // Note: This will be called again in updatePaymentStatus when payment confirms
          // For now, keep it pending until webhook confirms
        }

        return {
          ...donation,
          allocations,
        };
      },
      { schema: this.schema }
    );
  }

  /**
   * Update donation payment status (called by webhook handler)
   *
   * @param paymentId Payment processor's payment ID
   * @param status New payment status
   * @param metadata Optional payment metadata
   */
  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    metadata?: Record<string, any>
  ): Promise<Donation> {
    return await dbAdapter.transaction(
      async () => {
        // 1. Update donation status
        const result = await dbAdapter.query<Donation>(
          `
        UPDATE donations
        SET payment_status = $1::text,
            metadata = $2::jsonb,
            completed_at = CASE WHEN $1::text = 'completed' THEN NOW() ELSE completed_at END,
            updated_at = NOW()
        WHERE payment_id = $3::text
        RETURNING *
        `,
          [status, JSON.stringify(metadata || {}), paymentId],
          { schema: this.schema }
        );

        const donation = result.rows[0];
        if (!donation) {
          throw new Error(`Donation not found for payment ID: ${paymentId}`);
        }

        // 2. Get allocations for this donation
        const allocations = await dbAdapter.query<DonationAllocation>(
          `SELECT * FROM donation_allocations WHERE donation_id = $1`,
          [donation.id],
          { schema: this.schema }
        );

        // 3. Update project totals based on status
        if (status === 'completed') {
          // Add to project totals
          for (const allocation of allocations.rows) {
            await dbAdapter.query(
              `
            UPDATE funding_projects
            SET current_amount = current_amount + $1,
                updated_at = NOW()
            WHERE id = $2
            `,
              [allocation.amount, allocation.project_id],
              { schema: this.schema }
            );
          }

          // Update goal totals (if applicable)
          await this.updateGoalTotals(donation.id);

          // 4. Update supporter badge if user is logged in
          if (donation.user_id) {
            await this.updateSupporterBadgeForUser(donation.user_id);
          }
        } else if (status === 'refunded') {
          // Subtract from project totals
          for (const allocation of allocations.rows) {
            await dbAdapter.query(
              `
            UPDATE funding_projects
            SET current_amount = current_amount - $1,
                updated_at = NOW()
            WHERE id = $2
            `,
              [allocation.amount, allocation.project_id],
              { schema: this.schema }
            );
          }

          // Update goal totals (subtract)
          await this.updateGoalTotals(donation.id, -1);
        }

        return donation;
      },
      { schema: this.schema }
    );
  }

  /**
   * Get user's total lifetime donation amount
   * @param userId User ID
   * @returns Total donation amount in USD
   */
  async getUserTotalDonations(userId: number): Promise<number> {
    const result = await dbAdapter.query<{ total: string }>(
      `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM donations
      WHERE user_id = $1
        AND payment_status = 'completed'
      `,
      [userId],
      { schema: this.schema }
    );

    const row = result.rows[0];
    return row ? parseFloat(row.total) : 0;
  }

  /**
   * Get count of completed donations for a user
   */
  async getDonationCountByUserId(userId: number): Promise<number> {
    const result = await dbAdapter.query<{ count: string }>(
      `
      SELECT COUNT(*) as count
      FROM donations
      WHERE user_id = $1
        AND payment_status = 'completed'
      `,
      [userId],
      { schema: this.schema }
    );

    const row = result.rows[0];
    return row ? parseInt(row.count, 10) : 0;
  }

  /**
   * Update supporter badge for user based on their total donations
   * Called after a donation is completed
   */
  private async updateSupporterBadgeForUser(userId: number): Promise<void> {
    try {
      const totalDonations = await this.getUserTotalDonations(userId);
      if (totalDonations > 0) {
        const badge = await badgeService.updateSupporterBadgeForDonation(userId, totalDonations);
        if (badge) {
          logger.info(
            `Supporter badge "${badge.name}" granted to user ${userId} for $${totalDonations.toFixed(2)} total donations`
          );
        }
      }
    } catch (error) {
      // Log but don't fail the donation - badge is supplementary
      logger.error(`Failed to update supporter badge for user ${userId}:`, error);
    }
  }

  /**
   * Update funding goal totals when donation completed/refunded
   * (Private helper method)
   */
  private async updateGoalTotals(donationId: number, multiplier: number = 1): Promise<void> {
    // Get donation amount
    const donationResult = await dbAdapter.query<Donation>(
      `SELECT amount, created_at FROM donations WHERE id = $1`,
      [donationId],
      { schema: this.schema }
    );

    const donation = donationResult.rows[0];
    if (!donation) return;

    const donationDate = new Date(donation.created_at);

    // Find active goals that this donation should count towards
    const goalsResult = await dbAdapter.query<FundingGoal>(
      `
      SELECT * FROM funding_goals
      WHERE is_active = TRUE
        AND start_date <= $1::date
        AND (end_date IS NULL OR end_date >= $1::date)
      `,
      [donationDate.toISOString().split('T')[0]],
      { schema: this.schema }
    );

    // Update each applicable goal
    for (const goal of goalsResult.rows) {
      await dbAdapter.query(
        `
        UPDATE funding_goals
        SET current_amount = current_amount + $1,
            updated_at = NOW()
        WHERE id = $2
        `,
        [donation.amount * multiplier, goal.id],
        { schema: this.schema }
      );
    }
  }

  /**
   * Get donation with allocations by ID
   */
  async getDonationWithAllocations(donationId: number): Promise<DonationWithAllocations | null> {
    const donationResult = await dbAdapter.query<Donation>(
      `SELECT * FROM donations WHERE id = $1`,
      [donationId],
      { schema: this.schema }
    );

    if (donationResult.rows.length === 0) {
      return null;
    }

    const allocationsResult = await dbAdapter.query<DonationAllocation>(
      `SELECT * FROM donation_allocations WHERE donation_id = $1`,
      [donationId],
      { schema: this.schema }
    );

    const donation = donationResult.rows[0];
    if (!donation) {
      throw new Error(`Donation not found: ${donationId}`);
    }

    return {
      ...donation,
      allocations: allocationsResult.rows,
    };
  }

  /**
   * Get recent donations for public display (last 20)
   */
  async getRecentDonations(limit: number = 20): Promise<DonationSummary[]> {
    const result = await dbAdapter.query<any>(
      `
      SELECT
        d.id,
        CASE
          WHEN d.is_anonymous THEN 'Anonymous'
          WHEN d.donor_name IS NOT NULL THEN d.donor_name
          ELSE 'Anonymous Supporter'
        END as donor_name,
        d.amount,
        d.currency,
        d.message,
        d.created_at,
        ARRAY_AGG(fp.name ORDER BY da.percentage DESC) as project_names
      FROM donations d
      INNER JOIN donation_allocations da ON d.id = da.donation_id
      INNER JOIN funding_projects fp ON da.project_id = fp.id
      WHERE d.payment_status = 'completed'
      GROUP BY d.id, d.donor_name, d.is_anonymous, d.amount, d.currency, d.message, d.created_at
      ORDER BY d.created_at DESC
      LIMIT $1
      `,
      [limit],
      { schema: this.schema }
    );

    return result.rows.map(row => ({
      id: row.id,
      donor_name: row.donor_name,
      amount: parseFloat(row.amount),
      currency: row.currency,
      project_names: row.project_names || [],
      message: row.message,
      created_at: row.created_at,
    }));
  }

  /**
   * Get donation widget data (for initial load)
   */
  async getDonationWidgetData(): Promise<DonationWidgetData> {
    // Get total donations (all time)
    const totalResult = await dbAdapter.query<{ total: string }>(
      `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM donations
      WHERE payment_status = 'completed'
      `,
      [],
      { schema: this.schema }
    );

    // Get this month's total
    const thisMonthResult = await dbAdapter.query<{ total: string }>(
      `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM donations
      WHERE payment_status = 'completed'
        AND EXTRACT(YEAR FROM completed_at) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND EXTRACT(MONTH FROM completed_at) = EXTRACT(MONTH FROM CURRENT_DATE)
      `,
      [],
      { schema: this.schema }
    );

    // Get total unique donors
    const donorsResult = await dbAdapter.query<{ count: string }>(
      `
      SELECT COUNT(DISTINCT COALESCE(user_id, id)) as count
      FROM donations
      WHERE payment_status = 'completed'
      `,
      [],
      { schema: this.schema }
    );

    // Get active goals
    const active_goals = await this.getActiveFundingGoals();

    // Get projects with progress
    const projects = await this.getFundingProjectsWithProgress();

    // Get recent donations
    const recent_donations = await this.getRecentDonations(10);

    // Verify aggregate results exist (should always have rows with COALESCE)
    const totalRow = totalResult.rows[0];
    const donorsRow = donorsResult.rows[0];
    const thisMonthRow = thisMonthResult.rows[0];

    if (!totalRow || !donorsRow || !thisMonthRow) {
      throw new Error('Failed to fetch donation statistics');
    }

    return {
      total_donations: parseFloat(totalRow.total),
      active_goals,
      projects,
      recent_donations,
      stats: {
        total_donors: parseInt(donorsRow.count, 10),
        this_month_raised: parseFloat(thisMonthRow.total),
        active_goal_count: active_goals.length,
      },
    };
  }
}

/**
 * Service for financial transparency
 */
export class TransparencyService {
  private schema = 'donations' as const;

  // ==========================================================================
  // TRANSPARENCY METRICS
  // ==========================================================================

  /**
   * Get comprehensive transparency metrics for dashboard
   */
  async getTransparencyMetrics(): Promise<TransparencyMetrics> {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Parallel queries for performance
    const [
      totalAllTime,
      totalThisYear,
      totalThisMonth,
      expensesThisYear,
      expensesThisMonth,
      monthlyBreakdown,
      expenseBreakdown,
      detailedExpenses,
      projectTotals,
      topDonors,
    ] = await Promise.all([
      this.getTotalDonationsAllTime(),
      this.getTotalDonationsForYear(currentYear),
      this.getTotalDonationsForMonth(currentYear, currentMonth),
      this.getTotalExpensesForYear(currentYear),
      this.getTotalExpensesForMonth(currentYear, currentMonth),
      this.getMonthlyBreakdown(12),
      this.getExpenseBreakdown(currentYear),
      this.getDetailedExpensesByCategory(currentYear),
      this.getProjectTotals(),
      this.getTopDonors(10),
    ]);

    // Calculate tax info based on YTD income (donations - expenses)
    const netThisYear = totalThisYear - expensesThisYear;
    const taxEstimate = estimateAnnualTax(netThisYear > 0 ? netThisYear : 0, currentMonth);
    const quarterlyPaymentInfo = calculateQuarterlyPayment(
      taxEstimate.projectedAnnualIncome > 0 ? taxEstimate.projectedAnnualIncome : 0
    );

    return {
      total_all_time: totalAllTime,
      total_this_year: totalThisYear,
      total_this_month: totalThisMonth,
      total_expenses_this_year: expensesThisYear,
      total_expenses_this_month: expensesThisMonth,
      net_this_year: netThisYear,
      net_this_month: totalThisMonth - expensesThisMonth,
      tax_info: {
        estimated_tax: taxEstimate.estimated.tax,
        effective_rate: taxEstimate.estimated.effectiveRate,
        marginal_bracket: taxEstimate.estimated.marginalBracket.label,
        projected_annual_income: taxEstimate.projectedAnnualIncome,
        quarterly_payment: quarterlyPaymentInfo.quarterlyPayment,
      },
      active_goals: await new DonationService().getActiveFundingGoals(),
      monthly_breakdown: monthlyBreakdown,
      expense_breakdown: expenseBreakdown,
      detailed_expenses: detailedExpenses,
      project_totals: projectTotals,
      top_donors: topDonors,
    };
  }

  /**
   * Get total donations (all time)
   */
  private async getTotalDonationsAllTime(): Promise<number> {
    const result = await dbAdapter.query<{ total: string }>(
      `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM donations
      WHERE payment_status = 'completed'
      `,
      [],
      { schema: this.schema }
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to fetch total donations (all time)');
    }

    return parseFloat(row.total);
  }

  /**
   * Get total donations for a specific year
   */
  private async getTotalDonationsForYear(year: number): Promise<number> {
    const result = await dbAdapter.query<{ total: string }>(
      `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM donations
      WHERE payment_status = 'completed'
        AND EXTRACT(YEAR FROM completed_at) = $1
      `,
      [year],
      { schema: this.schema }
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error(`Failed to fetch total donations for year: ${year}`);
    }

    return parseFloat(row.total);
  }

  /**
   * Get total donations for a specific month
   */
  private async getTotalDonationsForMonth(year: number, month: number): Promise<number> {
    const result = await dbAdapter.query<{ total: string }>(
      `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM donations
      WHERE payment_status = 'completed'
        AND EXTRACT(YEAR FROM completed_at) = $1
        AND EXTRACT(MONTH FROM completed_at) = $2
      `,
      [year, month],
      { schema: this.schema }
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error(`Failed to fetch total donations for ${year}-${month}`);
    }

    return parseFloat(row.total);
  }

  /**
   * Get total expenses for a specific year
   */
  private async getTotalExpensesForYear(year: number): Promise<number> {
    const result = await dbAdapter.query<{ total: string }>(
      `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE EXTRACT(YEAR FROM expense_date) = $1
      `,
      [year],
      { schema: this.schema }
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error(`Failed to fetch total expenses for year: ${year}`);
    }

    return parseFloat(row.total);
  }

  /**
   * Get total expenses for a specific month
   */
  private async getTotalExpensesForMonth(year: number, month: number): Promise<number> {
    const result = await dbAdapter.query<{ total: string }>(
      `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE EXTRACT(YEAR FROM expense_date) = $1
        AND EXTRACT(MONTH FROM expense_date) = $2
      `,
      [year, month],
      { schema: this.schema }
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error(`Failed to fetch total expenses for ${year}-${month}`);
    }

    return parseFloat(row.total);
  }

  /**
   * Get monthly breakdown for last N months
   */
  private async getMonthlyBreakdown(months: number = 12): Promise<MonthlySummaryDisplay[]> {
    // Database row type - PostgreSQL NUMERIC columns come back as strings
    interface MonthlySummaryRow {
      id: number;
      year: number;
      month: number;
      total_donations: string | number;
      total_expenses: string | number;
      net_amount: string | number;
      donation_count: number;
      expense_count: number;
      is_finalized: boolean;
      created_at: string;
      updated_at: string;
    }

    const result = await dbAdapter.query<MonthlySummaryRow>(
      `
      SELECT *
      FROM monthly_summaries
      ORDER BY year DESC, month DESC
      LIMIT $1
      `,
      [months],
      { schema: this.schema }
    );

    return result.rows.map(row => {
      const { full, abbr } = formatMonth(row.year, row.month);
      return {
        ...row,
        month_name: full,
        month_abbr: abbr,
        total_donations: parseFloat(String(row.total_donations)),
        total_expenses: parseFloat(String(row.total_expenses)),
        net_amount: parseFloat(String(row.net_amount)),
      };
    });
  }

  /**
   * Get expense breakdown by category (aggregated)
   */
  private async getExpenseBreakdown(year: number): Promise<ExpenseCategoryBreakdown[]> {
    const result = await dbAdapter.query<any>(
      `
      SELECT
        ec.id,
        ec.name,
        ec.slug,
        ec.description,
        ec.color,
        ec.icon,
        ec.display_order,
        ec.is_active,
        ec.created_at,
        COALESCE(SUM(e.amount), 0) as total,
        COUNT(e.id) as count,
        ROUND(
          (COALESCE(SUM(e.amount), 0) / NULLIF(
            (SELECT SUM(amount) FROM expenses WHERE EXTRACT(YEAR FROM expense_date) = $1),
            0
          )) * 100,
          2
        ) as percentage
      FROM expense_categories ec
      LEFT JOIN expenses e ON ec.id = e.category_id
        AND EXTRACT(YEAR FROM e.expense_date) = $1
      WHERE ec.is_active = TRUE
      GROUP BY ec.id, ec.name, ec.slug, ec.description, ec.color, ec.icon, ec.display_order, ec.is_active, ec.created_at
      ORDER BY total DESC
      `,
      [year],
      { schema: this.schema }
    );

    return result.rows.map(row => ({
      category: {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        color: row.color,
        icon: row.icon,
        display_order: row.display_order,
        is_active: row.is_active,
        created_at: row.created_at,
      },
      total: parseFloat(row.total),
      percentage: parseFloat(row.percentage || 0),
      count: parseInt(row.count, 10),
    }));
  }

  /**
   * Get detailed expenses by category with individual line items
   * For 3-tier transparency view: Category > Line Items
   */
  private async getDetailedExpensesByCategory(year: number): Promise<ExpenseCategoryWithItems[]> {
    // First get the category breakdown
    const breakdown = await this.getExpenseBreakdown(year);

    // Then fetch all expenses for the year
    const expensesResult = await dbAdapter.query<any>(
      `
      SELECT
        e.id,
        e.category_id,
        e.description,
        e.amount,
        e.expense_date,
        e.is_recurring,
        e.recurrence_period
      FROM expenses e
      WHERE EXTRACT(YEAR FROM e.expense_date) = $1
      ORDER BY e.expense_date DESC
      `,
      [year],
      { schema: this.schema }
    );

    // Group expenses by category
    const expensesByCategory = new Map<number, ExpenseLineItem[]>();
    for (const row of expensesResult.rows) {
      const categoryId = row.category_id;
      if (!expensesByCategory.has(categoryId)) {
        expensesByCategory.set(categoryId, []);
      }
      expensesByCategory.get(categoryId)!.push({
        id: row.id,
        description: row.description,
        amount: parseFloat(row.amount),
        expense_date: row.expense_date,
        is_recurring: row.is_recurring,
        recurrence_period: row.recurrence_period,
      });
    }

    // Combine breakdown with items
    return breakdown.map(cat => ({
      ...cat,
      items: expensesByCategory.get(cat.category.id) || [],
    }));
  }

  /**
   * Get project funding totals
   */
  private async getProjectTotals(): Promise<ProjectFundingTotal[]> {
    const result = await dbAdapter.query<any>(
      `
      SELECT
        fp.*,
        fp.current_amount as total_raised,
        COUNT(DISTINCT da.donation_id) FILTER (WHERE d.payment_status = 'completed') as donor_count,
        COALESCE(AVG(d.amount) FILTER (WHERE d.payment_status = 'completed'), 0) as avg_donation
      FROM funding_projects fp
      LEFT JOIN donation_allocations da ON fp.id = da.project_id
      LEFT JOIN donations d ON da.donation_id = d.id
      WHERE fp.is_active = TRUE
      GROUP BY fp.id
      ORDER BY total_raised DESC
      `,
      [],
      { schema: this.schema }
    );

    return result.rows.map(row => ({
      project: {
        id: row.id,
        project_id: row.project_id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        color: row.color,
        target_amount: row.target_amount ? parseFloat(row.target_amount) : null,
        current_amount: parseFloat(row.current_amount),
        display_order: row.display_order,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      total_raised: parseFloat(row.total_raised),
      donor_count: parseInt(row.donor_count, 10),
      avg_donation: parseFloat(row.avg_donation),
    }));
  }

  /**
   * Get top donors (public, non-anonymous only)
   */
  private async getTopDonors(limit: number = 10): Promise<TopDonor[]> {
    const result = await dbAdapter.query<any>(
      `
      SELECT
        COALESCE(donor_name, 'Anonymous Supporter') as name,
        SUM(amount) as total,
        COUNT(*) as donation_count,
        MIN(created_at) as first_donation
      FROM donations
      WHERE payment_status = 'completed'
        AND is_anonymous = FALSE
        AND donor_name IS NOT NULL
      GROUP BY donor_name
      ORDER BY total DESC
      LIMIT $1
      `,
      [limit],
      { schema: this.schema }
    );

    return result.rows.map(row => ({
      name: row.name,
      total: parseFloat(row.total),
      donation_count: parseInt(row.donation_count, 10),
      first_donation: row.first_donation,
    }));
  }

  // ==========================================================================
  // EXPENSE MANAGEMENT (Admin Only)
  // ==========================================================================

  /**
   * Create a new expense (admin only)
   */
  async createExpense(data: CreateExpenseDTO): Promise<Expense> {
    const result = await dbAdapter.query<Expense>(
      `
      INSERT INTO expenses (
        category_id, project_id, amount, currency,
        description, receipt_url, expense_date,
        is_recurring, recurrence_period
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        data.category_id,
        data.project_id || null,
        data.amount,
        data.currency || 'USD',
        data.description,
        data.receipt_url || null,
        data.expense_date,
        data.is_recurring || false,
        data.recurrence_period || null,
      ],
      { schema: this.schema }
    );

    // Update monthly summary
    const expenseDate = new Date(data.expense_date);
    await this.updateMonthlySummary(expenseDate.getFullYear(), expenseDate.getMonth() + 1);

    const expense = result.rows[0];
    if (!expense) {
      throw new Error('Failed to create expense');
    }

    return expense;
  }

  /**
   * Update monthly summary (called after donations/expenses change)
   */
  private async updateMonthlySummary(year: number, month: number): Promise<void> {
    // Calculate totals for the month
    const donationsTotal = await this.getTotalDonationsForMonth(year, month);
    const expensesTotal = await this.getTotalExpensesForMonth(year, month);

    // Get counts
    const donationCountResult = await dbAdapter.query<{ count: string }>(
      `
      SELECT COUNT(*) as count
      FROM donations
      WHERE payment_status = 'completed'
        AND EXTRACT(YEAR FROM completed_at) = $1
        AND EXTRACT(MONTH FROM completed_at) = $2
      `,
      [year, month],
      { schema: this.schema }
    );

    const expenseCountResult = await dbAdapter.query<{ count: string }>(
      `
      SELECT COUNT(*) as count
      FROM expenses
      WHERE EXTRACT(YEAR FROM expense_date) = $1
        AND EXTRACT(MONTH FROM expense_date) = $2
      `,
      [year, month],
      { schema: this.schema }
    );

    // Verify count results exist
    const donationCountRow = donationCountResult.rows[0];
    const expenseCountRow = expenseCountResult.rows[0];

    if (!donationCountRow || !expenseCountRow) {
      throw new Error(`Failed to fetch counts for monthly summary ${year}-${month}`);
    }

    // Upsert monthly summary
    await dbAdapter.query(
      `
      INSERT INTO monthly_summaries (
        year, month, total_donations, total_expenses, net_amount,
        donation_count, expense_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (year, month) DO UPDATE SET
        total_donations = EXCLUDED.total_donations,
        total_expenses = EXCLUDED.total_expenses,
        net_amount = EXCLUDED.net_amount,
        donation_count = EXCLUDED.donation_count,
        expense_count = EXCLUDED.expense_count,
        updated_at = NOW()
      `,
      [
        year,
        month,
        donationsTotal,
        expensesTotal,
        donationsTotal - expensesTotal,
        parseInt(donationCountRow.count, 10),
        parseInt(expenseCountRow.count, 10),
      ],
      { schema: this.schema }
    );
  }

  /**
   * Get all expenses (admin only)
   * @param filters Optional filters for category, project, year
   */
  async getAllExpenses(filters?: {
    category_id?: number;
    project_id?: number;
    year?: number;
  }): Promise<ExpenseWithCategory[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.category_id) {
      conditions.push(`e.category_id = $${paramIndex++}`);
      values.push(filters.category_id);
    }

    if (filters?.project_id) {
      conditions.push(`e.project_id = $${paramIndex++}`);
      values.push(filters.project_id);
    }

    if (filters?.year) {
      conditions.push(`EXTRACT(YEAR FROM e.expense_date) = $${paramIndex++}`);
      values.push(filters.year);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await dbAdapter.query<any>(
      `
      SELECT
        e.*,
        ec.name as category_name,
        ec.slug as category_slug,
        ec.description as category_description,
        ec.color as category_color,
        ec.icon as category_icon,
        ec.display_order as category_display_order,
        ec.is_active as category_is_active,
        ec.created_at as category_created_at,
        fp.name as project_name,
        fp.slug as project_slug,
        fp.color as project_color
      FROM expenses e
      INNER JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN funding_projects fp ON e.project_id = fp.id
      ${whereClause}
      ORDER BY e.expense_date DESC, e.created_at DESC
      `,
      values,
      { schema: this.schema }
    );

    return result.rows.map(row => ({
      id: row.id,
      category_id: row.category_id,
      project_id: row.project_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      description: row.description,
      receipt_url: row.receipt_url,
      expense_date: row.expense_date,
      is_recurring: row.is_recurring,
      recurrence_period: row.recurrence_period,
      metadata: row.metadata || {},
      created_at: row.created_at,
      updated_at: row.updated_at,
      category: {
        id: row.category_id,
        name: row.category_name,
        slug: row.category_slug,
        description: row.category_description,
        color: row.category_color,
        icon: row.category_icon,
        display_order: row.category_display_order,
        is_active: row.category_is_active,
        created_at: row.category_created_at,
      },
      project: row.project_id
        ? {
            id: row.project_id,
            project_id: row.project_id,
            slug: row.project_slug,
            name: row.project_name,
            description: '',
            color: row.project_color,
            target_amount: null,
            current_amount: 0,
            display_order: 0,
            is_active: true,
            created_at: '',
            updated_at: '',
          }
        : undefined,
    }));
  }

  /**
   * Get expense by ID (admin only)
   */
  async getExpenseById(expenseId: number): Promise<ExpenseWithCategory | null> {
    const result = await dbAdapter.query<any>(
      `
      SELECT
        e.*,
        ec.name as category_name,
        ec.slug as category_slug,
        ec.description as category_description,
        ec.color as category_color,
        ec.icon as category_icon,
        ec.display_order as category_display_order,
        ec.is_active as category_is_active,
        ec.created_at as category_created_at,
        fp.name as project_name,
        fp.slug as project_slug,
        fp.color as project_color
      FROM expenses e
      INNER JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN funding_projects fp ON e.project_id = fp.id
      WHERE e.id = $1
      `,
      [expenseId],
      { schema: this.schema }
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      category_id: row.category_id,
      project_id: row.project_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      description: row.description,
      receipt_url: row.receipt_url,
      expense_date: row.expense_date,
      is_recurring: row.is_recurring,
      recurrence_period: row.recurrence_period,
      metadata: row.metadata || {},
      created_at: row.created_at,
      updated_at: row.updated_at,
      category: {
        id: row.category_id,
        name: row.category_name,
        slug: row.category_slug,
        description: row.category_description,
        color: row.category_color,
        icon: row.category_icon,
        display_order: row.category_display_order,
        is_active: row.category_is_active,
        created_at: row.category_created_at,
      },
      project: row.project_id
        ? {
            id: row.project_id,
            project_id: row.project_id,
            slug: row.project_slug,
            name: row.project_name,
            description: '',
            color: row.project_color,
            target_amount: null,
            current_amount: 0,
            display_order: 0,
            is_active: true,
            created_at: '',
            updated_at: '',
          }
        : undefined,
    };
  }

  /**
   * Update expense (admin only)
   */
  async updateExpense(
    expenseId: number,
    data: {
      category_id?: number;
      project_id?: number | null;
      amount?: number;
      description?: string;
      receipt_url?: string | null;
      expense_date?: string;
      is_recurring?: boolean;
      recurrence_period?: 'monthly' | 'yearly' | null;
    }
  ): Promise<Expense> {
    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.category_id !== undefined) {
      updates.push(`category_id = $${paramIndex++}`);
      values.push(data.category_id);
    }
    if (data.project_id !== undefined) {
      updates.push(`project_id = $${paramIndex++}`);
      values.push(data.project_id);
    }
    if (data.amount !== undefined) {
      updates.push(`amount = $${paramIndex++}`);
      values.push(data.amount);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.receipt_url !== undefined) {
      updates.push(`receipt_url = $${paramIndex++}`);
      values.push(data.receipt_url);
    }
    if (data.expense_date !== undefined) {
      updates.push(`expense_date = $${paramIndex++}`);
      values.push(data.expense_date);
    }
    if (data.is_recurring !== undefined) {
      updates.push(`is_recurring = $${paramIndex++}`);
      values.push(data.is_recurring);
    }
    if (data.recurrence_period !== undefined) {
      updates.push(`recurrence_period = $${paramIndex++}`);
      values.push(data.recurrence_period);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    values.push(expenseId);

    const result = await dbAdapter.query<Expense>(
      `
      UPDATE expenses
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
      `,
      values,
      { schema: this.schema }
    );

    const expense = result.rows[0];
    if (!expense) {
      throw new Error(`Expense not found: ${expenseId}`);
    }

    // Update monthly summary if expense_date changed
    if (data.expense_date) {
      const expenseDate = new Date(data.expense_date);
      await this.updateMonthlySummary(expenseDate.getFullYear(), expenseDate.getMonth() + 1);
    }

    return expense;
  }

  /**
   * Delete expense (admin only)
   * Hard delete since expenses don't need soft delete
   */
  async deleteExpense(expenseId: number): Promise<void> {
    const result = await dbAdapter.query<Expense>(
      `DELETE FROM expenses WHERE id = $1 RETURNING *`,
      [expenseId],
      { schema: this.schema }
    );

    if (result.rows.length === 0) {
      throw new Error(`Expense not found: ${expenseId}`);
    }

    // Update monthly summary
    const expense = result.rows[0];
    if (expense) {
      const expenseDate = new Date(expense.expense_date);
      await this.updateMonthlySummary(expenseDate.getFullYear(), expenseDate.getMonth() + 1);
    }
  }

  /**
   * Get expense categories
   */
  async getExpenseCategories(): Promise<ExpenseCategory[]> {
    const result = await dbAdapter.query<ExpenseCategory>(
      `
      SELECT * FROM expense_categories
      WHERE is_active = TRUE
      ORDER BY display_order ASC
      `,
      [],
      { schema: this.schema }
    );

    return result.rows;
  }

  // ==========================================================================
  // EXPENSE CATEGORY CRUD (Admin)
  // ==========================================================================

  /**
   * Get all expense categories (including inactive)
   */
  async getAllExpenseCategories(): Promise<ExpenseCategory[]> {
    const result = await dbAdapter.query<ExpenseCategory>(
      `
      SELECT * FROM expense_categories
      ORDER BY display_order ASC, name ASC
      `,
      [],
      { schema: this.schema }
    );

    return result.rows;
  }

  /**
   * Get expense category by ID
   */
  async getExpenseCategoryById(id: number): Promise<ExpenseCategory | null> {
    const result = await dbAdapter.query<ExpenseCategory>(
      `SELECT * FROM expense_categories WHERE id = $1`,
      [id],
      { schema: this.schema }
    );

    return result.rows[0] || null;
  }

  /**
   * Create expense category
   */
  async createExpenseCategory(data: {
    name: string;
    slug: string;
    description?: string;
    color?: string;
    icon?: string;
    display_order?: number;
  }): Promise<ExpenseCategory> {
    // Generate slug if not provided
    const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, '-');

    const result = await dbAdapter.query<ExpenseCategory>(
      `
      INSERT INTO expense_categories (name, slug, description, color, icon, display_order)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        data.name,
        slug,
        data.description || null,
        data.color || '#64748b',
        data.icon || null,
        data.display_order ?? 0,
      ],
      { schema: this.schema }
    );

    const category = result.rows[0];
    if (!category) {
      throw new Error('Failed to create expense category');
    }

    return category;
  }

  /**
   * Update expense category
   */
  async updateExpenseCategory(
    id: number,
    data: Partial<{
      name: string;
      slug: string;
      description: string;
      color: string;
      icon: string;
      display_order: number;
      is_active: boolean;
    }>
  ): Promise<ExpenseCategory> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.slug !== undefined) {
      updateFields.push(`slug = $${paramIndex++}`);
      values.push(data.slug);
    }
    if (data.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.color !== undefined) {
      updateFields.push(`color = $${paramIndex++}`);
      values.push(data.color);
    }
    if (data.icon !== undefined) {
      updateFields.push(`icon = $${paramIndex++}`);
      values.push(data.icon);
    }
    if (data.display_order !== undefined) {
      updateFields.push(`display_order = $${paramIndex++}`);
      values.push(data.display_order);
    }
    if (data.is_active !== undefined) {
      updateFields.push(`is_active = $${paramIndex++}`);
      values.push(data.is_active);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);

    const result = await dbAdapter.query<ExpenseCategory>(
      `
      UPDATE expense_categories
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
      `,
      values,
      { schema: this.schema }
    );

    const category = result.rows[0];
    if (!category) {
      throw new Error(`Expense category not found: ${id}`);
    }

    return category;
  }

  /**
   * Delete expense category
   * Note: Will fail if category has expenses (due to foreign key constraint)
   */
  async deleteExpenseCategory(id: number): Promise<void> {
    // Check if category has expenses
    const expenseCount = await dbAdapter.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM expenses WHERE category_id = $1`,
      [id],
      { schema: this.schema }
    );

    if (parseInt(expenseCount.rows[0]?.count || '0', 10) > 0) {
      throw new Error('Cannot delete category with existing expenses. Deactivate it instead.');
    }

    const result = await dbAdapter.query(`DELETE FROM expense_categories WHERE id = $1`, [id], {
      schema: this.schema,
    });

    if (result.rowCount === 0) {
      throw new Error(`Expense category not found: ${id}`);
    }
  }

  /**
   * Reorder expense categories
   * Updates display_order for multiple categories at once
   */
  async reorderExpenseCategories(
    categoryOrders: Array<{ id: number; display_order: number }>
  ): Promise<void> {
    // Use a transaction-like approach (PostgreSQL)
    for (const item of categoryOrders) {
      await dbAdapter.query(
        `UPDATE expense_categories SET display_order = $1 WHERE id = $2`,
        [item.display_order, item.id],
        { schema: this.schema }
      );
    }
  }
}

// Export singleton instances
export const donationService = new DonationService();
export const transparencyService = new TransparencyService();
