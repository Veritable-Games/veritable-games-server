# Stripe vs Polar.sh: Comprehensive Comparison for Veritable Games Donation Platform

**Analysis Date:** November 20, 2025
**Project:** Veritable Games multi-project donation system

---

## Executive Summary

**TL;DR Recommendation:** **Stripe** is the better choice for your use case.

**Why:**
- Lower fees (2.9% vs 4%)
- Better support for custom multi-project allocation
- More mature tax/compliance handling
- Full control over donation flow (no redirects)
- Better suited for complex transparency dashboards

**When Polar.sh makes sense:**
- If you want to launch in 2-3 days (vs 1-2 weeks with Stripe)
- If you prioritize open-source branding/discovery
- If you're okay with higher fees for simpler setup

---

## Feature Comparison Matrix

| Feature | Stripe | Polar.sh | Winner |
|---------|--------|----------|--------|
| **Pricing** | 2.9% + $0.30 | 4% | ✅ Stripe |
| **Setup Time** | 1-2 weeks | 2-3 days | ✅ Polar.sh |
| **Multi-Project Support** | Custom (full control) | Limited (1 product = 1 project) | ✅ Stripe |
| **Funding Goals** | Custom implementation | Built-in | ✅ Polar.sh |
| **Transparency Dashboard** | Full control (custom) | Limited API | ✅ Stripe |
| **Tax Compliance** | Stripe Tax (automatic) | Manual | ✅ Stripe |
| **Recurring Donations** | Full control | Built-in | 🟰 Tie |
| **Next.js SDK** | `@stripe/stripe-js` | `@polar-sh/sdk` | 🟰 Tie |
| **Customization** | Full (white-label) | Limited (Polar branding) | ✅ Stripe |
| **International Support** | 135+ currencies | Limited | ✅ Stripe |
| **API Quality** | Excellent docs | Good docs | ✅ Stripe |
| **Donor Experience** | On-site checkout | Redirect to Polar.sh | ✅ Stripe |
| **Metadata/Tags** | Unlimited custom fields | Limited | ✅ Stripe |
| **Webhooks** | Robust, battle-tested | Good | ✅ Stripe |

**Score: Stripe wins 10/13**

---

## Cost Analysis

### Scenario 1: $1,000/month in donations

| Platform | Monthly Fee | Annual Fee | 5-Year Cost |
|----------|-------------|------------|-------------|
| **Stripe** | $32 | $384 | $1,920 |
| **Polar.sh** | $40 | $480 | $2,400 |
| **Difference** | **-$8** | **-$96** | **-$480** |

### Scenario 2: $5,000/month in donations

| Platform | Monthly Fee | Annual Fee | 5-Year Cost |
|----------|-------------|------------|-------------|
| **Stripe** | $160 | $1,920 | $9,600 |
| **Polar.sh** | $200 | $2,400 | $12,000 |
| **Difference** | **-$40** | **-$480** | **-$2,400** |

### Scenario 3: $10,000/month in donations

| Platform | Monthly Fee | Annual Fee | 5-Year Cost |
|----------|-------------|------------|-------------|
| **Stripe** | $320 | $3,840 | $19,200 |
| **Polar.sh** | $400 | $4,800 | $24,000 |
| **Difference** | **-$80** | **-$960** | **-$4,800** |

**Verdict:** Stripe saves you **$960-$4,800/year** depending on donation volume.

---

## Your Specific Requirements Analysis

### 1. Multi-Project Funding (5 projects)

**Your need:** Donors allocate donations across:
- Forums
- Wiki
- Library
- Projects
- General Fund

#### Stripe Approach ✅ Better

**Pros:**
- Store allocation in `metadata` field (unlimited JSON)
- Single payment, split on your backend
- Full control over allocation UI
- Easy to add/remove projects

**Implementation:**
```typescript
// Stripe Payment Intent with metadata
const paymentIntent = await stripe.paymentIntents.create({
  amount: 10000, // $100
  currency: 'usd',
  metadata: {
    allocation: JSON.stringify({
      forums: 20,    // 20%
      wiki: 30,      // 30%
      library: 25,   // 25%
      projects: 15,  // 15%
      general: 10    // 10%
    }),
    donor_email: 'donor@example.com',
    donor_name: 'Jane Doe'
  }
});
```

