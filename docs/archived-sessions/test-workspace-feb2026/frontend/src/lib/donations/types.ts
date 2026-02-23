/**
 * Donations System - TypeScript Types
 *
 * Type definitions for Veritable Games funding system
 * Uses branded types for type safety
 */

import { Brand } from '@/types/branded';

// ============================================================================
// BRANDED TYPES (Type-safe IDs)
// ============================================================================

export type DonationId = Brand<number, 'DonationId'>;
export type ProjectId = Brand<number, 'ProjectId'>;
export type GoalId = Brand<number, 'GoalId'>;
export type ExpenseId = Brand<number, 'ExpenseId'>;
export type ExpenseCategoryId = Brand<number, 'ExpenseCategoryId'>;
export type AllocationId = Brand<number, 'AllocationId'>;

// ============================================================================
// PAYMENT PROCESSORS
// ============================================================================

export type PaymentProcessor = 'stripe' | 'btcpay' | 'other';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export type Currency = 'USD' | 'BTC' | 'EUR' | 'GBP';

// ============================================================================
// FUNDING PROJECT
// ============================================================================

export interface FundingProject {
  id: ProjectId;
  project_id: number; // Links to content.projects(id)
  slug: string;
  name: string;
  description: string;
  color: string; // Hex color for UI
  target_amount: number | null;
  current_amount: number;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// For display with computed fields
export interface FundingProjectWithProgress extends FundingProject {
  progress_percentage: number; // 0-100
  donor_count?: number;
  recent_donations?: DonationSummary[];
}

// ============================================================================
// FUNDING GOAL
// ============================================================================

export interface FundingGoal {
  id: GoalId;
  project_id: ProjectId | null;
  title: string;
  description: string;
  target_amount: number;
  current_amount: number;
  start_date: string; // ISO date
  end_date: string | null;
  is_active: boolean;
  is_recurring: boolean;
  recurrence_period: 'monthly' | 'quarterly' | 'yearly' | null;
  created_at: string;
  updated_at: string;
}

// For display with computed fields
export interface FundingGoalWithProgress extends FundingGoal {
  progress_percentage: number; // 0-100
  days_remaining: number | null; // NULL if no end_date
  is_completed: boolean;
  project?: FundingProject; // Joined data
}

// ============================================================================
// DONATION
// ============================================================================

export interface Donation {
  id: DonationId;
  user_id: number | null;
  amount: number;
  currency: Currency;

  // Payment processor
  payment_processor: PaymentProcessor;
  payment_id: string | null;
  payment_status: PaymentStatus;

  // Donor info
  donor_name: string | null;
  donor_email: string | null; // Private - not for public display
  is_anonymous: boolean;
  message: string | null;

  // Metadata
  metadata: Record<string, any>;

  // Timestamps
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

// Donation with allocations (multi-project support)
export interface DonationWithAllocations extends Donation {
  allocations: DonationAllocation[];
}

// For public donation list (hide sensitive data)
export interface DonationSummary {
  id: DonationId;
  donor_name: string; // "Anonymous" if is_anonymous
  amount: number;
  currency: Currency;
  project_names: string[]; // List of funded projects
  message: string | null;
  created_at: string;
}

// ============================================================================
// DONATION ALLOCATION
// ============================================================================

export interface DonationAllocation {
  id: AllocationId;
  donation_id: DonationId;
  project_id: ProjectId;
  amount: number;
  percentage: number; // 0.00 to 100.00
  created_at: string;
}

// With joined project data
export interface DonationAllocationWithProject extends DonationAllocation {
  project: FundingProject;
}

// ============================================================================
// EXPENSE CATEGORY
// ============================================================================

export interface ExpenseCategory {
  id: ExpenseCategoryId;
  name: string;
  slug: string;
  description: string;
  color: string; // Hex color
  icon: string; // Icon name (e.g., 'DollarSign', 'Server')
  display_order: number;
  is_active: boolean;
  created_at: string;
}

// ============================================================================
// EXPENSE
// ============================================================================

export interface Expense {
  id: ExpenseId;
  category_id: ExpenseCategoryId;
  project_id: ProjectId | null;
  amount: number;
  currency: Currency;
  description: string;
  receipt_url: string | null;
  expense_date: string; // ISO date
  is_recurring: boolean;
  recurrence_period: 'monthly' | 'yearly' | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// With joined category data
export interface ExpenseWithCategory extends Expense {
  category: ExpenseCategory;
  project?: FundingProject;
}

// ============================================================================
// MONTHLY SUMMARY
// ============================================================================

export interface MonthlySummary {
  id: number;
  year: number;
  month: number; // 1-12
  total_donations: number;
  total_expenses: number;
  net_amount: number;
  donation_count: number;
  expense_count: number;
  is_finalized: boolean;
  created_at: string;
  updated_at: string;
}

// For display
export interface MonthlySummaryDisplay extends MonthlySummary {
  month_name: string; // "January 2025"
  month_abbr: string; // "Jan 2025"
}

// ============================================================================
// TRANSPARENCY METRICS (Dashboard Data)
// ============================================================================

export interface TransparencyMetrics {
  // Top-level totals
  total_all_time: number;
  total_this_year: number;
  total_this_month: number;
  total_expenses_this_year: number;
  total_expenses_this_month: number;
  net_this_year: number;
  net_this_month: number;

