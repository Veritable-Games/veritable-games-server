/**
 * Subscription Service
 *
 * Handles recurring donation subscriptions including:
 * - Subscription lifecycle management (create, update, cancel)
 * - Recording recurring payments from Stripe webhooks
 * - Portal access tokens for guest subscription management
 * - Stripe Customer Portal integration
 */

import { randomBytes } from 'crypto';
import { dbAdapter } from '@/lib/database/adapter';
import { donationService } from './service';
import { logger } from '@/lib/utils/logger';
import type {
  Subscription,
  SubscriptionWithProject,
  CreateSubscriptionDTO,
  UpdateSubscriptionDTO,
  RecurringPaymentDTO,
  SubscriptionStatus,
  PortalAccessToken,
  SubscriptionId,
  DonationWithAllocations,
  ProjectId,
  Currency,
} from './types';

// Portal access token expiry (24 hours)
const PORTAL_TOKEN_EXPIRY_HOURS = 24;

/**
 * Service for managing recurring donation subscriptions
 */
export class SubscriptionService {
  private schema = 'donations' as const;

  // ==========================================================================
  // SUBSCRIPTION CRUD
  // ==========================================================================

  /**
   * Create a new subscription (called from Stripe webhook)
   */
  async createSubscription(data: CreateSubscriptionDTO): Promise<Subscription> {
    const result = await dbAdapter.query<Subscription>(
      `
      INSERT INTO subscriptions (
        stripe_subscription_id,
        stripe_customer_id,
        donor_email,
        donor_name,
        user_id,
        project_id,
        amount,
        currency,
        interval,
        status,
        current_period_start,
        current_period_end
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
      `,
      [
        data.stripeSubscriptionId,
        data.stripeCustomerId,
        data.donorEmail,
        data.donorName || null,
        data.userId || null,
        data.projectId || null,
        data.amount,
        data.currency || 'USD',
        data.interval || 'month',
        data.status,
        data.currentPeriodStart.toISOString(),
        data.currentPeriodEnd.toISOString(),
      ],
      { schema: this.schema }
    );

    const subscription = result.rows[0];
    if (!subscription) {
      throw new Error('Failed to create subscription');
    }
    return subscription;
  }

  /**
   * Update subscription status (from Stripe webhook)
   */
  async updateSubscriptionStatus(
    stripeSubscriptionId: string,
    status: SubscriptionStatus,
    metadata?: UpdateSubscriptionDTO
  ): Promise<void> {
    const updateFields: string[] = ['status = $2', 'updated_at = NOW()'];
    const params: any[] = [stripeSubscriptionId, status];
    let paramIndex = 3;

    if (metadata?.canceledAt !== undefined) {
      updateFields.push(`canceled_at = $${paramIndex}`);
      params.push(metadata.canceledAt ? metadata.canceledAt.toISOString() : null);
      paramIndex++;
    }

    if (metadata?.currentPeriodStart) {
      updateFields.push(`current_period_start = $${paramIndex}`);
      params.push(metadata.currentPeriodStart.toISOString());
      paramIndex++;
    }

    if (metadata?.currentPeriodEnd) {
      updateFields.push(`current_period_end = $${paramIndex}`);
      params.push(metadata.currentPeriodEnd.toISOString());
      paramIndex++;
    }

    await dbAdapter.query(
      `
      UPDATE subscriptions
      SET ${updateFields.join(', ')}
      WHERE stripe_subscription_id = $1
      `,
      params,
      { schema: this.schema }
    );
  }

  /**
   * Get subscription by Stripe subscription ID
   */
  async getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null> {
    const result = await dbAdapter.query<Subscription>(
      `SELECT * FROM subscriptions WHERE stripe_subscription_id = $1`,
      [stripeSubscriptionId],
      { schema: this.schema }
    );

    return result.rows[0] || null;
  }

