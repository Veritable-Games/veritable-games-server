# Donations System - Phase 2 Implementation Plan

**Status**: Planning Complete - Ready for Implementation
**Last Updated**: November 20, 2025
**Estimated Total Time**: 13-18 hours

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Phase 1: Stripe Integration](#phase-1-stripe-integration-4-5-hours)
4. [Phase 2: Payment Method Selector](#phase-2-payment-method-selector-1-hour)
5. [Phase 3: Homepage Transparency Dashboard](#phase-3-homepage-transparency-dashboard-2-3-hours)
6. [Phase 4: Admin Expense Management](#phase-4-admin-expense-management-2-3-hours)
7. [Phase 5: Campaign Management UI](#phase-5-campaign-management-ui-4-6-hours)
8. [Phase 6: CSV Export](#phase-6-csv-export-1-2-hours)
9. [Testing Strategy](#testing-strategy)
10. [Deployment Checklist](#deployment-checklist)

---

## Overview

### What's Already Complete (Phase 1)

- ✅ Database schema (7 tables)
- ✅ TypeScript service layer (20+ methods)
- ✅ BTCPay Server integration (end-to-end working)
- ✅ Webhook handling for payment completion
- ✅ Multi-project allocation system
- ✅ CSRF protection with `fetchJSON()` wrapper

### What This Plan Covers (Phase 2)

This plan provides step-by-step implementation instructions for the 6 remaining features needed to complete the donations system.

### Priority Order (Per User Requirements)

1. **CRITICAL**: Stripe integration (should be DEFAULT payment method)
2. **HIGH**: Payment method selector (Stripe tab default, crypto secondary)
3. **HIGH**: Homepage transparency dashboard
4. **HIGH**: Admin expense management
5. **MEDIUM**: Campaign management UI
6. **LOW**: CSV export

---

## Prerequisites

Before starting implementation:

### 1. Environment Setup

```bash
# Verify you're in the frontend directory
cd frontend

# Verify database health
npm run db:health

# Verify TypeScript compiles
npm run type-check

# Start dev server
npm run dev
```

### 2. Stripe Account Setup

1. Create Stripe account at https://stripe.com
2. Get API keys from Dashboard → Developers → API keys
3. Note both:
   - Publishable key (starts with `pk_test_`)
   - Secret key (starts with `sk_test_`)
4. Add webhook endpoint (will create in Phase 1)

### 3. Install Required Dependencies

```bash
cd frontend
npm install stripe @stripe/stripe-js
npm install recharts  # For charts in dashboard
npm install lucide-react  # Already installed, verify icons available
```

---

## Phase 1: Stripe Integration (4-5 hours)

**Priority**: CRITICAL
**Estimated Time**: 4-5 hours
**Goal**: Add Stripe as the default payment processor

### Step 1.1: Add Environment Variables

**File**: `frontend/.env.local`

```bash
# Add these lines
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here  # Get after creating webhook
```

**Verification**:
```bash
# Check variables are set
node -e "console.log('Stripe Secret:', process.env.STRIPE_SECRET_KEY ? 'SET' : 'MISSING')"
```

### Step 1.2: Create Stripe API Route

**File**: `frontend/src/app/api/donations/stripe/route.ts` (NEW)

```typescript
/**
 * Stripe Donation Creation API
 * Creates donation record and Stripe Checkout session
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { donationService } from '@/lib/donations/service';
import { errorResponse } from '@/lib/utils/api-errors';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

interface StripeCheckoutRequest {
  amount: number;
  currency: string;
  projectId: number;
  donorName?: string;
  donorEmail?: string;
  message?: string;
}

/**
 * POST /api/donations/stripe
 * Create donation and Stripe checkout session
 */
async function POSTHandler(request: NextRequest) {
  try {
    const body: StripeCheckoutRequest = await request.json();

    // Validate input
    if (!body.amount || body.amount < 0.5) {
      return NextResponse.json(
        { error: 'Amount must be at least $0.50' },
        { status: 400 }
      );
    }

    if (!body.projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Create donation record (pending status)
    const donation = await donationService.createDonation({
      amount: body.amount,
      currency: (body.currency as 'USD' | 'BTC' | 'EUR' | 'GBP') || 'USD',
      payment_processor: 'stripe',
      donor_name: body.donorName,
      donor_email: body.donorEmail,
      is_anonymous: !body.donorName,
      message: body.message,
      allocations: [
        {
          project_id: body.projectId as any,
          percentage: 100,
        },
      ],
    });

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: body.currency.toLowerCase() || 'usd',
            product_data: {
              name: `Donation to Project ${body.projectId}`,
              description: body.message || 'Support Veritable Games',
            },
            unit_amount: Math.round(body.amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/donate?canceled=true`,
      metadata: {
        donationId: donation.id.toString(),
      },
      customer_email: body.donorEmail,
    });

    // Update donation with Stripe session ID
    await donationService.updatePaymentMetadata(donation.id, {
      stripe_session_id: session.id,
      stripe_checkout_url: session.url,
    });

    return NextResponse.json({
      success: true,
      donationId: donation.id,
      sessionId: session.id,
      checkoutUrl: session.url,
    });
  } catch (error: any) {
    console.error('[Stripe API] Error:', error);
    return errorResponse(error);
  }
}

export const POST = withSecurity(POSTHandler, { enableCSRF: true });
```

**Testing**:
```bash
# Test endpoint with curl
curl -X POST http://localhost:3000/api/donations/stripe \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -d '{
    "amount": 10.00,
    "currency": "USD",
    "projectId": 1,
    "donorName": "Test User",
    "donorEmail": "test@example.com"
  }'

# Should return: { success: true, checkoutUrl: "https://checkout.stripe.com/..." }
```

### Step 1.3: Create Stripe Webhook Handler

**File**: `frontend/src/app/api/donations/stripe/webhook/route.ts` (NEW)

```typescript
/**
 * Stripe Webhook Handler
 * Handles payment completion events
 */

import { NextRequest, NextResponse } from 'next/server';
import { donationService } from '@/lib/donations/service';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature')!;

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('[Stripe Webhook] Signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const donationId = session.metadata?.donationId;

        if (donationId) {
          // Update donation to settled
          await donationService.updatePaymentStatus(
            session.id,
            'settled',
            session.payment_intent as string
          );
          console.log(`[Stripe Webhook] Payment completed for donation ${donationId}`);
        }
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        const donationId = session.metadata?.donationId;

        if (donationId) {
          // Mark as failed/expired
          await donationService.updatePaymentStatus(session.id, 'failed');
          console.log(`[Stripe Webhook] Payment expired for donation ${donationId}`);
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
```

### Step 1.4: Add Stripe Webhook to Stripe Dashboard

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Enter webhook URL:
   - **Development**: `http://localhost:3000/api/donations/stripe/webhook`
   - **Production**: `https://www.veritablegames.com/api/donations/stripe/webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `checkout.session.expired`
5. Copy webhook signing secret
6. Add to `.env.local` as `STRIPE_WEBHOOK_SECRET`

### Step 1.5: Add Helper Method to Service

**File**: `frontend/src/lib/donations/service.ts`

Add this method to the `DonationService` class:

```typescript
/**
 * Update payment metadata (Stripe session ID, etc.)
 */
async updatePaymentMetadata(
  donationId: bigint,
  metadata: { [key: string]: string }
): Promise<void> {
  const conn = await dbPool.getConnection('donations');
  try {
    await conn.run(
      `UPDATE donations
       SET metadata = json_patch(COALESCE(metadata, '{}'), ?)
       WHERE id = ?`,
      [JSON.stringify(metadata), donationId.toString()]
    );
  } finally {
    conn.close();
  }
}
```

### Step 1.6: Testing Checklist

- [ ] Environment variables set correctly
- [ ] Stripe API route returns checkout URL
- [ ] Redirect to Stripe checkout works
- [ ] Test card 4242 4242 4242 4242 completes payment
- [ ] Webhook receives `checkout.session.completed` event
- [ ] Donation status updates to `settled`
- [ ] Success page shows after payment

---

## Phase 2: Payment Method Selector (1 hour)

**Priority**: HIGH
**Estimated Time**: 1 hour
**Goal**: Add tabbed interface with Stripe as default

### Step 2.1: Update Donation Form Component

**File**: `frontend/src/app/donate/donation-form.tsx`

Replace the entire component with:

```typescript
'use client';

import { useState } from 'react';
import { FundingProjectWithProgress } from '@/lib/donations/types';
import { fetchJSON } from '@/lib/utils/csrf';

interface DonationFormProps {
  projects: FundingProjectWithProgress[];
}

type PaymentMethod = 'stripe' | 'btcpay';

export function DonationForm({ projects }: DonationFormProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('stripe');
  const [amount, setAmount] = useState('10.00');
  const [projectId, setProjectId] = useState(projects[0]?.id || 1);
  const [donorName, setDonorName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const endpoint =
        paymentMethod === 'stripe'
          ? '/api/donations/stripe'
          : '/api/donations/btcpay';

      const data = await fetchJSON<{
        success: boolean;
        donationId: number;
        checkoutUrl: string;
      }>(endpoint, {
        method: 'POST',
        body: {
          amount: parseFloat(amount),
          currency: 'USD',
          projectId: parseInt(projectId.toString()),
          donorName: donorName || undefined,
          donorEmail: donorEmail || undefined,
          message: message || undefined,
        },
      });

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: any) {
      console.error('Donation error:', err);
      setError(err.message || 'Failed to create donation');
      setIsSubmitting(false);
    }
  };

  const minAmount = paymentMethod === 'stripe' ? 0.5 : 0.01;

  return (
    <div className="space-y-6">
      {/* Payment Method Selector */}
      <div>
        <label className="mb-3 block text-sm font-medium text-gray-300">
          Payment Method
        </label>
        <div className="flex gap-2 rounded-lg border border-gray-700 bg-gray-800/50 p-1">
          <button
            type="button"
            onClick={() => setPaymentMethod('stripe')}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              paymentMethod === 'stripe'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            💳 Credit/Debit Card
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod('btcpay')}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              paymentMethod === 'btcpay'
                ? 'bg-orange-600 text-white'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            ₿ Bitcoin/Lightning
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {paymentMethod === 'stripe'
            ? 'Secure payment via Stripe (minimum $0.50)'
            : 'Cryptocurrency payment via BTCPay Server (minimum $0.01)'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Amount Input */}
        <div>
          <label htmlFor="amount" className="mb-2 block text-sm font-medium text-gray-300">
            Donation Amount (USD)
          </label>
          <input
            type="number"
            id="amount"
            min={minAmount}
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
            placeholder="10.00"
          />
          <p className="mt-1 text-xs text-gray-500">
            Minimum: ${minAmount.toFixed(2)}
          </p>
        </div>

        {/* Project Selector */}
        <div>
          <label htmlFor="project" className="mb-2 block text-sm font-medium text-gray-300">
            Support Project
          </label>
          <select
            id="project"
            value={projectId}
            onChange={e => setProjectId(parseInt(e.target.value))}
            required
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
          >
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
                {project.current_amount > 0 && ` ($${project.current_amount.toFixed(2)} raised)`}
              </option>
            ))}
          </select>
        </div>

        {/* Optional: Donor Name */}
        <div>
          <label htmlFor="donorName" className="mb-2 block text-sm font-medium text-gray-300">
            Your Name <span className="text-gray-500">(Optional)</span>
          </label>
          <input
            type="text"
            id="donorName"
            value={donorName}
            onChange={e => setDonorName(e.target.value)}
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
            placeholder="Anonymous"
          />
        </div>

        {/* Optional: Donor Email */}
        <div>
          <label htmlFor="donorEmail" className="mb-2 block text-sm font-medium text-gray-300">
            Your Email <span className="text-gray-500">(Optional)</span>
          </label>
          <input
            type="email"
            id="donorEmail"
            value={donorEmail}
            onChange={e => setDonorEmail(e.target.value)}
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
            placeholder="your@email.com"
          />
        </div>

        {/* Optional: Message */}
        <div>
          <label htmlFor="message" className="mb-2 block text-sm font-medium text-gray-300">
            Message <span className="text-gray-500">(Optional)</span>
          </label>
          <textarea
            id="message"
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
            placeholder="Leave a message with your donation..."
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-md border border-red-800 bg-red-900/20 p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting
            ? 'Creating Invoice...'
            : paymentMethod === 'stripe'
              ? 'Proceed to Payment'
              : 'Proceed to Bitcoin Payment'}
        </button>

        <p className="text-center text-xs text-gray-500">
          {paymentMethod === 'stripe'
            ? "You'll be redirected to Stripe to complete your payment"
            : "You'll be redirected to BTCPay Server to complete your payment"}
        </p>
      </form>
    </div>
  );
}
```

### Step 2.2: Testing Checklist

- [ ] Stripe tab is selected by default
- [ ] Switching tabs updates minimum amount text
- [ ] Stripe tab redirects to Stripe checkout
- [ ] BTCPay tab redirects to BTCPay checkout
- [ ] Minimum amount validation works for both ($0.50 Stripe, $0.01 BTCPay)

---

## Phase 3: Homepage Transparency Dashboard (2-3 hours)

**Priority**: HIGH
**Estimated Time**: 2-3 hours
**Goal**: Display donation transparency metrics on homepage

### Step 3.1: Create API Route for Transparency Data

**File**: `frontend/src/app/api/donations/transparency/route.ts` (NEW)

```typescript
/**
 * Transparency Metrics API
 * Public endpoint for donation transparency data
 */