  // Tax calculations (federal only - Nevada has no state tax)
  tax_info: TaxInfo;

  // Active goals
  active_goals: FundingGoalWithProgress[];

  // Monthly breakdown (last 12 months)
  monthly_breakdown: MonthlySummaryDisplay[];

  // Expense breakdown by category (aggregated, not detailed)
  expense_breakdown: ExpenseCategoryBreakdown[];

  // Detailed expense breakdown with line items (for 3-tier transparency)
  detailed_expenses: ExpenseCategoryWithItems[];

  // Project-specific totals
  project_totals: ProjectFundingTotal[];

  // Optional: Top donors (if not all anonymous)
  top_donors?: TopDonor[];
}

export interface TaxInfo {
  /** Estimated annual tax liability */
  estimated_tax: number;
  /** Effective tax rate as percentage */
  effective_rate: number;
  /** Current marginal tax bracket */
  marginal_bracket: string;
  /** Projected annual income (based on YTD) */
  projected_annual_income: number;
  /** Recommended quarterly payment */
  quarterly_payment: number;
}

export interface ExpenseCategoryBreakdown {
  category: ExpenseCategory;
  total: number;
  percentage: number; // Of total expenses
  count: number; // Number of expenses in this category
}

/**
 * Expense line item for transparency (simplified public view)
 */
export interface ExpenseLineItem {
  id: ExpenseId;
  description: string;
  amount: number;
  expense_date: string;
  is_recurring: boolean;
  recurrence_period: 'monthly' | 'yearly' | null;
}

/**
 * Category with detailed expense line items (for 3-tier transparency view)
 */
export interface ExpenseCategoryWithItems extends ExpenseCategoryBreakdown {
  items: ExpenseLineItem[];
}

export interface ProjectFundingTotal {
  project: FundingProject;
  total_raised: number;
  donor_count: number;
  avg_donation: number;
}

export interface TopDonor {
  name: string; // "Anonymous" if hidden
  total: number;
  donation_count: number;
  first_donation: string; // ISO date
}

// ============================================================================
// DTOs (Data Transfer Objects for API)
// ============================================================================

/**
 * Create Donation DTO
 * Used when submitting a new donation
 */
export interface CreateDonationDTO {
  amount: number;
  currency?: Currency; // Defaults to USD

  // Multi-project allocation (must sum to 100%)
  allocations: {
    project_id: ProjectId;
    percentage: number; // 0-100
  }[];

  // Donor info (optional)
  donor_name?: string;
  donor_email?: string;
  is_anonymous?: boolean;
  message?: string;

  // Payment processor
  payment_processor: PaymentProcessor;

  // Payment intent ID (from Stripe/BTCPay)
  payment_intent_id?: string;
}

/**
 * Validation result for donation creation
 */
export interface DonationValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Create Expense DTO (admin only)
 */
export interface CreateExpenseDTO {
  category_id: ExpenseCategoryId;
  project_id?: ProjectId;
  amount: number;
  currency?: Currency;
  description: string;
  receipt_url?: string;
  expense_date: string; // ISO date
  is_recurring?: boolean;
  recurrence_period?: 'monthly' | 'yearly';
}

/**
 * Update Funding Goal DTO
 */
export interface UpdateFundingGoalDTO {
  title?: string;
  description?: string;
  target_amount?: number;
  start_date?: string;
  end_date?: string | null;
  is_active?: boolean;
}

// ============================================================================
// WIDGET DATA (For Initial Load)
// ============================================================================

/**
 * Data for donation widget initial render
 */
export interface DonationWidgetData {
  // Total raised across all projects
  total_donations: number;