**Database storage:**
```sql
-- Single donation record
INSERT INTO donations (total_amount, stripe_payment_id, metadata)
VALUES (100.00, 'pi_xxx', '{"allocation": {...}}');

-- Split into project allocations
INSERT INTO donation_allocations (donation_id, project_id, amount)
VALUES
  (1, 'forums', 20.00),
  (1, 'wiki', 30.00),
  (1, 'library', 25.00),
  (1, 'projects', 15.00),
  (1, 'general', 10.00);
```

#### Polar.sh Approach ❌ Limited

**Cons:**
- 1 "product" = 1 project
- Donor would need to make 5 separate payments
- No built-in allocation splitting
- Awkward UX

**Workaround (messy):**
```typescript
// Would need 5 separate products
const products = [
  { id: 'prod_forums', name: 'Support Forums' },
  { id: 'prod_wiki', name: 'Support Wiki' },
  { id: 'prod_library', name: 'Support Library' },
  { id: 'prod_projects', name: 'Support Projects' },
  { id: 'prod_general', name: 'General Fund' }
];

// Donor selects ONE per payment
// OR you create a custom "bundle" product (loses transparency)
```

**Winner:** **Stripe** - native support for custom allocation

---

### 2. Transparency Dashboard

**Your need:**
- Total raised (all-time, this year, this month)
- Monthly earning trends
- Expense breakdown by category
- Per-project funding status

#### Stripe Approach ✅ Better

**Pros:**
- Full access to raw transaction data
- Unlimited historical queries
- Rich metadata for expense categorization
- Direct SQL aggregation on your database

**API capabilities:**
```typescript
// Fetch all donations with filters
const charges = await stripe.charges.list({
  created: { gte: startOfMonth, lte: endOfMonth },
  limit: 100
});

// Aggregate on your backend
const monthlyTotal = charges.data.reduce((sum, charge) =>
  sum + charge.amount, 0
);

// Query your database for trends
const monthlyTrends = await db.query(`
  SELECT
    DATE_TRUNC('month', created_at) as month,
    SUM(amount) as total,
    COUNT(*) as donation_count
  FROM donations
  WHERE created_at >= NOW() - INTERVAL '12 months'
  GROUP BY month
  ORDER BY month DESC
`);
```

**Expense tracking:**
```sql
-- Link expenses to categories
CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  amount DECIMAL(10,2),
  category TEXT, -- 'taxes', 'assets', 'api', 'infrastructure'
  description TEXT,
  receipt_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Generate transparency report
SELECT
  category,
  SUM(amount) as total_spent,
  ROUND(SUM(amount) / (SELECT SUM(amount) FROM expenses) * 100, 2) as percentage
FROM expenses
WHERE created_at >= DATE_TRUNC('month', NOW())
GROUP BY category;
```

#### Polar.sh Approach ❌ Limited

**Cons:**
- GraphQL API has limited historical data
- No built-in expense tracking
- Would need to build parallel system
- Less granular filtering

**API example:**
```graphql
query {
  organization(id: "your-org-id") {
    # Limited aggregates
    totalRevenue { amount currency }

    # Can't easily filter by date range
    pledges(first: 100) {
      nodes {
        amount { amount }
        createdAt
      }
    }
  }
}
```

**Winner:** **Stripe** - full data ownership and flexibility

---

### 3. Funding Goals

**Your need:** Time-bound goals with progress tracking

#### Polar.sh Approach ✅ Built-in

**Pros:**
- Native funding goal support
- Progress bars included
- Goal deadline tracking
- Public/private goals

**API:**
```typescript
import { Polar } from '@polar-sh/sdk';

const polar = new Polar({ accessToken: process.env.POLAR_API_KEY });

// Create funding goal
await polar.fundingGoals.create({
  title: "New Forum Moderation Tools",
  amount: 5000,
  deadline: "2025-12-31",
  projectId: "proj_forums"
});

// Fetch progress
const goals = await polar.fundingGoals.list();
// Returns: { id, title, amount, pledged, percentage, deadline }
```

#### Stripe Approach ⚠️ Custom Implementation

**Cons:**
- No built-in concept of "goals"
- Need to build from scratch

