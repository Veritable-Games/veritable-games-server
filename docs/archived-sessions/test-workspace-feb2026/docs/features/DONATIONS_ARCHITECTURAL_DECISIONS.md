# Donations System - Architectural Decisions

**Status**: Complete - Documents all key design decisions
**Last Updated**: November 20, 2025
**Purpose**: Explain the rationale behind major architectural choices

---

## Table of Contents

1. [Payment Processor Selection](#payment-processor-selection)
2. [Database Schema Design](#database-schema-design)
3. [Allocation Model](#allocation-model)
4. [Campaign System Design](#campaign-system-design)
5. [Service Layer Pattern](#service-layer-pattern)
6. [Security Architecture](#security-architecture)
7. [Transparency Dashboard](#transparency-dashboard)
8. [Technology Choices](#technology-choices)
9. [Trade-offs and Alternatives](#trade-offs-and-alternatives)
10. [Future Considerations](#future-considerations)

---

## Payment Processor Selection

### Decision: Dual Payment Processor (Stripe + BTCPay)

**What**: Support both traditional credit/debit cards (Stripe) AND cryptocurrency (BTCPay Server)

**Why**:
1. **Accessibility**: Not everyone has cryptocurrency, and not everyone wants to use traditional payment methods
2. **User Preference**: Some users strongly prefer crypto for philosophical reasons (censorship resistance, privacy)
3. **Diversification**: Reduces dependency on a single payment provider
4. **Lower Minimums**: BTCPay allows $0.01 donations, Stripe requires $0.50

**Stripe as Default**:
- **Decided**: November 20, 2025 (user requirement)
- **Rationale**: Most users are familiar with credit/debit cards, easier onboarding, instant payment confirmation
- **Implementation**: Tabbed interface with Stripe tab selected by default, BTCPay as secondary option

**BTCPay Server Choice**:
- **Alternative Considered**: Coinbase Commerce, BitPay
- **Why BTCPay**: Self-hosted (full control), no fees, supports Bitcoin and Lightning Network, no KYC requirements, censorship-resistant
- **Trade-off**: Requires running own server, more complex setup, but aligns with project values

---

## Database Schema Design

### Decision: 7-Table Normalized Schema in `donations` PostgreSQL Schema

**Tables**:
1. `donations` - Core donation records
2. `donation_allocations` - How donations split across projects
3. `funding_projects` - Projects that can receive funding
4. `funding_goals` - Time-limited fundraising campaigns
5. `expenses` - Organization spending records
6. `expense_categories` - Categorization of expenses
7. `monthly_summaries` - Pre-calculated aggregations

**Why This Design**:

#### 1. Separate Allocations Table
**What**: `donation_allocations` table instead of embedding project_id in donations

**Why**:
- **Flexibility**: Single donation can split across multiple projects (future feature)
- **Reporting**: Easy to query "How much has Project X received?"
- **Audit Trail**: Clear record of how each dollar was allocated
- **Percentage Support**: Store allocation percentages for complex splits

**Example**:
```sql
-- User donates $100, split 70% to Project A, 30% to Project B
INSERT INTO donations (amount, ...) VALUES (100.00, ...);
INSERT INTO donation_allocations VALUES (donation_id, project_a_id, 70);
INSERT INTO donation_allocations VALUES (donation_id, project_b_id, 30);
```

**Alternative Considered**: Store `project_id` directly in `donations` table
- **Rejected**: Doesn't support multi-project donations, harder to extend

#### 2. Monthly Summaries Table
**What**: Pre-calculated monthly aggregations

**Why**:
- **Performance**: Computing totals across thousands of donations is expensive
- **Consistency**: Ensures dashboard always shows same numbers
- **Speed**: Dashboard loads instantly even with 10,000+ donations
- **Simplicity**: Complex queries run once per month instead of on every page load

**Trade-off**: Requires maintenance (recalculate when donations/expenses change)
- **Mitigation**: Service layer automatically updates summaries on create/update

**Example**:
```sql
-- Instead of calculating monthly totals on every request:
SELECT SUM(amount) FROM donations WHERE created_at >= '2025-01-01' AND created_at < '2025-02-01'

-- Use pre-calculated value:
SELECT total_donations FROM monthly_summaries WHERE year = 2025 AND month = 1
```

#### 3. Funding Goals vs Funding Projects
**What**: Separate tables instead of single "campaigns" table

**Why**:
- **Projects are permanent**: NOXII, AUTUMN, etc. exist forever
- **Goals are temporary**: "Q1 2025 Development Fund" has start/end dates
- **Multiple Goals per Project**: Project can have multiple concurrent goals (stretch goals, time-limited campaigns)
- **Recurring Support**: Goals can recur monthly/quarterly/yearly

**Example**:
```
Project: NOXII (permanent)
├─ Goal: "Q1 2025 Development" ($5,000 target, ends March 31)
├─ Goal: "Art Kickstarter" ($10,000 target, ends April 15)
└─ Goal: "Monthly Patron Drive" (recurring monthly, $1,000 target)
```

#### 4. Expense Categories
**What**: Separate table with colors and icons

**Why**:
- **Consistency**: All expenses use same categorization
- **Visualization**: Pie charts need consistent colors
- **Reusability**: Categories defined once, used everywhere
- **Extensibility**: Easy to add new categories without code changes

**Categories Chosen**:
- Taxes (red #ef4444)
- Assets (orange #f59e0b) - Equipment, licenses
- API Services (blue #3b82f6) - AWS, Stripe fees
- Infrastructure (purple #8b5cf6) - Hosting, domain
- Development (green #10b981) - Contractor payments

**Alternative Considered**: Enum or string field in expenses table
- **Rejected**: Can't store color/icon metadata, harder to change categories

---

## Allocation Model

### Decision: User-Controlled Allocation (Current), Admin-Controlled (Future)

**Current Implementation**: User chooses project when donating

**Why User-Controlled**:
- **Transparency**: Donors know exactly where their money goes
- **Engagement**: Donors feel more connected to specific projects
- **Simplicity**: No complex admin rules to configure
- **Trust**: Users control their donation, not organization

**How It Works**:
```typescript
// User selects project in donation form
<select value={projectId} onChange={...}>
  <option value="1">NOXII</option>
  <option value="2">AUTUMN</option>
</select>

// Creates allocation record
donation_allocations: {
  donation_id: 123,
  project_id: 1,  // User selected NOXII
  percentage: 100
}
```

**Future: Admin-Controlled Option**:
- **Use Case**: "Split all donations 50% development, 30% art, 20% infrastructure"
- **Why Not Default**: Less transparent, users might distrust it
- **When Useful**: General fund donations where user doesn't care about split

**Implementation Ready**: Database and service layer already support both models

---

## Campaign System Design

### Decision: Flexible Goal System with Recurring Support

**Features**:
1. **Time-Limited Campaigns**: Start date, optional end date
2. **Recurring Campaigns**: Monthly, quarterly, yearly goals
3. **Multiple Active Goals**: Project can have multiple concurrent campaigns
4. **Auto-Deactivation**: Goals automatically deactivate on end_date

**Why This Design**:

#### 1. Optional End Date
**What**: `end_date` column is nullable

**Why**:
- **Ongoing Goals**: Some projects need continuous funding ("NOXII Development Fund")
- **Time-Limited Pushes**: Other goals are sprints ("Q1 2025 Kickstarter")
- **Flexibility**: Admins can choose appropriate model per campaign

**Example**:
```sql
-- Ongoing goal (no end date)
INSERT INTO funding_goals (title, end_date, ...) VALUES ('General Fund', NULL, ...);

-- Time-limited goal
INSERT INTO funding_goals (title, end_date, ...) VALUES ('Q1 2025 Push', '2025-03-31', ...);
```

#### 2. Recurring Campaigns
**What**: `is_recurring` flag + `recurrence_period` field

**Why**:
- **Predictable Fundraising**: "We need $1,000/month for server costs"
- **Automation Ready**: System can auto-create next month's goal
- **Transparency**: Users see monthly targets clearly

**Example**:
```sql
-- Monthly server costs campaign
INSERT INTO funding_goals (
  title, target_amount, is_recurring, recurrence_period
) VALUES (
  'Monthly Server Costs', 1000.00, TRUE, 'monthly'
);
```

**Future Automation**:
```typescript
// Cron job runs on 1st of each month
if (goal.is_recurring && goal.end_date <= today) {
  createNextRecurringGoal(goal);
}
```

#### 3. Progress Tracking
**What**: `current_amount` column updated by triggers

**Why**:
- **Performance**: Don't calculate SUM() on every request
- **Accuracy**: Single source of truth for goal progress
- **Real-time UI**: Dashboard shows instant progress updates

**Implementation**:
```sql
-- Automatically update goal progress when donation allocated
CREATE TRIGGER update_goal_progress
AFTER INSERT ON donation_allocations
FOR EACH ROW
BEGIN
  UPDATE funding_goals
  SET current_amount = current_amount + (
    SELECT amount * (NEW.percentage / 100.0)
    FROM donations
    WHERE id = NEW.donation_id
  )
  WHERE project_id = (
    SELECT project_id FROM funding_projects WHERE id = NEW.project_id
  );
END;
```

**Alternative Considered**: Calculate progress on-the-fly
- **Rejected**: Too slow with thousands of donations, inconsistent

---

## Service Layer Pattern

### Decision: Centralized `DonationService` Class

**What**: Single TypeScript class with all donation business logic

**Why**:
1. **Encapsulation**: Database queries hidden behind clean methods
2. **Reusability**: Same logic used by API routes, admin pages, webhooks
3. **Testability**: Easy to mock and unit test
4. **Type Safety**: Full TypeScript types for all operations
5. **Single Source of Truth**: One place to update business rules

**Pattern**:
```typescript
class DonationService {
  // Public API
  async createDonation(data: CreateDonationDTO): Promise<Donation>
  async updatePaymentStatus(paymentId: string, status: PaymentStatus): Promise<Donation>
  async getTransparencyMetrics(): Promise<TransparencyMetrics>

  // Private helpers
  private async updateMonthlySummaries(donation: Donation): Promise<void>
  private async calculateExpenseBreakdown(year: number): Promise<ExpenseCategoryBreakdown[]>
}

// Usage in API route
import { donationService } from '@/lib/donations/service';

const donation = await donationService.createDonation({ ... });
```

**Alternative Considered**: Direct database calls in API routes
- **Rejected**: Duplicated logic, harder to test, no type safety

**Why Not Repository Pattern**:
- **Simplicity**: Service layer is sufficient for this domain
- **No ORM**: We use raw SQL, not an ORM that needs repositories
- **Overkill**: Repository pattern adds extra abstraction with little benefit

---

## Security Architecture

### Decision: Multi-Layer Security with CSRF Protection

**Layers**:
1. **CSRF Protection**: Double-submit cookie pattern
2. **Input Validation**: Zod schemas + inline checks
3. **SQL Injection Protection**: Parameterized queries
4. **XSS Protection**: React auto-escaping
5. **Admin Authentication**: Role-based access control

### 1. CSRF Protection

**What**: `withSecurity()` middleware + `fetchJSON()` wrapper

**Why**:
- **Attack Prevention**: Protects against Cross-Site Request Forgery
- **Compliance**: Industry standard for web security
- **Transparency**: Makes security explicit in code

**Implementation**:
```typescript
// API route (server-side)
export const POST = withSecurity(POSTHandler, { enableCSRF: true });

// Client-side fetch
const data = await fetchJSON('/api/donations/stripe', {
  method: 'POST',
  body: { amount: 10, projectId: 1 }
});
// fetchJSON() automatically adds CSRF token
```

**How It Works**:
1. Server sets `csrf-token` cookie on page load
2. Client reads cookie, sends as `X-CSRF-Token` header
3. Server validates token matches cookie
4. Request fails if tokens don't match

**Alternative Considered**: SameSite cookie attribute only
- **Rejected**: Not supported by all browsers, CSRF middleware is more robust

### 2. Input Validation

**What**: Validate all user input before database operations

**Why**:
- **Data Integrity**: Prevent invalid data in database
- **Security**: Block injection attempts
- **User Experience**: Clear error messages

**Example**:
```typescript
// Validate amount
if (!body.amount || body.amount < 0.01) {
  return NextResponse.json({ error: 'Amount must be at least $0.01' }, { status: 400 });
}

// Validate email format
if (body.donorEmail && !isValidEmail(body.donorEmail)) {
  return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
}
```

**Alternative Considered**: Rely on database constraints only
- **Rejected**: Database errors are cryptic, worse UX, doesn't prevent all attacks

### 3. Admin Authentication

**What**: Check user role before admin operations

**Why**:
- **Authorization**: Only admins can add expenses, create campaigns
- **Audit Trail**: Know who performed admin actions
- **Security**: Prevent unauthorized data modification

**Implementation**:
```typescript
async function POSTHandler(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  // ... proceed with admin operation
}
```

**Alternative Considered**: API keys instead of sessions
- **Rejected**: Sessions are more secure, built into Next.js auth

---

## Transparency Dashboard

### Decision: Public Real-Time Dashboard on Homepage

**What**: Publicly visible dashboard showing all financial data

**Why**:
1. **Trust**: Users see exactly where money goes
2. **Accountability**: Organization held to high standard
3. **Engagement**: Users understand project funding status
4. **Differentiation**: Most organizations hide financial data

**What's Shown**:
- Total donations (all-time, this year, this month)
- Expense breakdown by category (pie chart)
- Project funding totals
- Active campaign progress
- Monthly trends (future)

**What's NOT Shown**:
- Individual donor names/emails (unless donor opts-in)
- Exact transaction timestamps (prevents correlation attacks)
- Pending/failed donations (only settled)

**Privacy Considerations**:
- Anonymous donations: Display as "Anonymous"
- Named donations: Only show if `is_anonymous = FALSE` AND donor provided name
- Emails: Never displayed publicly
- Amounts: Aggregated to prevent identifying individuals

**Alternative Considered**: Admin-only dashboard
- **Rejected**: Defeats purpose of transparency, reduces trust

**Why Real-Time**:
- **Accuracy**: Users see current status, not month-old data
- **Engagement**: Users check back to see progress
- **Motivation**: Seeing progress bar fill encourages more donations

**Performance**: Pre-calculated monthly summaries make this fast

---

## Technology Choices

### 1. PostgreSQL for Production

**What**: PostgreSQL 15 with 13 schemas

**Why**:
- **Reliability**: ACID compliance, proven at scale
- **Performance**: Handles thousands of transactions per second
- **Features**: JSON support, full-text search, triggers
- **Open Source**: No vendor lock-in, community support

**Alternative Considered**: SQLite (development only)
- **Decision**: SQLite for localhost dev, PostgreSQL for production
- **Why**: SQLite doesn't support concurrent writes, not suitable for production

### 2. Next.js 15 App Router

**What**: React 19 + Next.js 15 with App Router

**Why**:
- **Server Components**: Better performance, less JavaScript
- **API Routes**: Built-in backend, no separate server needed
- **TypeScript**: Full type safety across stack
- **Deployment**: Easy to deploy on Coolify/Vercel/self-hosted

**Alternative Considered**: Separate Express backend
- **Rejected**: More complexity, harder to deploy, duplicated types

### 3. Recharts for Visualizations

**What**: React charting library based on D3

**Why**:
- **React Native**: Works perfectly with React Server Components
- **Customizable**: Full control over chart appearance
- **Responsive**: Mobile-friendly out of the box
- **Type Safe**: Full TypeScript support

**Alternative Considered**: Chart.js
- **Why Not**: Less React-friendly, requires DOM manipulation

### 4. Tailwind CSS

**What**: Utility-first CSS framework

**Why**:
- **Dark Theme**: Built-in dark mode support
- **Consistency**: Design system enforced through classes
- **Performance**: Purges unused CSS, tiny bundle
- **Productivity**: No context switching between files

**Alternative Considered**: Styled Components
- **Why Not**: Larger bundle, runtime overhead, harder to theme

---

## Trade-offs and Alternatives

### Trade-off 1: Stripe Fees vs Control

**Decision**: Accept Stripe's 2.9% + $0.30 fee

**Trade-off**:
- **Pro**: Easy integration, trusted by users, instant settlement
- **Con**: Fees reduce net donations, Stripe controls account

**Alternative**: Direct bank transfers (ACH)
- **Why Not**: Requires bank integration, harder UX, slower settlement

**Mitigation**: Offer BTCPay for users who want to avoid fees

### Trade-off 2: Pre-Calculated Summaries vs Real-Time

**Decision**: Pre-calculate monthly summaries

**Trade-off**:
- **Pro**: Instant dashboard loading, consistent numbers
- **Con**: Requires maintenance, can get out of sync

**Alternative**: Calculate on every request
- **Why Not**: Too slow with 10,000+ donations, expensive queries

**Mitigation**: Service layer automatically updates summaries

### Trade-off 3: User-Controlled vs Admin-Controlled Allocation

**Decision**: User-controlled by default

**Trade-off**:
- **Pro**: More transparent, users trust it more
- **Con**: Some donations might go to lower-priority projects

**Alternative**: Admin sets allocation rules
- **Why Not**: Less transparent, users might not trust it

**Mitigation**: Support both models, let user choose

### Trade-off 4: Public Transparency vs Privacy

**Decision**: Public dashboard with anonymity options

**Trade-off**:
- **Pro**: Builds trust, encourages donations
- **Con**: Some donors want complete privacy

**Alternative**: Private dashboard (admins only)
- **Why Not**: Defeats purpose, reduces trust

**Mitigation**: Allow donors to be fully anonymous

---

## Future Considerations

### 1. Recurring Donations (Subscriptions)

**What**: Users commit to monthly/yearly donations

**Why**:
- **Predictable Revenue**: Know monthly income in advance
- **User Convenience**: Set it and forget it
- **Higher Lifetime Value**: Recurring donors give more over time

**Implementation**:
- **Stripe Subscriptions**: Built-in support, easy to implement
- **BTCPay**: Requires custom solution (generate new invoice monthly)

**Database Schema**: Already supports this (add `is_recurring` to donations)

### 2. Email Receipts

**What**: Automatically email donation receipt/confirmation

**Why**:
- **Tax Deduction**: Users need receipts for taxes
- **Professionalism**: Expected by donors
- **Engagement**: Opportunity to thank donors, share updates

**Implementation**:
- **Service**: Resend, SendGrid, or self-hosted SMTP
- **Trigger**: Webhook fires when payment settles
- **Template**: Beautiful HTML email with donation details

### 3. Multi-Currency Support

**What**: Better handling of EUR, GBP, CAD, etc.

**Current**: Store everything as USD equivalent

**Future**:
- Store original currency + USD equivalent
- Display amounts in user's preferred currency
- Accurate historical exchange rates

**Challenge**: Exchange rate volatility, especially with crypto

### 4. Donation Matching

**What**: "Company X will match your donation 2:1!"

**Why**:
- **Motivation**: Donors feel their impact is doubled
- **Fundraising**: Common campaign tactic

**Implementation**:
- Database: Add `matched_by` field to donations
- UI: Show match status on transparency dashboard
- Admin: Create "matching campaign" with budget

### 5. Donation Tiers/Rewards

**What**: "Donate $50+ and get exclusive Discord role"

**Why**:
- **Gamification**: Makes donating fun
- **Recognition**: Donors get public acknowledgment
- **Motivation**: Encourages larger donations

**Implementation**:
- Database: Add `tier_id` to donations
- Integration: Webhook fires to grant rewards
- UI: Show available tiers on donation page

### 6. Pledge Campaigns (Kickstarter-Style)

**What**: "We'll only charge you if we reach the goal"

**Why**:
- **Risk Reduction**: Donors know project is viable before committing money
- **Urgency**: Creates deadline pressure
- **All-or-Nothing**: Ensures sufficient funding

**Implementation**:
- Stripe: Use Payment Intents with manual capture
- BTCPay: Requires custom escrow solution
- Database: Add `is_pledge` flag to goals

### 7. Corporate Sponsorships

**What**: Different donation flow for companies (invoices, contracts)

**Why**:
- **Large Amounts**: Companies donate more than individuals
- **Different Process**: Need invoices, tax forms, contracts
- **Branding**: Logo placement on website

**Implementation**:
- Separate form for corporate donations
- Manual invoice generation (for now)
- Sponsor tier system (Bronze/Silver/Gold)

### 8. Anonymous Analytics

**What**: Track donation trends without tracking individuals

**Why**:
- **Insights**: Understand what motivates donors
- **Optimization**: Improve donation page conversion
- **Privacy**: No personal data collected

**Implementation**:
- Plausible Analytics (privacy-friendly)
- Track: Page views, button clicks, donation amounts (aggregated)
- Don't Track: Individual users, cross-site behavior

---

## Lessons Learned

### What Went Well

1. **Early Type Definitions**: Defining TypeScript types first made implementation smooth
2. **Service Layer**: Centralized business logic made testing and refactoring easy
3. **Database Design**: 7-table schema is flexible and performant
4. **Documentation**: Comprehensive docs made handoff and onboarding seamless

### What Could Be Improved

1. **Testing Earlier**: Should have written tests during implementation, not after
2. **UI Mockups**: Visual mockups would have saved time on UI iteration
3. **Performance Testing**: Should have load-tested with 10,000+ donations earlier
4. **Webhook Security**: Took several iterations to get signature verification right

### Recommendations for Future Features

1. **Start with Types**: Define TypeScript interfaces before writing code
2. **Document Decisions**: Write down "why" as you go, not after
3. **Test Early**: Write tests alongside features, not after
4. **Security First**: Consider security implications before implementation
5. **User Feedback**: Test with real users early and often

---

## References

- **Original Research**: `docs/BTCPAY_SERVER_RESEARCH_REPORT.md`
- **Complete Architecture**: `docs/features/DONATIONS_SYSTEM_COMPLETE_ARCHITECTURE.md`
- **Implementation Plan**: `docs/features/DONATIONS_PHASE_2_IMPLEMENTATION_PLAN.md`
- **Database Schema**: `/home/user/Projects/veritable-games-main/backend/schema/donations.sql`
- **Service Layer**: `frontend/src/lib/donations/service.ts`
- **Type Definitions**: `frontend/src/lib/donations/types.ts`

---

**End of Architectural Decisions Document**

_This document should be updated as new decisions are made or existing decisions are reconsidered._