  /**
   * Get subscription by ID
   */
  async getSubscriptionById(id: SubscriptionId): Promise<SubscriptionWithProject | null> {
    const result = await dbAdapter.query<any>(
      `
      SELECT
        s.*,
        fp.name as project_name,
        fp.slug as project_slug,
        fp.color as project_color,
        fp.description as project_description
      FROM subscriptions s
      LEFT JOIN funding_projects fp ON s.project_id = fp.id
      WHERE s.id = $1
      `,
      [id],
      { schema: this.schema }
    );

    if (!result.rows[0]) return null;

    const row = result.rows[0];
    return {
      ...row,
      project: row.project_name
        ? {
            id: row.project_id,
            name: row.project_name,
            slug: row.project_slug,
            color: row.project_color,
            description: row.project_description,
          }
        : null,
    };
  }

  /**
   * Get all subscriptions for an email address
   */
  async getSubscriptionsByEmail(email: string): Promise<SubscriptionWithProject[]> {
    const result = await dbAdapter.query<any>(
      `
      SELECT
        s.*,
        fp.name as project_name,
        fp.slug as project_slug,
        fp.color as project_color
      FROM subscriptions s
      LEFT JOIN funding_projects fp ON s.project_id = fp.id
      WHERE LOWER(s.donor_email) = LOWER($1)
      ORDER BY s.created_at DESC
      `,
      [email],
      { schema: this.schema }
    );

    return result.rows.map(row => ({
      ...row,
      project: row.project_name
        ? {
            id: row.project_id,
            name: row.project_name,
            slug: row.project_slug,
            color: row.project_color,
          }
        : null,
    }));
  }

  /**
   * Get all subscriptions for a user ID
   */
  async getSubscriptionsByUserId(userId: number): Promise<SubscriptionWithProject[]> {
    const result = await dbAdapter.query<any>(
      `
      SELECT
        s.*,
        fp.name as project_name,
        fp.slug as project_slug,
        fp.color as project_color
      FROM subscriptions s
      LEFT JOIN funding_projects fp ON s.project_id = fp.id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
      `,
      [userId],
      { schema: this.schema }
    );

    return result.rows.map(row => ({
      ...row,
      project: row.project_name
        ? {
            id: row.project_id,
            name: row.project_name,
            slug: row.project_slug,
            color: row.project_color,
          }
        : null,
    }));
  }

  /**
   * Get active subscriptions count
   */
  async getActiveSubscriptionCount(): Promise<number> {
    const result = await dbAdapter.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'`,
      [],
      { schema: this.schema }
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  }

  // ==========================================================================
  // RECURRING PAYMENTS
  // ==========================================================================

  /**
   * Record a recurring payment (from invoice.payment_succeeded webhook)
   * Creates a new donation record linked to the subscription
   */
  async recordRecurringPayment(data: RecurringPaymentDTO): Promise<DonationWithAllocations | null> {
    // Get the subscription
    const subscription = await this.getSubscriptionByStripeId(data.stripeSubscriptionId);
    if (!subscription) {
      logger.error(`[SubscriptionService] Subscription not found: ${data.stripeSubscriptionId}`);
      return null;
    }

    // Create donation record for this recurring payment
    const donationResult = await dbAdapter.query<any>(
      `
      INSERT INTO donations (
        user_id,
        amount,
        currency,
        payment_processor,
        payment_id,
        payment_status,
        donor_name,
        donor_email,
        is_anonymous,
        stripe_subscription_id,
        stripe_customer_id,
        is_recurring,
        subscription_status,
        metadata,
        completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
      `,
      [
        subscription.user_id,
        data.amount,
        data.currency,
        'stripe',
        data.stripeInvoiceId,
        'completed',
        subscription.donor_name,
        subscription.donor_email,
        false,
        data.stripeSubscriptionId,
        subscription.stripe_customer_id,
        true,
        subscription.status,
        JSON.stringify({
          recurring: true,
          invoiceId: data.stripeInvoiceId,
          subscriptionId: data.stripeSubscriptionId,
        }),
        data.paidAt.toISOString(),
      ],
      { schema: this.schema }
    );

    const donation = donationResult.rows[0];

    // Create allocation if project is specified
    if (subscription.project_id) {
      await dbAdapter.query(
        `
        INSERT INTO donation_allocations (donation_id, project_id, amount, percentage)
        VALUES ($1, $2, $3, 100)
        `,
        [donation.id, subscription.project_id, data.amount],
        { schema: this.schema }
      );

      // Update funding project totals
      await dbAdapter.query(
        `
        UPDATE funding_projects
        SET current_amount = current_amount + $1,
            updated_at = NOW()
        WHERE id = $2
        `,
        [data.amount, subscription.project_id],
        { schema: this.schema }
      );
    }

    // Update monthly summary
    const now = new Date();
    await this.updateMonthlySummary(now.getFullYear(), now.getMonth() + 1);

    // Return donation with allocations
    return donationService.getDonationWithAllocations(donation.id);
  }