**Implementation:**
```typescript
// Database schema
CREATE TABLE funding_goals (
  id SERIAL PRIMARY KEY,
  project_id TEXT,
  title TEXT,
  target_amount DECIMAL(10,2),
  current_amount DECIMAL(10,2) DEFAULT 0,
  deadline TIMESTAMP,
  status TEXT DEFAULT 'active' -- active, completed, expired
);

// Update goal progress (triggered by webhook)
async function updateGoalProgress(projectId: string, amount: number) {
  await db.query(`
    UPDATE funding_goals
    SET current_amount = current_amount + $1
    WHERE project_id = $2
      AND status = 'active'
      AND deadline > NOW()
  `, [amount, projectId]);
}

// Check if goal completed
const goal = await db.query(`
  SELECT
    *,
    ROUND(current_amount / target_amount * 100, 2) as percentage
  FROM funding_goals
  WHERE id = $1
`);

if (goal.percentage >= 100) {
  await db.query(`UPDATE funding_goals SET status = 'completed' WHERE id = $1`, [goal.id]);
}
```

**Winner:** **Polar.sh** - saves 2-3 days of development time

**But:** Funding goals are straightforward to build (1-2 days), and Stripe's custom approach gives you more control over goal types (stretch goals, milestone goals, etc.)

---

### 4. Minimal, Expandable UI

**Your need:** Floating button → expandable panel

Both platforms support this equally well since the UI is entirely custom on your end.

#### Stripe Implementation

```tsx
// components/DonationWidget.tsx
'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ProjectSelector from './ProjectSelector';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function DonationWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [allocation, setAllocation] = useState({
    forums: 20,
    wiki: 20,
    library: 20,
    projects: 20,
    general: 20
  });
  const [amount, setAmount] = useState(10);

  async function handleDonate() {
    const stripe = await stripePromise;

    // Create payment intent
    const response = await fetch('/api/donations/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, allocation })
    });

    const { clientSecret } = await response.json();

    // Redirect to Stripe Checkout (or use embedded form)
    const { error } = await stripe!.confirmPayment({
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/donation/success`
      }
    });
  }

  return (
    <>
      {/* Floating button (bottom-right) */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            className="fixed bottom-6 right-6 rounded-full shadow-lg"
            size="lg"
          >
            ❤️ Support Us
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <h2 className="text-2xl font-bold">Support Veritable Games</h2>

          {/* Amount selector */}
          <div className="space-y-4">
            <label>Donation Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={1}
            />
          </div>

          {/* Project allocation */}
          <ProjectSelector
            allocation={allocation}
            onChange={setAllocation}
          />

          {/* Donate button */}
          <Button onClick={handleDonate} size="lg" className="w-full">
            Donate ${amount}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

#### Polar.sh Implementation

```tsx
// components/DonationWidget.tsx
'use client';

import { useState } from 'react';
import { Polar } from '@polar-sh/sdk';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const polar = new Polar({ accessToken: process.env.NEXT_PUBLIC_POLAR_ACCESS_TOKEN! });

export default function DonationWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState('forums');
  const [amount, setAmount] = useState(10);

  async function handleDonate() {
    // Create checkout session
    const checkout = await polar.checkouts.create({
      productPriceId: `price_${selectedProject}`, // Pre-created products
      successUrl: `${window.location.origin}/donation/success`,
      amount: amount * 100 // cents
    });

    // Redirect to Polar.sh checkout
    window.location.href = checkout.url;
  }

  return (
    <>
      {/* Floating button */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            className="fixed bottom-6 right-6 rounded-full shadow-lg"
            size="lg"
          >
            ❤️ Support Us
          </Button>
        </DialogTrigger>

        <DialogContent>
          <h2 className="text-2xl font-bold">Support Veritable Games</h2>

          {/* Amount */}
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />

          {/* Project selector (radio buttons) */}
          <div className="space-y-2">
            {['forums', 'wiki', 'library', 'projects', 'general'].map(project => (
              <label key={project} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="project"
                  value={project}
                  checked={selectedProject === project}
                  onChange={(e) => setSelectedProject(e.target.value)}
                />
                {project}
              </label>
            ))}
          </div>

          {/* Donate button (redirects to Polar.sh) */}
          <Button onClick={handleDonate} size="lg" className="w-full">
            Donate ${amount}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

**Key difference:**
- **Stripe:** Checkout happens on your site (embedded form or redirect to Stripe-hosted page)
- **Polar.sh:** Always redirects to polar.sh domain for checkout

**Winner:** **Stripe** - better donor experience (no redirect)

---

### 5. Tax Compliance & Receipts

#### Stripe Tax ✅ Automatic

**Pros:**
- Automatic tax calculation for 50+ countries
- Compliant receipts with tax breakdown
- Handles VAT, GST, sales tax
- No manual configuration

**Example:**
```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount: 10000,
  currency: 'usd',
  automatic_tax: { enabled: true }, // Stripe calculates tax
  receipt_email: 'donor@example.com' // Auto-send receipt
});
```

#### Polar.sh ⚠️ Manual

**Cons:**
- You handle tax compliance
- Manual receipt generation
- No built-in tax calculation

**Winner:** **Stripe** - critical for international donors

---

### 6. Recurring Donations

Both support recurring donations well.

#### Stripe Subscriptions

```typescript
const subscription = await stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: 'price_monthly_supporter' }],
  metadata: {
    allocation: JSON.stringify({ forums: 50, wiki: 50 })
  }
});
```

#### Polar.sh Subscriptions

```typescript
const subscription = await polar.subscriptions.create({
  productPriceId: 'price_monthly',
  interval: 'month'
});
```

**Winner:** 🟰 Tie (both excellent)

---

## Implementation Complexity

### Stripe Setup (1-2 weeks)

**Week 1:**
1. Create Stripe account (30 mins)
2. Install SDK: `npm install stripe @stripe/stripe-js` (5 mins)
3. Set up webhook endpoint (2-3 hours)
4. Build donation API routes (1 day)
5. Create database schema (4 hours)
6. Build donation widget UI (2 days)

**Week 2:**
7. Implement funding goals (1-2 days)
8. Build transparency dashboard (2-3 days)
9. Test payment flow (1 day)
10. Deploy to production (1 day)

**Total: 8-10 days**

### Polar.sh Setup (2-3 days)

**Day 1:**
1. Create Polar account (30 mins)
2. Install SDK: `npm install @polar-sh/sdk` (5 mins)
3. Create 5 products (1 hour)
4. Set up webhook endpoint (1-2 hours)
5. Build donation widget UI (4 hours)

**Day 2-3:**
6. Configure funding goals (2 hours)
7. Build transparency dashboard (1 day)
8. Test payment flow (4 hours)
9. Deploy to production (2 hours)

**Total: 2-3 days**

**Winner:** **Polar.sh** - 3-4x faster setup

**But:** The extra week with Stripe gives you:
- Better multi-project support
- Full customization
- Lower long-term costs
- Better tax compliance

---

## Code Comparison: Full Implementation

### Stripe: Complete Donation Flow

```typescript
// app/api/donations/create/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia'
});