  // Active funding goals
  active_goals: FundingGoalWithProgress[];

  // Fundable projects
  projects: FundingProjectWithProgress[];

  // Recent donations (public)
  recent_donations: DonationSummary[];

  // Quick stats
  stats: {
    total_donors: number;
    this_month_raised: number;
    active_goal_count: number;
  };
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Allocation input for project selector UI
 */
export interface ProjectAllocation {
  project_id: ProjectId;
  project_name: string;
  project_color: string;
  percentage: number; // 0-100
  amount: number; // Calculated from total * percentage
}

/**
 * Payment intent result (from Stripe/BTCPay)
 */
export interface PaymentIntentResult {
  success: boolean;
  payment_intent_id?: string;
  client_secret?: string; // For Stripe
  invoice_id?: string; // For BTCPay
  checkout_url?: string; // Redirect URL
  error?: string;
}

/**
 * Webhook payload (payment completion)
 */
export interface WebhookPayload {
  type: 'payment.completed' | 'payment.failed' | 'payment.refunded';
  payment_processor: PaymentProcessor;
  payment_id: string;
  donation_id?: DonationId;
  amount?: number;
  currency?: Currency;
  metadata?: Record<string, any>;
  timestamp: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Minimum donation amount (in USD)
 */
export const MIN_DONATION_AMOUNT = 0.01;

/**
 * Maximum donation amount (in USD) - prevent abuse
 */
export const MAX_DONATION_AMOUNT = 100000.0;

/**
 * Supported payment processors
 */
export const PAYMENT_PROCESSORS: Record<PaymentProcessor, string> = {
  stripe: 'Credit Card (Stripe)',
  btcpay: 'Bitcoin / Lightning (BTCPay)',
  other: 'Other',
};

/**
 * Supported currencies
 */
export const CURRENCIES: Record<Currency, string> = {
  USD: 'US Dollar',
  BTC: 'Bitcoin',
  EUR: 'Euro',
  GBP: 'British Pound',
};

/**
 * Payment status display labels
 */
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pending',
  completed: 'Completed',
  failed: 'Failed',
  refunded: 'Refunded',
};

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isDonationCompleted(donation: Donation): boolean {
  return donation.payment_status === 'completed';
}

export function isDonationPending(donation: Donation): boolean {
  return donation.payment_status === 'pending';
}

export function isGoalActive(goal: FundingGoal): boolean {
  if (!goal.is_active) return false;
  if (!goal.end_date) return true; // No end date = always active
  return new Date(goal.end_date) >= new Date();
}

export function isProjectFundable(project: FundingProject): boolean {
  return project.is_active;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate progress percentage
 */
export function calculateProgress(current: number, target: number): number {
  if (target <= 0) return 0;
  const percentage = (current / target) * 100;
  return Math.min(Math.round(percentage * 100) / 100, 100); // Max 100%, 2 decimal places
}

/**
 * Calculate days remaining until goal end
 */
export function calculateDaysRemaining(endDate: string | null): number | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return Math.max(days, 0); // Never negative
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: Currency = 'USD'): string {
  if (currency === 'BTC') {
    return `${amount.toFixed(8)} BTC`; // Bitcoin uses 8 decimal places
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format month for display
 */
export function formatMonth(
  year: number,
  month: number
): {
  full: string;
  abbr: string;
} {
  const date = new Date(year, month - 1, 1);
  return {
    full: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    abbr: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
  };
}

/**
 * Validate donation allocations sum to 100%
 */
export function validateAllocations(
  allocations: { percentage: number }[]
): DonationValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (allocations.length === 0) {
    errors.push('At least one project allocation is required');
    return { valid: false, errors, warnings };
  }

  const totalPercentage = allocations.reduce((sum, a) => sum + a.percentage, 0);

  if (Math.abs(totalPercentage - 100) > 0.01) {
    errors.push(
      `Allocation percentages must sum to 100% (current: ${totalPercentage.toFixed(2)}%)`
    );
  }

  const hasNegative = allocations.some(a => a.percentage < 0);
  if (hasNegative) {
    errors.push('Allocation percentages cannot be negative');
  }

  const hasOverflow = allocations.some(a => a.percentage > 100);
  if (hasOverflow) {
    errors.push('Individual allocation cannot exceed 100%');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate donation amount
 */
export function validateDonationAmount(amount: number): DonationValidationResult {
  const errors: string[] = [];

  if (amount < MIN_DONATION_AMOUNT) {
    errors.push(`Minimum donation is ${formatCurrency(MIN_DONATION_AMOUNT)}`);
  }

  if (amount > MAX_DONATION_AMOUNT) {
    errors.push(`Maximum donation is ${formatCurrency(MAX_DONATION_AMOUNT)}`);
  }

  if (amount <= 0 || !isFinite(amount)) {
    errors.push('Donation amount must be a positive number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// SUBSCRIPTION TYPES (Recurring Donations)
// ============================================================================

export type SubscriptionId = Brand<number, 'SubscriptionId'>;

/**
 * Subscription status enum (matches Stripe subscription statuses)
 */
export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused'
  | 'trialing'
  | 'incomplete';

/**
 * Subscription interval
 */
export type SubscriptionInterval = 'month' | 'year';

/**
 * Subscription record (recurring donation)
 */
export interface Subscription {
  id: SubscriptionId;

  // Stripe identifiers
  stripe_subscription_id: string;
  stripe_customer_id: string;

  // Donor info
  donor_email: string;
  donor_name: string | null;
  user_id: number | null; // NULL for guest subscriptions

  // Subscription details
  status: SubscriptionStatus;
  amount: number;
  currency: Currency;
  interval: SubscriptionInterval;

  // Project allocation
  project_id: ProjectId | null;

  // Portal access (magic link)
  portal_access_token: string | null;
  portal_access_expires_at: string | null;

  // Stripe period tracking
  current_period_start: string;
  current_period_end: string;

  // Lifecycle timestamps
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Subscription with joined project data
 */
export interface SubscriptionWithProject extends Subscription {
  project: FundingProject | null;
}

/**
 * Create Subscription DTO (from Stripe webhook)
 */
export interface CreateSubscriptionDTO {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  donorEmail: string;
  donorName?: string;
  userId?: number;
  projectId?: number;
  amount: number;
  currency?: Currency;
  interval?: SubscriptionInterval;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

/**
 * Update Subscription DTO
 */
export interface UpdateSubscriptionDTO {
  status?: SubscriptionStatus;
  canceledAt?: Date | null;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
}

/**
 * Record recurring payment DTO (from invoice.payment_succeeded)
 */
export interface RecurringPaymentDTO {
  stripeSubscriptionId: string;
  stripeInvoiceId: string;
  amount: number;
  currency: Currency;
  paidAt: Date;
}

/**
 * Portal access token result
 */
export interface PortalAccessToken {
  token: string;
  expiresAt: Date;
  subscriptionId: SubscriptionId;
}

/**
 * Subscription display labels
 */
export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'Active',
  past_due: 'Past Due',
  canceled: 'Canceled',
  unpaid: 'Unpaid',
  paused: 'Paused',
  trialing: 'Trial',
  incomplete: 'Incomplete',
};

/**
 * Subscription interval labels
 */
export const SUBSCRIPTION_INTERVAL_LABELS: Record<SubscriptionInterval, string> = {
  month: 'Monthly',
  year: 'Yearly',
};

/**
 * Check if subscription is active
 */
export function isSubscriptionActive(subscription: Subscription): boolean {
  return subscription.status === 'active' || subscription.status === 'trialing';
}

/**
 * Check if subscription can be managed (not already canceled)
 */
export function isSubscriptionManageable(subscription: Subscription): boolean {
  return subscription.status !== 'canceled' && subscription.status !== 'incomplete';
}

/**
 * Format subscription amount with interval
 */
export function formatSubscriptionAmount(
  amount: number,
  currency: Currency,
  interval: SubscriptionInterval
): string {
  const formattedAmount = formatCurrency(amount, currency);
  return `${formattedAmount}/${interval === 'month' ? 'mo' : 'yr'}`;
}