  /**
   * Update monthly summary table
   */
  private async updateMonthlySummary(year: number, month: number): Promise<void> {
    await dbAdapter.query(
      `
      INSERT INTO monthly_summaries (year, month, total_donations, total_expenses, net_amount, donation_count, expense_count)
      SELECT
        $1 as year,
        $2 as month,
        COALESCE(SUM(d.amount), 0) as total_donations,
        COALESCE((SELECT SUM(amount) FROM expenses WHERE EXTRACT(YEAR FROM expense_date) = $1 AND EXTRACT(MONTH FROM expense_date) = $2), 0) as total_expenses,
        COALESCE(SUM(d.amount), 0) - COALESCE((SELECT SUM(amount) FROM expenses WHERE EXTRACT(YEAR FROM expense_date) = $1 AND EXTRACT(MONTH FROM expense_date) = $2), 0) as net_amount,
        COUNT(d.id) as donation_count,
        COALESCE((SELECT COUNT(*) FROM expenses WHERE EXTRACT(YEAR FROM expense_date) = $1 AND EXTRACT(MONTH FROM expense_date) = $2), 0) as expense_count
      FROM donations d
      WHERE d.payment_status = 'completed'
        AND EXTRACT(YEAR FROM d.completed_at) = $1
        AND EXTRACT(MONTH FROM d.completed_at) = $2
      ON CONFLICT (year, month)
      DO UPDATE SET
        total_donations = EXCLUDED.total_donations,
        total_expenses = EXCLUDED.total_expenses,
        net_amount = EXCLUDED.net_amount,
        donation_count = EXCLUDED.donation_count,
        expense_count = EXCLUDED.expense_count,
        updated_at = NOW()
      `,
      [year, month],
      { schema: this.schema }
    );
  }

  // ==========================================================================
  // PORTAL ACCESS (Magic Links for Guest Management)
  // ==========================================================================

