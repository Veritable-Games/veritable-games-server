# Donations System - Complete Architecture Documentation

**Created**: November 20, 2025
**Status**: Phase 1 Complete (BTCPay), Phase 2 Pending (Stripe + UI)
**Completion**: ~80% Backend, ~20% Frontend

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Implementation Status](#current-implementation-status)
3. [Database Architecture](#database-architecture)
4. [Service Layer](#service-layer)
5. [API Endpoints](#api-endpoints)
6. [Frontend Components](#frontend-components)
7. [Payment Processors](#payment-processors)
8. [Missing Features](#missing-features)
9. [Testing](#testing)
10. [Future Enhancements](#future-enhancements)

---

## Executive Summary

The Veritable Games donations system is a **comprehensive funding and transparency platform** designed to:
- Accept cryptocurrency (Bitcoin/Lightning) and traditional payment donations
- Track expenses across categories (Taxes, Development, Infrastructure, etc.)
- Provide public transparency through expense breakdowns and progress tracking
- Support multiple funding projects and campaign goals
- Enable detailed financial reporting

**What Works**:
- ✅ Complete PostgreSQL database schema (7 tables)
- ✅ Full TypeScript service layer (20+ methods)
- ✅ BTCPay Server integration (Bitcoin/Lightning payments)
- ✅ Webhook handling for payment completion
- ✅ Multi-project donation allocation
- ✅ Campaign/goal system with recurring support
- ✅ Expense tracking by category
- ✅ Monthly aggregation system

**What's Missing**:
- ❌ Stripe integration (credit card payments)
- ❌ Homepage transparency dashboard (public)
- ❌ Admin expense management UI
- ❌ Campaign management interface
- ❌ CSV export functionality
- ❌ Payment method selector (Stripe vs BTCPay tabs)

---

## Current Implementation Status

### Phase 1: Database + Backend (COMPLETE ✅)

**Completed**: November 20, 2025

#### Database Schema
- ✅ `donations.donations` - Individual donation records
- ✅ `donations.donation_allocations` - Multi-project splits
- ✅ `donations.funding_projects` - 5 active projects
- ✅ `donations.funding_goals` - Campaign system
- ✅ `donations.expenses` - Expense records
- ✅ `donations.expense_categories` - 5 categories
- ✅ `donations.monthly_summaries` - Aggregated metrics

#### Service Layer
- ✅ DonationService class with 20+ methods
- ✅ Full CRUD operations
- ✅ Transparency metrics calculation
- ✅ Expense breakdown by category
- ✅ Monthly/yearly aggregation
- ✅ Multi-project allocation logic

#### API Routes
- ✅ `POST /api/donations/btcpay` - Create BTCPay invoice
- ✅ `POST /api/webhooks/btcpay` - Payment completion
- ✅ Database query methods for all operations

### Phase 2: Frontend + Stripe (PENDING ❌)

**Not Yet Started**

Requires:
- Stripe SDK installation
- Payment method selector UI
- Homepage transparency dashboard
- Admin expense management interface
- Campaign management UI
- CSV export routes

---

## Database Architecture

### Tables Overview

#### 1. `donations.donations`

**Purpose**: Individual donation records

```sql
CREATE TABLE donations.donations (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES auth.users(id),  -- NULL for anonymous
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Payment processor info
  payment_processor VARCHAR(50) NOT NULL,  -- 'btcpay', 'stripe', 'paypal'
  payment_id VARCHAR(255),                 -- External payment ID
  payment_status VARCHAR(50) DEFAULT 'pending',

  -- Donor information
  donor_name VARCHAR(255),
  donor_email VARCHAR(255),
  is_anonymous BOOLEAN DEFAULT FALSE,
  message TEXT,

  -- Metadata (JSONB for flexibility)
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

**Key Fields**:
- `payment_processor`: Determines which processor handled payment
- `payment_status`: 'pending' | 'completed' | 'failed' | 'refunded'
- `metadata`: Stores processor-specific data (invoice URLs, etc.)

**Indexes**:
- `idx_donations_payment_status` ON (payment_status)
- `idx_donations_created_at` ON (created_at DESC)
- `idx_donations_payment_id` ON (payment_id)

#### 2. `donations.donation_allocations`

**Purpose**: Split donations across multiple projects

```sql
CREATE TABLE donations.donation_allocations (
  id BIGSERIAL PRIMARY KEY,
  donation_id BIGINT NOT NULL REFERENCES donations.donations(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES donations.funding_projects(id),
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Example**:
```typescript
// $100 donation split across 2 projects:
[
  { donation_id: 1, project_id: 1, amount: 60, percentage: 60 }, // NOXII
  { donation_id: 1, project_id: 2, amount: 40, percentage: 40 }, // AUTUMN
]
```

**Validation**: Percentages must sum to 100% (enforced in service layer)

#### 3. `donations.funding_projects`

**Purpose**: Fundable projects (games/initiatives)

```sql
CREATE TABLE donations.funding_projects (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT REFERENCES content.projects(id),  -- Links to main projects table
  slug VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7) NOT NULL,  -- Hex color for UI (e.g., '#3b82f6')
  target_amount NUMERIC(10,2),  -- NULL = no specific goal
  current_amount NUMERIC(10,2) DEFAULT 0,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Current Projects**:
1. NOXII
2. AUTUMN
3. DODEC
4. ON COMMAND
5. COSMIC KNIGHTS

**Auto-Update**: `current_amount` updated automatically via triggers when donations complete

#### 4. `donations.funding_goals`

**Purpose**: Time-limited fundraising campaigns

```sql
CREATE TABLE donations.funding_goals (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT REFERENCES donations.funding_projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  target_amount NUMERIC(10,2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(10,2) DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE,  -- NULL = ongoing
  is_active BOOLEAN DEFAULT TRUE,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_period VARCHAR(50),  -- 'monthly', 'quarterly', 'yearly'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Use Cases**:
- Time-limited campaigns: "Complete NOXII Alpha by June 2025"
- Recurring goals: "Monthly server costs"
- Stretch goals: "Reach $50k for voice acting"

**Auto-Deactivation**: Goals past `end_date` are automatically marked inactive

#### 5. `donations.expenses`

**Purpose**: Record project expenses for transparency

```sql
CREATE TABLE donations.expenses (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT NOT NULL REFERENCES donations.expense_categories(id),
  project_id BIGINT REFERENCES donations.funding_projects(id),  -- NULL = general
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) DEFAULT 'USD',
  description TEXT NOT NULL,
  receipt_url VARCHAR(512),  -- Link to receipt/invoice
  expense_date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_period VARCHAR(50),  -- 'monthly', 'yearly'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Categories** (via `expense_categories`):
1. Taxes (#ef4444 red)
2. Assets (#f59e0b orange)
3. API Services (#3b82f6 blue)
4. Infrastructure (#8b5cf6 purple)
5. Development (#10b981 green)

#### 6. `donations.expense_categories`

**Purpose**: Categorize expenses for breakdown charts

```sql
CREATE TABLE donations.expense_categories (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  color VARCHAR(7) NOT NULL,  -- Hex color for charts
  icon VARCHAR(50),  -- Lucide icon name
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Example Row**:
```
id: 1
name: Taxes
slug: taxes
description: Federal and state tax obligations
color: #ef4444
icon: Receipt
display_order: 1
```

#### 7. `donations.monthly_summaries`

**Purpose**: Pre-calculated monthly metrics for performance

```sql
CREATE TABLE donations.monthly_summaries (
  id BIGSERIAL PRIMARY KEY,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month >= 1 AND month <= 12),
  total_donations NUMERIC(10,2) DEFAULT 0,
  total_expenses NUMERIC(10,2) DEFAULT 0,
  net_amount NUMERIC(10,2) DEFAULT 0,
  donation_count INT DEFAULT 0,
  expense_count INT DEFAULT 0,
  is_finalized BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(year, month)
);
```

**Auto-Update**: Triggers update this table when donations/expenses are added

---

## Service Layer

**Location**: `frontend/src/lib/donations/service.ts`

### DonationService Class

```typescript
export class DonationService {
  private schema = 'donations' as const;

  // Funding Projects
  async getActiveFundingProjects(): Promise<FundingProject[]>
  async getFundingProjectsWithProgress(): Promise<FundingProjectWithProgress[]>
  async getFundingProjectById(projectId: number): Promise<FundingProject | null>
  async getFundingProjectBySlug(slug: string): Promise<FundingProject | null>

  // Funding Goals (Campaigns)
  async getActiveFundingGoals(): Promise<FundingGoalWithProgress[]>

  // Donations
  async createDonation(data: CreateDonationDTO): Promise<Donation>
  async updatePaymentStatus(paymentId: string, status: PaymentStatus, metadata?: Record<string, any>): Promise<Donation>
  async getDonationWithAllocations(donationId: number): Promise<DonationWithAllocations | null>
  async getRecentDonations(limit: number = 20): Promise<DonationSummary[]>

  // Widget Data (for homepage/dashboard)
  async getDonationWidgetData(): Promise<DonationWidgetData>
  async getTransparencyMetrics(): Promise<TransparencyMetrics>

  // Expenses (Admin Only)
  async createExpense(data: CreateExpenseDTO): Promise<Expense>
  async getExpenseCategories(): Promise<ExpenseCategory[]>

  // Private helpers (internal use)
  private async updateGoalTotals(donationId: number, multiplier: number = 1): Promise<void>
  private async getTotalDonationsAllTime(): Promise<number>
  private async getTotalDonationsForYear(year: number): Promise<number>
  private async getTotalDonationsForMonth(year: number, month: number): Promise<number>
  private async getTotalExpensesForYear(year: number): Promise<number>
  private async getTotalExpensesForMonth(year: number, month: number): Promise<number>
  private async getMonthlyBreakdown(months: number = 12): Promise<MonthlySummaryDisplay[]>
  private async getExpenseBreakdown(year: number): Promise<ExpenseCategoryBreakdown[]>
  private async getProjectTotals(): Promise<ProjectFundingTotal[]>
  private async getTopDonors(limit: number = 10): Promise<TopDonor[]>
  private async updateMonthlySummary(year: number, month: number): Promise<void>
}
```

### Key Methods Explained

#### `getTransparencyMetrics()`

**Purpose**: Returns all data needed for homepage transparency dashboard

**Returns**:
```typescript
{
  // Top-level totals
  total_all_time: 1250.00,
  total_this_year: 850.00,
  total_this_month: 120.00,
  total_expenses_this_year: 300.00,
  total_expenses_this_month: 45.00,
  net_this_year: 550.00,
  net_this_month: 75.00,

  // Active campaigns
  active_goals: [
    {
      id: 1,
      title: "Complete NOXII Alpha",
      target_amount: 25000,
      current_amount: 8450,
      progress_percentage: 33.8,
      days_remaining: 87,
      is_completed: false
    }
  ],

  // Monthly trend (last 12 months)
  monthly_breakdown: [
    { month_name: "November 2025", month_abbr: "Nov 2025", total: 120 },
    { month_name: "October 2025", month_abbr: "Oct 2025", total: 230 },
    // ...
  ],

  // Expense breakdown (THIS IS THE PIE CHART DATA)
  expense_breakdown: [
    {
      category: { name: "Taxes", color: "#ef4444", icon: "Receipt" },
      total: 150.00,
      percentage: 50.0,  // 50% of expenses went to taxes
      count: 2
    },
    {
      category: { name: "Development", color: "#10b981", icon: "Code" },
      total: 100.00,
      percentage: 33.3,  // 33.3% to development
      count: 5
    },
    {
      category: { name: "Infrastructure", color: "#8b5cf6", icon: "Server" },
      total: 50.00,
      percentage: 16.7,  // 16.7% to infrastructure
      count: 3
    }
  ],

  // Project-specific totals
  project_totals: [
    {
      project: { id: 1, name: "NOXII", color: "#3b82f6" },
      total_raised: 450.00,
      donor_count: 12,
      avg_donation: 37.50
    },
    // ...
  ],

  // Optional: Top donors (if not all anonymous)
  top_donors: [
    { name: "John D.", total: 500, donation_count: 3 },
    // ...
  ]
}
```

**Usage**:
```typescript
// In homepage component or /transparency page:
const metrics = await donationService.getTransparencyMetrics();

// Render:
// - Pie chart from expense_breakdown
// - Line chart from monthly_breakdown
// - Progress bars from project_totals
// - Campaign cards from active_goals
```

#### `createDonation()`

**Purpose**: Create donation with multi-project allocation

**Input**:
```typescript
{
  amount: 100.00,
  currency: 'USD',
  payment_processor: 'btcpay',
  donor_name: 'John Doe',
  donor_email: 'john@example.com',
  is_anonymous: false,
  message: 'Great project!',
  allocations: [
    { project_id: 1, percentage: 60 },  // 60% to NOXII
    { project_id: 2, percentage: 40 },  // 40% to AUTUMN
  ]
}
```

**Process**:
1. Validates amount >= $0.01
2. Validates allocations sum to 100%
3. Creates donation record (status: 'pending')
4. Creates allocation records
5. Returns donation with ID

**Note**: Does NOT update `current_amount` yet (happens when payment completes)

#### `updatePaymentStatus()`

**Purpose**: Called by webhook when payment completes

**Process**:
1. Finds donation by `payment_id`
2. Updates status to 'completed'
3. Sets `completed_at` timestamp
4. Updates metadata with additional info
5. **Triggers project total updates**
6. **Triggers goal total updates**
7. **Updates monthly summary**

**This is the critical method that actually allocates funds**

#### `createExpense()`

**Purpose**: Admin records an expense for transparency

**Input**:
```typescript
{
  category_id: 1,  // Taxes
  amount: 150.00,
  description: "Q4 2024 federal tax payment",
  expense_date: "2024-12-31",
  project_id: null,  // Or specific project ID
  receipt_url: "https://receipts.example.com/tx-12345.pdf"
}
```

**Process**:
1. Validates category exists
2. Creates expense record
3. **Updates monthly summary automatically**
4. Returns created expense

**Currently**: No UI exists to call this (requires SQL or API curl)

---

## API Endpoints

### Current Endpoints (Implemented ✅)

#### `POST /api/donations/btcpay`

**Purpose**: Create donation and BTCPay invoice

**Request**:
```json
{
  "amount": 10.00,
  "currency": "USD",
  "projectId": 1,
  "donorName": "John Doe",
  "donorEmail": "john@example.com",
  "message": "Keep up the great work!"
}
```

**Response**:
```json
{
  "success": true,
  "donationId": 42,
  "invoiceId": "NURSbKTuCSEXxcUo3Dyqj6",
  "checkoutUrl": "https://btcpay.veritablegames.com/i/NURSbKTuCSEXxcUo3Dyqj6"
}
```

**Implementation**: `frontend/src/app/api/donations/btcpay/route.ts`

#### `POST /api/webhooks/btcpay`

**Purpose**: Receive payment completion notifications

**Request** (from BTCPay):
```json
{
  "invoiceId": "NURSbKTuCSEXxcUo3Dyqj6",
  "status": "Settled",
  "metadata": {
    "donationId": "42"
  }
}
```

**Process**:
1. Verifies HMAC signature
2. Calls `donationService.updatePaymentStatus()`
3. Returns 200 OK

**Implementation**: `frontend/src/app/api/webhooks/btcpay/route.ts`

### Missing Endpoints (To Be Built ❌)

#### `POST /api/donations/stripe`
Create Stripe payment intent

#### `POST /api/webhooks/stripe`
Handle Stripe payment completion

#### `GET /api/transparency/data`
Return `TransparencyMetrics` for dashboard

#### `GET /api/transparency/export`
Download CSV of all donations (admin only)

#### `POST /api/admin/expenses`
Create expense record (admin only)

#### `GET /api/admin/expenses`
List all expenses (admin only)

#### `POST /api/admin/goals`
Create/update funding goal (admin only)

#### `DELETE /api/admin/goals/:id`
End campaign early (admin only)

---

## Frontend Components

### Existing Components (Implemented ✅)

#### `/app/donate/page.tsx`

**Purpose**: Donation form page

**Features**:
- Server component fetches active projects
- Renders `<DonationForm />` client component
- Dark theme styling

**URL**: https://www.veritablegames.com/donate

#### `/app/donate/donation-form.tsx`

**Purpose**: Client-side donation form

**Features**:
- Amount input (min $0.01)
- Project selector dropdown
- Optional donor name/email
- Optional message
- Submits to `/api/donations/btcpay`
- Redirects to BTCPay checkout

**Current Limitation**: No payment method selector (BTCPay only)

#### `/app/donate/success/page.tsx`

**Purpose**: Post-payment confirmation

**Features**:
- Success message
- Blockchain confirmation info
- Links to return home or donate again

### Missing Components (To Be Built ❌)

#### Homepage Transparency Widget

**Proposed Location**: `/app/page.tsx` (homepage) or `/app/transparency/page.tsx`

**Components Needed**:
```typescript
<TransparencyDashboard>
  <TotalsSummary />           // Total raised, total spent, net balance
  <ExpensePieChart />          // Breakdown by category
  <MonthlyTrendChart />        // Donations vs expenses over time
  <ProjectProgressBars />      // Funding progress for each project
  <CampaignCards />            // Active funding goals
  <RecentDonationsTable />     // Latest donations (public)
  <CSVExportButton />          // Download full report (admin only?)
</TransparencyDashboard>
```

#### Admin Expense Management

**Proposed Location**: `/app/admin/expenses/page.tsx`

**Components Needed**:
```typescript
<ExpenseManagement>
  <ExpenseForm />              // Add new expense
  <ExpenseTable />             // List all expenses
  <ExpenseCategoryManager />   // Add/edit categories
  <MonthlyReview />            // Review monthly summaries
</ExpenseManagement>
```

#### Admin Campaign Management

**Proposed Location**: `/app/admin/campaigns/page.tsx`

**Components Needed**:
```typescript
<CampaignManagement>
  <CreateGoalForm />           // Start new campaign
  <GoalsList />                // Active/past goals
  <GoalProgressChart />        // Visual tracking
  <EndCampaignButton />        // Manually end campaign
</CampaignManagement>
```

#### Payment Method Selector

**Proposed Location**: `/app/donate/donation-form.tsx` (update)

**UI**:
```typescript
<Tabs defaultValue="stripe">
  <TabsList>
    <TabsTrigger value="stripe">Credit Card</TabsTrigger>
    <TabsTrigger value="btcpay">Bitcoin/Lightning</TabsTrigger>
  </TabsList>

  <TabsContent value="stripe">
    <StripePaymentForm />
  </TabsContent>

  <TabsContent value="btcpay">
    <BTCPayPaymentForm />  {/* Existing form */}
  </TabsContent>
</Tabs>
```

---

## Payment Processors

### BTCPay Server (Implemented ✅)

**Status**: Fully operational

**Features**:
- Bitcoin on-chain payments
- Lightning Network instant payments
- Self-hosted (btcpay.veritablegames.com)
- Zero fees
- Full custody control

**Environment Variables**:
```
BTCPAY_SERVER_URL=https://btcpay.veritablegames.com
BTCPAY_STORE_ID=AgkrKHhe7sxnH9k8vAuSgxNJYffzMSEudx1SV4BSnmPP
BTCPAY_API_KEY=3c3d7fc5344eed97727456a42c7afbad617b02b9
BTCPAY_WEBHOOK_SECRET=[generated by BTCPay]
```

**Flow**:
1. User fills donation form
2. API creates donation record (pending)
3. API calls BTCPay to create invoice
4. User redirected to BTCPay checkout
5. User pays with Bitcoin/Lightning
6. BTCPay sends webhook on completion
7. Webhook updates donation status to 'completed'
8. Project totals automatically updated

**Tested**: ✅ End-to-end flow working (November 20, 2025)

### Stripe (Not Implemented ❌)

**Status**: Planned but not started

**Would Provide**:
- Credit card payments
- ACH bank transfers
- Apple Pay / Google Pay
- International payment methods
- Automatic USD conversion

**Required**:
1. Stripe account signup
2. Install `@stripe/stripe-js` and `stripe` npm packages
3. Environment variables:
   ```
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
4. Create `/api/donations/stripe` route (mirror BTCPay)
5. Create `/api/webhooks/stripe` route
6. Add Stripe checkout form component
7. Test with Stripe test mode

**Estimated Time**: 4-5 hours

**Priority**: HIGH (user requested Stripe as default payment method)

---

## Missing Features

### 1. Homepage Transparency Dashboard

**Description**: Public-facing dashboard showing where donations go

**Components**:
- Expense breakdown pie chart (% to Taxes, Development, etc.)
- Monthly donations vs expenses line chart
- Project funding progress bars
- Active campaign cards with countdown timers
- Recent donations table (anonymized)
- Total raised / Total spent / Net balance

**API**: `GET /api/transparency/data` (returns `TransparencyMetrics`)

**Estimated Time**: 2-3 hours

**Priority**: HIGH (transparency is core value)

### 2. Admin Expense Management

**Description**: Interface for adding and managing expenses

**Features**:
- Form to record expenses (category, amount, description, receipt URL)
- Table showing all expenses with filters (category, date range, project)
- Edit/delete expense functionality
- Bulk import from CSV
- Receipt file upload

**API**:
- `POST /api/admin/expenses` (create)
- `GET /api/admin/expenses` (list)
- `PATCH /api/admin/expenses/:id` (update)
- `DELETE /api/admin/expenses/:id` (delete)

**Estimated Time**: 2-3 hours

**Priority**: HIGH (can't track expenses without UI)

### 3. Campaign Management Interface

**Description**: Admin tools for creating and managing funding goals

**Features**:
- Create new campaign (title, target, dates, project link)
- Edit active campaigns
- End campaign manually (or auto-end on date)
- Set up recurring campaigns
- View campaign performance metrics

**API**:
- `POST /api/admin/goals` (create)
- `GET /api/admin/goals` (list)
- `PATCH /api/admin/goals/:id` (update)
- `DELETE /api/admin/goals/:id` (end early)

**Estimated Time**: 4-6 hours

**Priority**: MEDIUM (can manually SQL for now)

### 4. Payment Method Selector

**Description**: Let users choose between Stripe (default) and BTCPay

**UI**: Tabbed interface on `/donate` page

**Behavior**:
- Default tab: Stripe (credit card)
- Second tab: BTCPay (crypto)
- Same donation form fields, different submission endpoint

**Estimated Time**: 1 hour (after Stripe integration complete)

**Priority**: HIGH (required for Stripe)

### 5. CSV Export

**Description**: Download complete donation history

**Formats**:
- Donations CSV (date, project, amount, donor, status)
- Expenses CSV (date, category, amount, description)
- Monthly summary CSV (year, month, donations, expenses, net)

**API**: `GET /api/transparency/export?type=donations&format=csv`

**Access Control**: Admin only (contains donor emails)

**Estimated Time**: 1-2 hours

**Priority**: LOW (nice-to-have)

### 6. Allocation Control Interface

**Description**: Admin sets default donation split percentages

**Current**: User controls allocation at donation time
**Alternative**: Admin sets global rules (e.g., "60% Development, 20% Infrastructure, 20% Taxes")

**Decision Required**: Which model to use?

**Estimated Time**: 2-3 hours

**Priority**: LOW (current model works)

---

## Testing

### Current Test Coverage

**Unit Tests**: ❌ None written
**Integration Tests**: ❌ None written
**Manual Testing**: ✅ BTCPay flow tested end-to-end

### Recommended Test Suite

#### Unit Tests (Service Layer)

```typescript
// frontend/src/lib/donations/__tests__/service.test.ts

describe('DonationService', () => {
  describe('createDonation', () => {
    it('validates minimum amount');
    it('validates allocation percentages sum to 100%');
    it('creates donation with allocations');
    it('rejects negative amounts');
    it('rejects invalid currency');
  });

  describe('getTransparencyMetrics', () => {
    it('calculates expense breakdown percentages');
    it('returns monthly totals for last 12 months');
    it('aggregates project totals correctly');
    it('handles zero donations gracefully');
  });

  describe('updatePaymentStatus', () => {
    it('updates donation status');
    it('updates project current_amount on completion');
    it('updates goal current_amount on completion');
    it('updates monthly summary on completion');
  });
});
```

#### Integration Tests (API Routes)

```typescript
// frontend/src/app/api/donations/__tests__/btcpay.test.ts

describe('POST /api/donations/btcpay', () => {
  it('creates donation and BTCPay invoice');
  it('returns checkout URL');
  it('validates CSRF token');
  it('rejects invalid amount');
  it('rejects missing project ID');
});

describe('POST /api/webhooks/btcpay', () => {
  it('verifies HMAC signature');
  it('updates donation on settlement');
  it('rejects invalid signature');
  it('handles duplicate webhooks (idempotency)');
});
```

#### E2E Tests (Playwright/Cypress)

```typescript
// frontend/e2e/donations.spec.ts

test('complete donation flow', async ({ page }) => {
  await page.goto('/donate');
  await page.fill('#amount', '10.00');
  await page.selectOption('#project', '1'); // NOXII
  await page.fill('#donorName', 'Test Donor');
  await page.click('button[type=submit]');

  // Should redirect to BTCPay
  await expect(page).toHaveURL(/btcpay\.veritablegames\.com/);
});

test('homepage transparency dashboard', async ({ page }) => {
  await page.goto('/transparency');

  // Should show expense breakdown
  await expect(page.locator('[data-testid="expense-pie-chart"]')).toBeVisible();

  // Should show project progress
  await expect(page.locator('[data-testid="project-progress"]')).toContainText('NOXII');

  // Should show recent donations
  await expect(page.locator('[data-testid="donations-table"]')).toBeVisible();
});
```

---

## Future Enhancements

### Phase 3+ Features (Optional)

#### 1. Donor Tiers / Perks

**Concept**: Reward donors based on total contribution

**Tiers**:
- Bronze: $10-$49 (name on credits page)
- Silver: $50-$249 (beta access to games)
- Gold: $250-$999 (digital art pack + credits)
- Platinum: $1000+ (executive producer credit)

**Database**:
```sql
CREATE TABLE donations.donor_tiers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  min_amount NUMERIC(10,2) NOT NULL,
  perks JSONB NOT NULL,
  badge_url VARCHAR(512)
);
```

#### 2. Recurring Donations

**Concept**: Monthly automatic donations

**Implementation**:
- Stripe subscriptions
- BTCPay recurring invoices
- Store subscription ID in `donations` metadata

**Database**:
```sql
ALTER TABLE donations.donations
ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN subscription_id VARCHAR(255),
ADD COLUMN recurrence_period VARCHAR(50);
```

#### 3. Donation Matching

**Concept**: Corporate/sponsor matches donations

**Rules**:
- Company X matches all donations 1:1 up to $10k/month
- Automatically creates matching donation record

**Database**:
```sql
CREATE TABLE donations.matching_programs (
  id BIGSERIAL PRIMARY KEY,
  sponsor_name VARCHAR(255) NOT NULL,
  match_ratio NUMERIC(3,2) NOT NULL,  -- 1.0 = 100%, 2.0 = 200%
  max_monthly_amount NUMERIC(10,2),
  is_active BOOLEAN DEFAULT TRUE
);
```

#### 4. Donor Dashboard

**Concept**: Logged-in donors see their donation history

**Features**:
- Total donated
- Tax-deductible receipt download (if applicable)
- Impact metrics (e.g., "Your $100 funded 5 hours of development")
- Donation history table

**URL**: `/account/donations`

#### 5. Project-Specific Donation Pages

**Concept**: Deep links to donate to specific project

**URL**: `/donate/noxii` (pre-selects NOXII, 100% allocation)

**Benefits**:
- Can share on social media
- Track campaign sources (referrer analytics)

#### 6. Embeddable Donation Widget

**Concept**: Iframe widget for external sites

**Usage**:
```html
<iframe
  src="https://www.veritablegames.com/embed/donate?project=noxii"
  width="400"
  height="600"
></iframe>
```

#### 7. Cryptocurrency Variety

**Current**: Bitcoin + Lightning only
**Future**: Ethereum, Monero, Litecoin, etc.

**Trade-off**: Each adds complexity and maintenance burden

---

## Appendix: Key File Locations

### Database
- Schema: PostgreSQL `donations` schema on production (192.168.1.15)
- Migrations: No formal migration system (manual SQL)

### Backend
- **Service**: `frontend/src/lib/donations/service.ts`
- **Types**: `frontend/src/lib/donations/types.ts`
- **API Routes**:
  - `frontend/src/app/api/donations/btcpay/route.ts`
  - `frontend/src/app/api/webhooks/btcpay/route.ts`

### Frontend
- **Pages**:
  - `frontend/src/app/donate/page.tsx`
  - `frontend/src/app/donate/success/page.tsx`
- **Components**:
  - `frontend/src/app/donate/donation-form.tsx`

### Documentation
- **Architecture**: This file
- **Research**: `docs/BTCPAY_SERVER_RESEARCH_REPORT.md`
- **Roadmap**: `docs/features/DONATIONS_PHASE_2_IMPLEMENTATION_PLAN.md` (to be created)

---

## Questions / Decisions Needed

1. **Stripe as default?** User mentioned Stripe should be default payment method. Confirm before implementation.

2. **Allocation control**: Should users or admins control donation split percentages?

3. **Homepage vs dedicated page**: Should transparency dashboard be on homepage or `/transparency` page?

4. **CSV export access**: Public or admin-only?

5. **Tax receipts**: Do we need tax-deductible receipt generation? (Requires 501(c)(3) status)

6. **Donor privacy**: What donor data is public vs private?

---

**End of Architecture Documentation**

**Next Steps**: See `DONATIONS_PHASE_2_IMPLEMENTATION_PLAN.md` for detailed implementation roadmap.