import { NextResponse } from 'next/server';
import { donationService } from '@/lib/donations/service';
import { errorResponse } from '@/lib/utils/api-errors';

export async function GET() {
  try {
    const metrics = await donationService.getTransparencyMetrics();

    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error('[Transparency API] Error:', error);
    return errorResponse(error);
  }
}
```

### Step 3.2: Create Transparency Dashboard Component

**File**: `frontend/src/components/donations/transparency-dashboard.tsx` (NEW)

```typescript
'use client';

import { useEffect, useState } from 'react';
import { TransparencyMetrics } from '@/lib/donations/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

export function TransparencyDashboard() {
  const [metrics, setMetrics] = useState<TransparencyMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const response = await fetch('/api/donations/transparency');
        if (!response.ok) throw new Error('Failed to fetch metrics');
        const data = await response.json();
        setMetrics(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse rounded-lg border border-gray-700 bg-gray-800/50 p-6">
        <div className="mb-4 h-8 w-48 rounded bg-gray-700"></div>
        <div className="h-64 rounded bg-gray-700"></div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-900/20 p-6">
        <p className="text-red-400">Failed to load transparency data: {error}</p>
      </div>
    );
  }

  const pieData = metrics.expense_breakdown.map(category => ({
    name: category.category.name,
    value: category.total,
    percentage: category.percentage,
    color: category.category.color,
  }));

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <p className="text-sm text-gray-400">Total Raised (All Time)</p>
          <p className="text-2xl font-bold text-white">
            ${metrics.total_all_time.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <p className="text-sm text-gray-400">Total This Year</p>
          <p className="text-2xl font-bold text-white">
            ${metrics.total_this_year.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <p className="text-sm text-gray-400">Net This Year</p>
          <p className="text-2xl font-bold text-white">
            ${metrics.net_this_year.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Expense Breakdown Pie Chart */}
      {metrics.expense_breakdown.length > 0 && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">
            Expense Breakdown (This Year)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                }}
                formatter={(value: number) => `$${value.toFixed(2)}`}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>

          {/* Expense Category List */}
          <div className="mt-6 space-y-2">
            {metrics.expense_breakdown.map(category => (
              <div
                key={category.category.name}
                className="flex items-center justify-between rounded-md border border-gray-700 bg-gray-800 p-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-4 w-4 rounded"
                    style={{ backgroundColor: category.category.color }}
                  ></div>
                  <span className="font-medium text-white">{category.category.name}</span>
                  <span className="text-sm text-gray-400">({category.count} expenses)</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-white">${category.total.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{category.percentage.toFixed(1)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project Totals */}
      {metrics.project_totals.length > 0 && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">
            Funding by Project
          </h3>
          <div className="space-y-3">
            {metrics.project_totals.map(project => (
              <div key={project.project_id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{project.project_name}</span>
                  <span className="text-sm text-gray-400">
                    ${project.total_funded.toFixed(2)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-700">
                  <div
                    className="h-full bg-blue-600"
                    style={{
                      width: `${(project.total_funded / metrics.total_all_time) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Goals */}
      {metrics.active_goals.length > 0 && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">
            Active Funding Goals
          </h3>
          <div className="space-y-4">
            {metrics.active_goals.map(goal => (
              <div key={goal.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{goal.title}</span>
                  <span className="text-sm text-gray-400">
                    ${goal.current_amount.toFixed(2)} / ${goal.target_amount.toFixed(2)}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-gray-700">
                  <div
                    className="h-full bg-green-600 transition-all duration-500"
                    style={{ width: `${goal.progress_percentage}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-400">
                  {goal.progress_percentage.toFixed(1)}% complete
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 3.3: Add Dashboard to Homepage

**File**: `frontend/src/app/page.tsx`

Add this section to the homepage:

```typescript
import { TransparencyDashboard } from '@/components/donations/transparency-dashboard';

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Existing homepage content */}

      {/* Donation Transparency Section */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8 text-center">
          <h2 className="mb-3 text-3xl font-bold text-white">
            Financial Transparency
          </h2>
          <p className="text-gray-400">
            See exactly how donations are used to support Veritable Games projects
          </p>
        </div>
        <TransparencyDashboard />
      </section>
    </div>
  );
}
```

### Step 3.4: Testing Checklist

- [ ] Dashboard loads without errors
- [ ] Pie chart displays with correct percentages
- [ ] Expense categories show with colors and icons
- [ ] Project totals display with progress bars
- [ ] Active goals show progress percentage
- [ ] Responsive design works on mobile

---

## Phase 4: Admin Expense Management (2-3 hours)

**Priority**: HIGH
**Estimated Time**: 2-3 hours
**Goal**: Allow admins to add/manage expenses

### Step 4.1: Create Admin API Route for Expenses

**File**: `frontend/src/app/api/admin/expenses/route.ts` (NEW)

```typescript
/**
 * Admin Expense Management API
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { donationService } from '@/lib/donations/service';
import { errorResponse } from '@/lib/utils/api-errors';
import { getSessionUser } from '@/lib/auth/session';

/**
 * GET /api/admin/expenses
 * List all expenses with optional filtering
 */
async function GETHandler(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year')
      ? parseInt(searchParams.get('year')!)
      : new Date().getFullYear();
    const categoryId = searchParams.get('category_id')
      ? parseInt(searchParams.get('category_id')!)
      : undefined;

    const expenses = await donationService.getExpenses({
      year,
      category_id: categoryId,
    });

    return NextResponse.json(expenses);
  } catch (error: any) {
    return errorResponse(error);
  }
}

/**
 * POST /api/admin/expenses
 * Create new expense
 */
async function POSTHandler(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.category_id || !body.amount || !body.description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const expense = await donationService.createExpense({
      category_id: body.category_id,
      amount: body.amount,
      description: body.description,
      expense_date: body.expense_date || new Date().toISOString().split('T')[0],
      receipt_url: body.receipt_url,
    });

    return NextResponse.json(expense);
  } catch (error: any) {
    return errorResponse(error);
  }
}

export const GET = withSecurity(GETHandler, { enableCSRF: false });
export const POST = withSecurity(POSTHandler, { enableCSRF: true });
```

### Step 4.2: Create Admin Expense Management Page

**File**: `frontend/src/app/admin/expenses/page.tsx` (NEW)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Expense, ExpenseCategory } from '@/lib/donations/types';
import { fetchJSON } from '@/lib/utils/csrf';

export default function AdminExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [receiptUrl, setReceiptUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [expensesData, categoriesData] = await Promise.all([
        fetch('/api/admin/expenses').then(r => r.json()),
        fetch('/api/donations/categories').then(r => r.json()),
      ]);
      setExpenses(expensesData);
      setCategories(categoriesData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const newExpense = await fetchJSON<Expense>('/api/admin/expenses', {
        method: 'POST',
        body: {
          category_id: parseInt(categoryId),
          amount: parseFloat(amount),
          description,
          expense_date: expenseDate,
          receipt_url: receiptUrl || undefined,
        },
      });

      setExpenses([newExpense, ...expenses]);
      setShowCreateForm(false);
      resetForm();
    } catch (err) {
      console.error('Failed to create expense:', err);
      alert('Failed to create expense');
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setCategoryId('');
    setAmount('');
    setDescription('');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setReceiptUrl('');
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Expense Management</h1>
          <p className="mt-1 text-gray-400">
            Total: ${totalExpenses.toFixed(2)} ({expenses.length} expenses)
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          {showCreateForm ? 'Cancel' : 'Add Expense'}
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-lg border border-gray-700 bg-gray-800/50 p-6"
        >
          <h2 className="mb-4 text-xl font-semibold text-white">New Expense</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Category
              </label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                required
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white"
              >
                <option value="">Select category...</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Amount (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Date
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={e => setExpenseDate(e.target.value)}
                required
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Receipt URL (Optional)
              </label>
              <input
                type="url"
                value={receiptUrl}
                onChange={e => setReceiptUrl(e.target.value)}
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white"
                placeholder="https://..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Description
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
                rows={3}
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white"
                placeholder="What was this expense for?"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-4 rounded-md bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Expense'}
          </button>
        </form>
      )}

      {/* Expenses Table */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                Date
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                Category
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                Description
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">
                Amount
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">
                Receipt
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No expenses recorded yet
                </td>
              </tr>
            ) : (
              expenses.map(expense => (
                <tr key={expense.id} className="hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {new Date(expense.expense_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block rounded px-2 py-1 text-xs font-medium text-white"
                      style={{
                        backgroundColor:
                          categories.find(c => c.id === expense.category_id)
                            ?.color || '#666',
                      }}
                    >
                      {categories.find(c => c.id === expense.category_id)?.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {expense.description}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-white">
                    ${expense.amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {expense.receipt_url ? (
                      <a
                        href={expense.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### Step 4.3: Add Missing Service Methods

**File**: `frontend/src/lib/donations/service.ts`

Add these methods to the `DonationService` class:

```typescript
/**
 * Get expenses with optional filtering
 */
async getExpenses(filters: {
  year?: number;
  category_id?: number;
}): Promise<Expense[]> {
  const conn = await dbPool.getConnection('donations');
  try {
    let query = `
      SELECT * FROM expenses
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.year) {
      query += ` AND strftime('%Y', expense_date) = ?`;
      params.push(filters.year.toString());
    }

    if (filters.category_id) {
      query += ` AND category_id = ?`;
      params.push(filters.category_id);
    }

    query += ` ORDER BY expense_date DESC, created_at DESC`;

    const rows = await conn.all(query, params);
    return rows.map(row => ({
      ...row,
      id: BigInt(row.id),
      category_id: BigInt(row.category_id),
    }));
  } finally {
    conn.close();
  }
}
```

### Step 4.4: Add Categories API Route

**File**: `frontend/src/app/api/donations/categories/route.ts` (NEW)

```typescript
/**
 * Expense Categories API
 * Public endpoint for listing categories
 */

import { NextResponse } from 'next/server';
import { donationService } from '@/lib/donations/service';
import { errorResponse } from '@/lib/utils/api-errors';

export async function GET() {
  try {
    const categories = await donationService.getExpenseCategories();
    return NextResponse.json(categories);
  } catch (error: any) {
    return errorResponse(error);
  }
}
```

### Step 4.5: Testing Checklist

- [ ] Admin can access `/admin/expenses` page
- [ ] Non-admins get 403 error
- [ ] Create expense form works
- [ ] Expenses display in table with correct categories
- [ ] Category colors display correctly
- [ ] Receipt link opens in new tab
- [ ] Total expenses calculation is accurate

---

## Phase 5: Campaign Management UI (4-6 hours)

**Priority**: MEDIUM
**Estimated Time**: 4-6 hours
**Goal**: Allow admins to create and manage funding campaigns

### Step 5.1: Create Admin API Route for Campaigns

**File**: `frontend/src/app/api/admin/campaigns/route.ts` (NEW)

```typescript
/**
 * Admin Campaign Management API
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { donationService } from '@/lib/donations/service';
import { errorResponse } from '@/lib/utils/api-errors';
import { getSessionUser } from '@/lib/auth/session';

/**
 * GET /api/admin/campaigns
 * List all campaigns (active and inactive)
 */
async function GETHandler() {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const campaigns = await donationService.getAllFundingGoals();
    return NextResponse.json(campaigns);
  } catch (error: any) {
    return errorResponse(error);
  }
}

/**
 * POST /api/admin/campaigns
 * Create new campaign
 */
async function POSTHandler(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();

    const campaign = await donationService.createFundingGoal({
      project_id: body.project_id,
      title: body.title,
      target_amount: body.target_amount,
      start_date: body.start_date,
      end_date: body.end_date || null,
      is_recurring: body.is_recurring || false,
      recurrence_period: body.recurrence_period || null,
    });

    return NextResponse.json(campaign);
  } catch (error: any) {
    return errorResponse(error);
  }
}

export const GET = withSecurity(GETHandler, { enableCSRF: false });
export const POST = withSecurity(POSTHandler, { enableCSRF: true });
```

### Step 5.2: Create Campaign Update/Delete Route

**File**: `frontend/src/app/api/admin/campaigns/[id]/route.ts` (NEW)

```typescript
/**
 * Admin Single Campaign API
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { donationService } from '@/lib/donations/service';
import { errorResponse } from '@/lib/utils/api-errors';
import { getSessionUser } from '@/lib/auth/session';

/**
 * PATCH /api/admin/campaigns/[id]
 * Update campaign (e.g., end campaign early)
 */
async function PATCHHandler(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const params = await context.params;
    const goalId = BigInt(params.id);
    const body = await request.json();

    await donationService.updateFundingGoal(goalId, body);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return errorResponse(error);
  }
}

export const PATCH = withSecurity(PATCHHandler, { enableCSRF: true });
```

### Step 5.3: Add Service Methods

**File**: `frontend/src/lib/donations/service.ts`

Add these methods:

```typescript
/**
 * Get all funding goals (admin)
 */
async getAllFundingGoals(): Promise<FundingGoalWithProgress[]> {
  const conn = await dbPool.getConnection('donations');
  try {
    const rows = await conn.all(`
      SELECT
        fg.*,
        fp.name as project_name,
        (fg.current_amount / fg.target_amount * 100) as progress_percentage
      FROM funding_goals fg
      JOIN funding_projects fp ON fg.project_id = fp.id
      ORDER BY fg.created_at DESC
    `);

    return rows.map(row => ({
      ...row,
      id: BigInt(row.id),
      project_id: BigInt(row.project_id),
    }));
  } finally {
    conn.close();
  }
}

/**
 * Create funding goal/campaign
 */
async createFundingGoal(data: {
  project_id: bigint;
  title: string;
  target_amount: number;
  start_date: string;
  end_date: string | null;
  is_recurring: boolean;
  recurrence_period: string | null;
}): Promise<FundingGoal> {
  const conn = await dbPool.getConnection('donations');
  try {
    const result = await conn.run(
      `
      INSERT INTO funding_goals (
        project_id, title, target_amount, start_date, end_date,
        is_recurring, recurrence_period, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
      `,
      [
        data.project_id.toString(),
        data.title,
        data.target_amount,
        data.start_date,
        data.end_date,
        data.is_recurring ? 1 : 0,
        data.recurrence_period,
      ]
    );

    const row = await conn.get('SELECT * FROM funding_goals WHERE id = ?', [
      result.lastID,
    ]);

    return {
      ...row,
      id: BigInt(row.id),
      project_id: BigInt(row.project_id),
    };
  } finally {
    conn.close();
  }
}

/**
 * Update funding goal
 */
async updateFundingGoal(
  goalId: bigint,
  updates: {
    is_active?: boolean;
    end_date?: string | null;
  }
): Promise<void> {
  const conn = await dbPool.getConnection('donations');
  try {
    const setClauses: string[] = [];
    const params: any[] = [];

    if (updates.is_active !== undefined) {
      setClauses.push('is_active = ?');
      params.push(updates.is_active ? 1 : 0);
    }

    if (updates.end_date !== undefined) {
      setClauses.push('end_date = ?');
      params.push(updates.end_date);
    }

    if (setClauses.length === 0) return;

    params.push(goalId.toString());

    await conn.run(
      `UPDATE funding_goals SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );
  } finally {
    conn.close();
  }
}
```

### Step 5.4: Create Campaign Management Page

**File**: `frontend/src/app/admin/campaigns/page.tsx` (NEW)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { FundingGoalWithProgress, FundingProjectWithProgress } from '@/lib/donations/types';
import { fetchJSON } from '@/lib/utils/csrf';

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<FundingGoalWithProgress[]>([]);
  const [projects, setProjects] = useState<FundingProjectWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePeriod, setRecurrencePeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [campaignsData, projectsData] = await Promise.all([
        fetch('/api/admin/campaigns').then(r => r.json()),
        fetch('/api/donations/projects').then(r => r.json()),
      ]);
      setCampaigns(campaignsData);
      setProjects(projectsData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const newCampaign = await fetchJSON<FundingGoalWithProgress>('/api/admin/campaigns', {
        method: 'POST',
        body: {
          project_id: parseInt(projectId),
          title,
          target_amount: parseFloat(targetAmount),
          start_date: startDate,
          end_date: endDate || null,
          is_recurring: isRecurring,
          recurrence_period: isRecurring ? recurrencePeriod : null,
        },
      });

      setCampaigns([newCampaign, ...campaigns]);
      setShowCreateForm(false);
      resetForm();
    } catch (err) {
      console.error('Failed to create campaign:', err);
      alert('Failed to create campaign');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function endCampaign(campaignId: bigint) {
    if (!confirm('Are you sure you want to end this campaign?')) return;

    try {
      await fetchJSON(`/api/admin/campaigns/${campaignId}`, {
        method: 'PATCH',
        body: {
          is_active: false,
          end_date: new Date().toISOString().split('T')[0],
        },
      });

      setCampaigns(
        campaigns.map(c =>
          c.id === campaignId ? { ...c, is_active: false } : c
        )
      );
    } catch (err) {
      console.error('Failed to end campaign:', err);
      alert('Failed to end campaign');
    }
  }

  function resetForm() {
    setProjectId('');
    setTitle('');
    setTargetAmount('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setIsRecurring(false);
    setRecurrencePeriod('monthly');
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  const activeCampaigns = campaigns.filter(c => c.is_active);
  const inactiveCampaigns = campaigns.filter(c => !c.is_active);

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Campaign Management</h1>
          <p className="mt-1 text-gray-400">
            {activeCampaigns.length} active, {inactiveCampaigns.length} inactive
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          {showCreateForm ? 'Cancel' : 'Create Campaign'}
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-lg border border-gray-700 bg-gray-800/50 p-6"
        >
          <h2 className="mb-4 text-xl font-semibold text-white">New Campaign</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Project
              </label>
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                required
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white"
              >
                <option value="">Select project...</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Campaign Title
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white"
                placeholder="Q1 2025 Development Fund"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Target Amount (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={targetAmount}
                onChange={e => setTargetAmount(e.target.value)}
                required
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white"
                placeholder="5000.00"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                required
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                End Date (Optional)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white"
              />
              <p className="mt-1 text-xs text-gray-500">
                Leave empty for ongoing campaign
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_recurring"
                checked={isRecurring}
                onChange={e => setIsRecurring(e.target.checked)}
                className="h-4 w-4 rounded border-gray-600 bg-gray-800"
              />
              <label htmlFor="is_recurring" className="text-sm text-gray-300">
                Recurring Campaign
              </label>
            </div>

            {isRecurring && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Recurrence Period
                </label>
                <select
                  value={recurrencePeriod}
                  onChange={e => setRecurrencePeriod(e.target.value as any)}
                  className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-4 rounded-md bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Campaign'}
          </button>
        </form>
      )}

      {/* Active Campaigns */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-white">Active Campaigns</h2>
        <div className="space-y-4">
          {activeCampaigns.length === 0 ? (
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-6 text-center text-gray-400">
              No active campaigns
            </div>
          ) : (
            activeCampaigns.map(campaign => (
              <div
                key={campaign.id}
                className="rounded-lg border border-gray-700 bg-gray-800/50 p-6"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {campaign.title}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {campaign.project_name} •{' '}
                      {campaign.is_recurring && `${campaign.recurrence_period} • `}
                      Ends: {campaign.end_date || 'Ongoing'}
                    </p>
                  </div>
                  <button
                    onClick={() => endCampaign(campaign.id)}
                    className="rounded-md border border-red-600 px-3 py-1 text-sm text-red-400 hover:bg-red-900/20"
                  >
                    End Campaign
                  </button>
                </div>

                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-gray-400">
                    ${campaign.current_amount.toFixed(2)} / $
                    {campaign.target_amount.toFixed(2)}
                  </span>
                  <span className="font-medium text-white">
                    {campaign.progress_percentage.toFixed(1)}%
                  </span>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-gray-700">
                  <div
                    className="h-full bg-green-600 transition-all duration-500"
                    style={{ width: `${Math.min(campaign.progress_percentage, 100)}%` }}
                  ></div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Inactive Campaigns */}
      {inactiveCampaigns.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-semibold text-white">Past Campaigns</h2>
          <div className="space-y-3">
            {inactiveCampaigns.map(campaign => (
              <div
                key={campaign.id}
                className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/30 p-4 opacity-60"
              >
                <div>
                  <h4 className="font-medium text-white">{campaign.title}</h4>
                  <p className="text-sm text-gray-400">
                    {campaign.project_name} • Ended:{' '}
                    {campaign.end_date || 'Unknown'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-white">
                    ${campaign.current_amount.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {campaign.progress_percentage.toFixed(1)}% of goal
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 5.5: Add Projects API Route

**File**: `frontend/src/app/api/donations/projects/route.ts` (NEW)

```typescript
/**
 * Funding Projects API
 * Public endpoint for listing projects
 */

import { NextResponse } from 'next/server';
import { donationService } from '@/lib/donations/service';
import { errorResponse } from '@/lib/utils/api-errors';

export async function GET() {
  try {
    const projects = await donationService.getActiveFundingProjects();
    return NextResponse.json(projects);
  } catch (error: any) {
    return errorResponse(error);
  }
}
```

### Step 5.6: Testing Checklist

- [ ] Admin can create campaigns
- [ ] Campaign displays with progress bar
- [ ] End campaign button works
- [ ] Recurring campaigns show period
- [ ] Projects dropdown populates correctly
- [ ] Active/inactive campaigns separate correctly
- [ ] Progress percentage calculates correctly

---

## Phase 6: CSV Export (1-2 hours)

**Priority**: LOW
**Estimated Time**: 1-2 hours
**Goal**: Allow admins to export donation/expense data to CSV

### Step 6.1: Create Export API Route

**File**: `frontend/src/app/api/admin/export/route.ts` (NEW)

```typescript
/**
 * Admin CSV Export API
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { donationService } from '@/lib/donations/service';
import { getSessionUser } from '@/lib/auth/session';

async function GETHandler(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'donations' or 'expenses'
    const year = searchParams.get('year')
      ? parseInt(searchParams.get('year')!)
      : new Date().getFullYear();

    let csvContent = '';

    if (type === 'donations') {
      const donations = await donationService.getDonationsForExport(year);
      csvContent = convertDonationsToCSV(donations);
    } else if (type === 'expenses') {
      const expenses = await donationService.getExpenses({ year });
      csvContent = convertExpensesToCSV(expenses);
    } else {
      return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
    }

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${type}_${year}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('[Export API] Error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

function convertDonationsToCSV(donations: any[]): string {
  const headers = [
    'Date',
    'Amount',
    'Currency',
    'Payment Processor',
    'Status',
    'Donor Name',
    'Donor Email',
    'Project',
    'Message',
  ];

  const rows = donations.map(d => [
    new Date(d.created_at).toLocaleDateString(),
    d.amount.toFixed(2),
    d.currency,
    d.payment_processor,
    d.payment_status,
    d.donor_name || 'Anonymous',
    d.donor_email || '',
    d.project_name || '',
    (d.message || '').replace(/"/g, '""'), // Escape quotes
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');
}

function convertExpensesToCSV(expenses: any[]): string {
  const headers = ['Date', 'Amount', 'Category', 'Description', 'Receipt URL'];

  const rows = expenses.map(e => [
    new Date(e.expense_date).toLocaleDateString(),
    e.amount.toFixed(2),
    e.category_name || '',
    (e.description || '').replace(/"/g, '""'),
    e.receipt_url || '',
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');
}

export const GET = withSecurity(GETHandler, { enableCSRF: false });
```

### Step 6.2: Add Service Method

**File**: `frontend/src/lib/donations/service.ts`

```typescript
/**
 * Get donations for CSV export
 */
async getDonationsForExport(year: number): Promise<any[]> {
  const conn = await dbPool.getConnection('donations');
  try {
    return await conn.all(
      `
      SELECT
        d.*,
        fp.name as project_name,
        ec.name as category_name
      FROM donations d
      LEFT JOIN donation_allocations da ON d.id = da.donation_id
      LEFT JOIN funding_projects fp ON da.project_id = fp.id
      LEFT JOIN expenses e ON d.id = e.id
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      WHERE strftime('%Y', d.created_at) = ?
      ORDER BY d.created_at DESC
      `,
      [year.toString()]
    );
  } finally {
    conn.close();
  }
}
```

### Step 6.3: Add Export Buttons to Admin Pages

Add these buttons to the admin expenses and donations pages:

```typescript
<button
  onClick={() => {
    window.location.href = `/api/admin/export?type=donations&year=${new Date().getFullYear()}`;
  }}
  className="rounded-md border border-gray-600 bg-gray-800 px-4 py-2 text-gray-300 hover:bg-gray-700"
>
  Export CSV
</button>
```

### Step 6.4: Testing Checklist

- [ ] CSV download triggers on button click
- [ ] File name includes type and year
- [ ] CSV headers are correct
- [ ] Data exports completely
- [ ] Quotes in text fields are escaped properly
- [ ] Opens correctly in Excel/Google Sheets

---

## Testing Strategy

### Unit Testing

Create test files for each service method:

**File**: `frontend/src/lib/donations/__tests__/service.test.ts`

```typescript
import { describe, it, expect } from '@jest/globals';
import { donationService } from '../service';

describe('DonationService', () => {
  it('should create donation with allocation', async () => {
    const donation = await donationService.createDonation({
      amount: 10.0,
      currency: 'USD',
      payment_processor: 'stripe',
      allocations: [{ project_id: 1n, percentage: 100 }],
    });

    expect(donation.amount).toBe(10.0);
    expect(donation.payment_status).toBe('pending');
  });

  it('should calculate transparency metrics', async () => {
    const metrics = await donationService.getTransparencyMetrics();

    expect(metrics).toHaveProperty('total_all_time');
    expect(metrics).toHaveProperty('expense_breakdown');
    expect(Array.isArray(metrics.expense_breakdown)).toBe(true);
  });
});
```

Run tests:
```bash
cd frontend
npm test
```

### Integration Testing

Test each API route with real HTTP requests:

```bash
# Test Stripe donation creation
curl -X POST http://localhost:3000/api/donations/stripe \
  -H "Content-Type: application/json" \
  -d '{"amount": 10, "projectId": 1, "currency": "USD"}'

# Test transparency API
curl http://localhost:3000/api/donations/transparency

# Test admin expense creation
curl -X POST http://localhost:3000/api/admin/expenses \
  -H "Content-Type: application/json" \
  -d '{"category_id": 1, "amount": 100, "description": "Test expense"}'
```

### End-to-End Testing

Manual testing checklist:

1. **Donation Flow**:
   - [ ] Create donation with Stripe
   - [ ] Complete payment on Stripe checkout
   - [ ] Verify webhook updates status to 'settled'
   - [ ] Check donation appears in database
   - [ ] Verify allocation was created

2. **Dashboard**:
   - [ ] Load homepage transparency dashboard
   - [ ] Verify pie chart displays
   - [ ] Check expense breakdown accuracy
   - [ ] Verify project totals match database

3. **Admin Features**:
   - [ ] Create expense as admin
   - [ ] Verify expense appears in dashboard
   - [ ] Create campaign
   - [ ] End campaign early
   - [ ] Export CSV files

---

## Deployment Checklist

### 1. Environment Variables

Add to production `.env.local` or Coolify environment:

```bash
# Stripe (production keys)
STRIPE_SECRET_KEY=sk_live_your_live_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# BTCPay (already configured)
BTCPAY_SERVER_URL=https://btcpay.example.com
BTCPAY_STORE_ID=your_store_id
BTCPAY_API_KEY=your_api_key
```

### 2. Database Verification

```bash
# SSH to production server
ssh user@192.168.1.15

# Verify all tables exist
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'donations'
  ORDER BY tablename;
"

# Should show: donation_allocations, donations, expense_categories, expenses,
#              funding_goals, funding_projects, monthly_summaries
```

### 3. Stripe Webhook Setup

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add production endpoint: `https://www.veritablegames.com/api/donations/stripe/webhook`
3. Select events: `checkout.session.completed`, `checkout.session.expired`
4. Copy signing secret
5. Update `STRIPE_WEBHOOK_SECRET` in production environment

### 4. Build and Deploy

```bash
# From laptop or server
cd ~/Projects/veritable-games-main  # Or ~/veritable-games-site on server

# Commit all changes
git add .
git commit -m "Add Phase 2: Stripe integration, dashboards, admin features"
git push origin main

# Trigger deployment (optional, auto-deploy may trigger)
coolify deploy uuid m4s0kwo4kc4oooocck4sswc4

# Monitor deployment
coolify app get m4s0kwo4kc4oooocck4sswc4

# Wait 3-5 minutes for build to complete
```

### 5. Post-Deployment Verification

```bash
# Check container is healthy
ssh user@192.168.1.15
docker ps --filter "name=m4s0kwo4kc4oooocck4sswc4"
# Should show: "Up X seconds (healthy)"

# Check logs for errors
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 50

# Test Stripe API endpoint
curl -X POST https://www.veritablegames.com/api/donations/stripe \
  -H "Content-Type: application/json" \
  -d '{"amount": 0.50, "projectId": 1, "currency": "USD"}'
# Should return: checkoutUrl

# Test transparency API
curl https://www.veritablegames.com/api/donations/transparency
# Should return: JSON with metrics

# Visit homepage
# Check transparency dashboard displays correctly
```

### 6. Security Checks

- [ ] Admin routes require authentication
- [ ] CSRF protection enabled on all POST/PATCH routes
- [ ] Environment secrets not exposed in client code
- [ ] Stripe webhook signature verification works
- [ ] SQL injection protected (using parameterized queries)
- [ ] XSS protected (React auto-escapes)

---

## Success Criteria

Phase 2 is complete when:

1. ✅ Stripe payments work end-to-end (create donation → checkout → webhook → settled)
2. ✅ Payment method selector works (Stripe default, BTCPay secondary)
3. ✅ Homepage transparency dashboard displays live data
4. ✅ Admins can add expenses via UI
5. ✅ Admins can create and manage campaigns
6. ✅ CSV export works for donations and expenses
7. ✅ All TypeScript compiles without errors (`npm run type-check`)
8. ✅ All tests pass (`npm test`)
9. ✅ Production deployment successful
10. ✅ Security audit passes (no exposed secrets, CSRF works, auth works)

---

## Estimated Timeline

| Phase | Task | Estimated Time | Priority |
|-------|------|---------------|----------|
| 1 | Stripe Integration | 4-5 hours | CRITICAL |
| 2 | Payment Method Selector | 1 hour | HIGH |
| 3 | Homepage Dashboard | 2-3 hours | HIGH |
| 4 | Admin Expense Management | 2-3 hours | HIGH |
| 5 | Campaign Management | 4-6 hours | MEDIUM |
| 6 | CSV Export | 1-2 hours | LOW |
| | **Testing & Deployment** | 2-3 hours | - |
| | **TOTAL** | **16-23 hours** | - |

---

## Next Steps After Phase 2

Once Phase 2 is complete, consider:

1. **Advanced Analytics**: Charts showing donation trends over time
2. **Email Notifications**: Send receipts to donors
3. **Recurring Donations**: Subscription support via Stripe
4. **Multi-currency Support**: Better handling of EUR, GBP, BTC
5. **Mobile App**: Dedicated donation app
6. **API Documentation**: Public API for third-party integrations

---

**End of Phase 2 Implementation Plan**