  /**
   * Generate a portal access token for a subscription
   * Used to let guests manage their subscriptions via magic link
   */
  async generatePortalAccessToken(subscriptionId: SubscriptionId): Promise<PortalAccessToken> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + PORTAL_TOKEN_EXPIRY_HOURS);

    await dbAdapter.query(
      `
      UPDATE subscriptions
      SET portal_access_token = $1,
          portal_access_expires_at = $2,
          updated_at = NOW()
      WHERE id = $3
      `,
      [token, expiresAt.toISOString(), subscriptionId],
      { schema: this.schema }
    );

    return {
      token,
      expiresAt,
      subscriptionId,
    };
  }

  /**
   * Validate a portal access token
   * Returns the subscription if valid, null otherwise
   */
  async validatePortalToken(token: string): Promise<SubscriptionWithProject | null> {
    const result = await dbAdapter.query<any>(
      `
      SELECT
        s.*,
        fp.name as project_name,
        fp.slug as project_slug,
        fp.color as project_color
      FROM subscriptions s
      LEFT JOIN funding_projects fp ON s.project_id = fp.id
      WHERE s.portal_access_token = $1
        AND s.portal_access_expires_at > NOW()
      `,
      [token],
      { schema: this.schema }
    );

    if (!result.rows[0]) return null;

    // Invalidate token after use (one-time use)
    await dbAdapter.query(
      `
      UPDATE subscriptions
      SET portal_access_token = NULL,
          portal_access_expires_at = NULL,
          updated_at = NOW()
      WHERE portal_access_token = $1
      `,
      [token],
      { schema: this.schema }
    );

    const row = result.rows[0];
    return {
      ...row,
      project: row.project_name
        ? {
            id: row.project_id,
            name: row.project_name,
            slug: row.project_slug,
            color: row.project_color,
          }
        : null,
    };
  }

  /**
   * Generate a Stripe Customer Portal session URL
   * Requires Stripe SDK to be configured
   */
  async createStripePortalSession(
    stripeCustomerId: string,
    returnUrl: string
  ): Promise<string | null> {
    try {
      // Dynamically import Stripe to avoid issues if not configured
      const Stripe = (await import('stripe')).default;
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

      if (!stripeSecretKey) {
        logger.error('[SubscriptionService] STRIPE_SECRET_KEY not configured');
        return null;
      }

      const stripe = new Stripe(stripeSecretKey);

      const session = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: returnUrl,
      });

      return session.url;
    } catch (error) {
      logger.error('[SubscriptionService] Error creating Stripe portal session:', error);
      return null;
    }
  }

  // ==========================================================================
  // DONATION HISTORY (for Donor Dashboard)
  // ==========================================================================

  /**
   * Get donation history for an email address
   * Includes both one-time and recurring donations
   */
  async getDonationHistoryByEmail(
    email: string,
    limit: number = 50
  ): Promise<DonationWithAllocations[]> {
    const result = await dbAdapter.query<any>(
      `
      SELECT
        d.*,
        json_agg(
          json_build_object(
            'id', da.id,
            'project_id', da.project_id,
            'amount', da.amount,
            'percentage', da.percentage,
            'project_name', fp.name,
            'project_color', fp.color
          )
        ) FILTER (WHERE da.id IS NOT NULL) as allocations
      FROM donations d
      LEFT JOIN donation_allocations da ON d.id = da.donation_id
      LEFT JOIN funding_projects fp ON da.project_id = fp.id
      WHERE LOWER(d.donor_email) = LOWER($1)
        AND d.payment_status = 'completed'
      GROUP BY d.id
      ORDER BY d.completed_at DESC
      LIMIT $2
      `,
      [email, limit],
      { schema: this.schema }
    );

    return result.rows.map(row => ({
      ...row,
      allocations: row.allocations || [],
    }));
  }

  /**
   * Get donation history for a user ID
   */
  async getDonationHistoryByUserId(
    userId: number,
    limit: number = 50
  ): Promise<DonationWithAllocations[]> {
    const result = await dbAdapter.query<any>(
      `
      SELECT
        d.*,
        json_agg(
          json_build_object(
            'id', da.id,
            'project_id', da.project_id,
            'amount', da.amount,
            'percentage', da.percentage,
            'project_name', fp.name,
            'project_color', fp.color
          )
        ) FILTER (WHERE da.id IS NOT NULL) as allocations
      FROM donations d
      LEFT JOIN donation_allocations da ON d.id = da.donation_id
      LEFT JOIN funding_projects fp ON da.project_id = fp.id
      WHERE d.user_id = $1
        AND d.payment_status = 'completed'
      GROUP BY d.id
      ORDER BY d.completed_at DESC
      LIMIT $2
      `,
      [userId, limit],
      { schema: this.schema }
    );

    return result.rows.map(row => ({
      ...row,
      allocations: row.allocations || [],
    }));
  }

  /**
   * Get total donated amount by email
   */
  async getTotalDonatedByEmail(email: string): Promise<number> {
    const result = await dbAdapter.query<{ total: string }>(
      `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM donations
      WHERE LOWER(donor_email) = LOWER($1)
        AND payment_status = 'completed'
      `,
      [email],
      { schema: this.schema }
    );

    return parseFloat(result.rows[0]?.total || '0');
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();