export async function POST(req: Request) {
  const { amount, allocation, email } = await req.json();

  // Validate allocation sums to 100%
  const total = Object.values(allocation).reduce((sum: number, pct: any) => sum + pct, 0);
  if (total !== 100) {
    return NextResponse.json({ error: 'Allocation must sum to 100%' }, { status: 400 });
  }

  // Create payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount * 100, // Convert to cents
    currency: 'usd',
    automatic_tax: { enabled: true },
    receipt_email: email,
    metadata: {
      allocation: JSON.stringify(allocation),
      donor_email: email,
      timestamp: new Date().toISOString()
    }
  });

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret
  });
}
```

```typescript
// app/api/webhooks/stripe/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const { allocation, donor_email } = paymentIntent.metadata;

    // Store donation
    const donation = await db.query(`
      INSERT INTO donations (
        stripe_payment_id,
        total_amount,
        donor_email,
        metadata
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [
      paymentIntent.id,
      paymentIntent.amount / 100,
      donor_email,
      allocation
    ]);

    // Split into project allocations
    const allocationObj = JSON.parse(allocation);
    const donationId = donation.rows[0].id;

    for (const [project, percentage] of Object.entries(allocationObj)) {
      const amount = (paymentIntent.amount / 100) * (percentage as number / 100);

      await db.query(`
        INSERT INTO donation_allocations (donation_id, project_id, amount, percentage)
        VALUES ($1, $2, $3, $4)
      `, [donationId, project, amount, percentage]);

      // Update funding goals
      await db.query(`
        UPDATE funding_goals
        SET current_amount = current_amount + $1
        WHERE project_id = $2
          AND status = 'active'
          AND deadline > NOW()
      `, [amount, project]);
    }
  }

  return NextResponse.json({ received: true });
}
```

```typescript
// app/api/transparency/metrics/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  // Total raised (all-time)
  const totalRaised = await db.query(`
    SELECT SUM(total_amount) as total
    FROM donations
    WHERE status = 'completed'
  `);

  // Monthly trends (last 12 months)
  const monthlyTrends = await db.query(`
    SELECT
      DATE_TRUNC('month', created_at) as month,
      SUM(total_amount) as total,
      COUNT(*) as donation_count
    FROM donations
    WHERE created_at >= NOW() - INTERVAL '12 months'
      AND status = 'completed'
    GROUP BY month
    ORDER BY month DESC
  `);

  // Per-project breakdown
  const projectBreakdown = await db.query(`
    SELECT
      project_id,
      SUM(amount) as total_raised,
      COUNT(DISTINCT donation_id) as donation_count
    FROM donation_allocations
    GROUP BY project_id
  `);

  // Expense breakdown
  const expenses = await db.query(`
    SELECT
      category,
      SUM(amount) as total_spent,
      ROUND(SUM(amount) / NULLIF((SELECT SUM(amount) FROM expenses), 0) * 100, 2) as percentage
    FROM expenses
    WHERE created_at >= DATE_TRUNC('month', NOW())
    GROUP BY category
  `);

  return NextResponse.json({
    totalRaised: totalRaised.rows[0].total || 0,
    monthlyTrends: monthlyTrends.rows,
    projectBreakdown: projectBreakdown.rows,
    expenses: expenses.rows
  });
}
```

### Polar.sh: Complete Donation Flow

```typescript
// app/api/donations/create/route.ts
import { NextResponse } from 'next/server';
import { Polar } from '@polar-sh/sdk';

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!
});

export async function POST(req: Request) {
  const { amount, projectId } = await req.json();

  // Create checkout session (redirects to Polar.sh)
  const checkout = await polar.checkouts.create({
    productPriceId: `price_${projectId}`, // Pre-created product
    amount: amount * 100,
    successUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/donation/success`,
    metadata: {
      project_id: projectId
    }
  });

  return NextResponse.json({
    checkoutUrl: checkout.url
  });
}
```

```typescript
// app/api/webhooks/polar/route.ts
import { NextResponse } from 'next/server';
import { Polar } from '@polar-sh/sdk';
import { db } from '@/lib/db';

const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN! });

export async function POST(req: Request) {
  const event = await req.json();

  if (event.type === 'checkout.completed') {
    const checkout = event.data;

    // Store donation
    await db.query(`
      INSERT INTO donations (
        polar_checkout_id,
        total_amount,
        project_id,
        donor_email
      )
      VALUES ($1, $2, $3, $4)
    `, [
      checkout.id,
      checkout.amount / 100,
      checkout.metadata.project_id,
      checkout.customer.email
    ]);
  }

  return NextResponse.json({ received: true });
}
```

```typescript
// app/api/transparency/metrics/route.ts
import { NextResponse } from 'next/server';
import { Polar } from '@polar-sh/sdk';
import { db } from '@/lib/db';

const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN! });

export async function GET() {
  // Fetch from Polar API
  const organization = await polar.organizations.get({
    id: process.env.POLAR_ORG_ID!
  });

  // Fetch pledges (donations)
  const pledges = await polar.pledges.list({
    organizationId: process.env.POLAR_ORG_ID!,
    limit: 100
  });

  // Calculate monthly trends (manual aggregation)
  const monthlyTrends = pledges.items.reduce((acc, pledge) => {
    const month = new Date(pledge.createdAt).toISOString().slice(0, 7);
    if (!acc[month]) acc[month] = { total: 0, count: 0 };
    acc[month].total += pledge.amount.amount / 100;
    acc[month].count += 1;
    return acc;
  }, {} as Record<string, { total: number; count: number }>);

  // Expenses (would need custom database)
  const expenses = await db.query(`
    SELECT category, SUM(amount) as total_spent
    FROM expenses
    GROUP BY category
  `);

  return NextResponse.json({
    totalRaised: organization.totalRevenue?.amount || 0,
    monthlyTrends: Object.entries(monthlyTrends).map(([month, data]) => ({
      month,
      total: data.total,
      count: data.count
    })),
    expenses: expenses.rows
  });
}
```

**Key differences:**
- **Stripe:** Full control, more code, better flexibility
- **Polar.sh:** Less code, redirect-based, limited customization

---

## Final Recommendation

### For Veritable Games: **Use Stripe**

**Reasons:**

1. **Cost savings:** $960-$4,800/year at scale
2. **Multi-project allocation:** Native support via metadata
3. **Transparency:** Full data ownership for complex dashboards
4. **Tax compliance:** Critical for international donors
5. **Customization:** White-label experience (no redirects)
6. **Long-term scalability:** Better API for future features

**When to use Polar.sh instead:**

- You need to launch in <3 days (emergency fundraising)
- You prioritize open-source branding/discovery
- You're okay with single-project donations
- You don't need complex expense tracking

---

## Hybrid Option: Best of Both Worlds

**Use Stripe + Open Collective:**

1. **Open Collective** for fiat donations (leverage your existing account)
   - 0% platform fee (vs Stripe's 2.9%)
   - Built-in transparency
   - Pull data via GraphQL API for dashboard

2. **Stripe** for recurring subscriptions (if OC doesn't support)
   - Better subscription management
   - More control over billing cycles

3. **BTCPay Server (self-hosted)** for crypto donations
   - 0% fees
   - Maximum transparency

**This gives you:**
- Lowest fees (OC + BTCPay = ~0%, vs Stripe 2.9%)
- Fastest launch (OC already set up)
- Maximum transparency (OC's public ledger + blockchain)
- Flexibility (can add Stripe later if needed)

---

## Implementation Timeline

### Option 1: Stripe-Only (1-2 weeks)

**Week 1:**
- Database schema (1 day)
- Stripe integration (2 days)
- Donation widget UI (2 days)

**Week 2:**
- Funding goals (1 day)
- Transparency dashboard (2 days)
- Testing & deployment (2 days)

### Option 2: Open Collective + Custom Dashboard (3-5 days)

**Day 1-2:**
- Database schema for local tracking (1 day)
- GraphQL API integration (1 day)

**Day 3-4:**
- Donation widget (redirects to OC) (1 day)
- Transparency dashboard (pulls from OC API) (1 day)

**Day 5:**
- Testing & deployment (1 day)

### Option 3: Hybrid (OC + BTCPay) (1-2 weeks)

**Week 1:**
- OC integration (2 days)
- BTCPay Server setup on 192.168.1.15 (2-3 days)
- Donation widget with dual options (1 day)

**Week 2:**
- Transparency dashboard (2 days)
- Testing both payment flows (2 days)
- Documentation (1 day)

---

## My Recommendation

**Start with Open Collective + Custom Dashboard (fastest, cheapest):**

1. Use your existing OC account
2. Build custom transparency dashboard on your site
3. Pull data via GraphQL API
4. Redirect to OC for payments
5. Add BTCPay Server later if crypto demand grows

**Why:**
- Launch in 3-5 days (vs 1-2 weeks with Stripe)
- 0% platform fee (vs 2.9-4%)
- Built-in transparency (less code to write)
- Can migrate to Stripe later if you need more control

**Then migrate to Stripe if:**
- You need multi-project allocation in payment flow
- You want white-label checkout (no redirects)
- You need advanced subscription features
- OC's limitations become painful

---

## Questions to Help You Decide

1. **How quickly do you need to launch?**
   - <1 week → Open Collective
   - 1-2 weeks → Stripe
   - 2-3 weeks → Stripe + BTCPay

2. **What's your expected monthly donation volume?**
   - <$500/mo → OC or Polar.sh (fees don't matter much)
   - $500-$2000/mo → OC or Stripe
   - $2000+/mo → Stripe (fee savings add up)

3. **How important is multi-project allocation?**
   - Critical → Stripe (native support)
   - Nice to have → OC (workaround with separate projects)

4. **Do you want crypto donations?**
   - Yes → Self-host BTCPay (0% fees)
   - Maybe later → Start with fiat-only

5. **Comfortable with Docker/VPS management?**
   - Yes → BTCPay is worth it
   - No → Stick with hosted solutions (Stripe, OC, Polar.sh)

Let me know your priorities and I can help you implement whichever option fits best!
