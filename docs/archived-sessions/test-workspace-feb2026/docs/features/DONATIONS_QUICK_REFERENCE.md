# Donations System - Quick Reference Guide

**Purpose**: Fast lookups for common tasks
**Last Updated**: February 15, 2026

---

## Quick Commands

```bash
# Development
cd frontend
npm run dev              # Start dev server
npm run type-check       # Verify TypeScript
npm test                 # Run tests

# Database
npm run db:health        # Check database status

# Production (from laptop or server)
git push origin main     # Deploy to production
coolify deploy uuid m4s0kwo4kc4oooocck4sswc4  # Force deploy
```

---

## Key File Locations

```
frontend/
├── src/
│   ├── app/
│   │   ├── api/donations/
│   │   │   ├── btcpay/route.ts           # BTCPay invoice creation
│   │   │   ├── stripe/route.ts           # Stripe checkout
│   │   │   ├── transparency/route.ts     # Public metrics
│   │   │   ├── projects/route.ts         # List projects
│   │   │   └── manage/route.ts           # User donation management
│   │   ├── api/webhooks/
│   │   │   ├── btcpay/route.ts           # BTCPay payment notifications
│   │   │   └── stripe/route.ts           # Stripe payment notifications
│   │   ├── api/admin/
│   │   │   ├── expenses/route.ts         # Admin expense CRUD (Phase 2)
│   │   │   └── campaigns/route.ts        # Admin campaign CRUD (Phase 2)
│   │   ├── donate/
│   │   │   ├── page.tsx                  # Donation page
│   │   │   ├── donation-form.tsx         # Donation form component
│   │   │   └── success/page.tsx          # Success page after payment
│   │   └── admin/
│   │       ├── expenses/page.tsx         # Expense management UI (Phase 2)
│   │       └── campaigns/page.tsx        # Campaign management UI (Phase 2)
│   ├── components/donations/
│   │   └── transparency-dashboard.tsx    # Homepage dashboard (Phase 2)
│   └── lib/donations/
│       ├── service.ts                    # Business logic (20+ methods)
│       └── types.ts                      # TypeScript definitions
└── data/donations.db                     # SQLite (dev only)

backend/schema/donations.sql              # PostgreSQL schema (production)

docs/features/
├── DONATIONS_SYSTEM_COMPLETE_ARCHITECTURE.md   # Full documentation
├── DONATIONS_PHASE_2_IMPLEMENTATION_PLAN.md    # Implementation guide
├── DONATIONS_ARCHITECTURAL_DECISIONS.md        # Design decisions
├── DONATIONS_QUICK_REFERENCE.md               # This file
└── BTCPAY_PRODUCTION_SETUP.md                 # BTCPay Server production config (Feb 2026)
```

---

## Common Tasks

### Add a New Expense (Manual - Production)

```bash
# SSH to production server
ssh user@192.168.1.15

# Connect to PostgreSQL
docker exec -it veritable-games-postgres psql -U postgres -d veritable_games

# Add expense
INSERT INTO donations.expenses (category_id, amount, description, expense_date)
VALUES (1, 150.00, 'Domain renewal for veritablegames.com', '2025-11-20');

# Verify
SELECT * FROM donations.expenses ORDER BY created_at DESC LIMIT 5;
```

### Add a New Expense (UI - Phase 2)

1. Visit https://www.veritablegames.com/admin/expenses
2. Click "Add Expense"
3. Fill form (category, amount, date, description)
4. Click "Create Expense"

### Create a Campaign (Manual - Production)

```sql
-- Connect to database (see above)

INSERT INTO donations.funding_goals (
  project_id, title, target_amount, start_date, end_date, is_active
) VALUES (
  1, -- NOXII project
  'Q1 2025 Development Fund',
  5000.00,
  '2025-01-01',
  '2025-03-31',
  TRUE
);
```

### Create a Campaign (UI - Phase 2)

1. Visit https://www.veritablegames.com/admin/campaigns
2. Click "Create Campaign"
3. Fill form (project, title, target, dates)
4. Click "Create Campaign"

### Check Recent Donations

```sql
-- Production
docker exec -it veritable-games-postgres psql -U postgres -d veritable_games -c "
  SELECT id, amount, currency, payment_status, created_at
  FROM donations.donations
  ORDER BY created_at DESC
  LIMIT 10;
"

-- Development
cd frontend
sqlite3 data/donations.db "
  SELECT id, amount, currency, payment_status, created_at
  FROM donations
  ORDER BY created_at DESC
  LIMIT 10;
"
```

### View Donation Allocations

```sql
SELECT
  d.id,
  d.amount,
  fp.name AS project_name,
  da.percentage
FROM donations.donations d
JOIN donations.donation_allocations da ON d.id = da.donation_id
JOIN donations.funding_projects fp ON da.project_id = fp.id
WHERE d.id = 10;  -- Replace with donation ID
```

### Calculate Total Donations

```sql
-- All time
SELECT SUM(amount) AS total FROM donations.donations WHERE payment_status = 'settled';

-- This year
SELECT SUM(amount) AS total FROM donations.donations
WHERE payment_status = 'settled' AND EXTRACT(YEAR FROM created_at) = 2025;

-- By project
SELECT fp.name, SUM(d.amount * da.percentage / 100.0) AS total
FROM donations.donations d
JOIN donations.donation_allocations da ON d.id = da.donation_id
JOIN donations.funding_projects fp ON da.project_id = fp.id
WHERE d.payment_status = 'settled'
GROUP BY fp.name;
```

---

## Service Layer Cheat Sheet

```typescript
import { donationService } from '@/lib/donations/service';

// Create donation
const donation = await donationService.createDonation({
  amount: 10.0,
  currency: 'USD',
  payment_processor: 'stripe',
  donor_name: 'John Doe',
  donor_email: 'john@example.com',
  allocations: [{ project_id: 1n, percentage: 100 }],
});

// Update payment status (webhook)
await donationService.updatePaymentStatus(
  'stripe_session_id_here',
  'settled',
  'payment_intent_id'
);

// Get transparency metrics (dashboard)
const metrics = await donationService.getTransparencyMetrics();

// Get active projects
const projects = await donationService.getActiveFundingProjects();

// Get active goals
const goals = await donationService.getActiveFundingGoals();

// Create expense (admin)
const expense = await donationService.createExpense({
  category_id: 1n,
  amount: 100.0,
  description: 'Server costs',
  expense_date: '2025-11-20',
});

// Get expenses (admin)
const expenses = await donationService.getExpenses({
  year: 2025,
  category_id: 1,
});

// Get expense categories
const categories = await donationService.getExpenseCategories();
```

---

## API Endpoints Reference

### Public Endpoints

```bash
# Create BTCPay donation
POST /api/donations/btcpay
{
  "amount": 10.00,
  "currency": "USD",
  "projectId": 1,
  "donorName": "John Doe",  # optional
  "donorEmail": "john@example.com",  # optional
  "message": "Great work!"  # optional
}
# Returns: { donationId, invoiceId, checkoutUrl }

# Get transparency metrics (Phase 2)
GET /api/donations/transparency
# Returns: { total_all_time, expense_breakdown, project_totals, ... }

# List projects (Phase 2)
GET /api/donations/projects
# Returns: [{ id, name, description, current_amount, is_active }, ...]

# List expense categories (Phase 2)
GET /api/donations/categories
# Returns: [{ id, name, color, icon, display_order }, ...]
```

### Admin Endpoints (Phase 2)

```bash
# List expenses
GET /api/admin/expenses?year=2025&category_id=1

# Create expense
POST /api/admin/expenses
{
  "category_id": 1,
  "amount": 100.00,
  "description": "Server costs",
  "expense_date": "2025-11-20",
  "receipt_url": "https://..."  # optional
}

# List campaigns
GET /api/admin/campaigns

# Create campaign
POST /api/admin/campaigns
{
  "project_id": 1,
  "title": "Q1 2025 Development",
  "target_amount": 5000.00,
  "start_date": "2025-01-01",
  "end_date": "2025-03-31",  # optional
  "is_recurring": false,
  "recurrence_period": null  # or "monthly", "quarterly", "yearly"
}

# End campaign
PATCH /api/admin/campaigns/1
{
  "is_active": false,
  "end_date": "2025-11-20"
}

# Export CSV
GET /api/admin/export?type=donations&year=2025
GET /api/admin/export?type=expenses&year=2025
```

### Webhook Endpoints

```bash
# BTCPay webhook (called by BTCPay Server)
POST /api/donations/btcpay/webhook
# Headers: BTCPAY-SIG
# Body: BTCPay webhook payload

# Stripe webhook (Phase 2, called by Stripe)
POST /api/donations/stripe/webhook
# Headers: stripe-signature
# Body: Stripe event payload
```

---

## Database Schema Quick Reference

### Tables

```
donations.donations               # Core donation records
donations.donation_allocations    # How donations split across projects
donations.funding_projects        # Projects that can receive funding
donations.funding_goals           # Time-limited campaigns
donations.expenses                # Organization spending
donations.expense_categories      # Expense categorization
donations.monthly_summaries       # Pre-calculated aggregations
```

### Key Fields

```sql
-- donations table
id                BIGSERIAL PRIMARY KEY
amount            NUMERIC(10,2)
currency          VARCHAR(3)           -- USD, BTC, EUR, GBP
payment_processor VARCHAR(50)          -- stripe, btcpay
payment_status    VARCHAR(20)          -- pending, settled, failed, refunded
payment_id        TEXT                 -- External payment ID
donor_name        VARCHAR(255)
donor_email       VARCHAR(255)
is_anonymous      BOOLEAN
message           TEXT
metadata          JSONB                -- Extra data (invoice URLs, etc.)
created_at        TIMESTAMP

-- donation_allocations table
donation_id       BIGINT REFERENCES donations(id)
project_id        BIGINT REFERENCES funding_projects(id)
percentage        INTEGER              -- 0-100

-- funding_goals table
project_id        BIGINT REFERENCES funding_projects(id)
title             VARCHAR(255)
target_amount     NUMERIC(10,2)
current_amount    NUMERIC(10,2)        -- Updated by triggers
start_date        DATE
end_date          DATE                 -- NULL = ongoing
is_active         BOOLEAN
is_recurring      BOOLEAN
recurrence_period VARCHAR(50)          -- monthly, quarterly, yearly

-- expenses table
category_id       BIGINT REFERENCES expense_categories(id)
amount            NUMERIC(10,2)
description       TEXT
expense_date      DATE
receipt_url       TEXT
```

---

## Troubleshooting

### Donation Not Appearing After Payment

```bash
# 1. Check BTCPay webhook logs
ssh user@192.168.1.15
docker logs m4s0kwo4kc4oooocck4sswc4 | grep BTCPay

# 2. Check donation status
docker exec -it veritable-games-postgres psql -U postgres -d veritable_games -c "
  SELECT id, amount, payment_status, payment_id, created_at
  FROM donations.donations
  WHERE payment_id = 'invoice_id_here';
"

# 3. Manually update status if needed
docker exec -it veritable-games-postgres psql -U postgres -d veritable_games -c "
  UPDATE donations.donations
  SET payment_status = 'settled'
  WHERE payment_id = 'invoice_id_here';
"
```

### Webhook Not Firing

```bash
# 1. Check BTCPay webhook configuration
# Visit: BTCPay Dashboard → Settings → Webhooks
# Verify URL: https://www.veritablegames.com/api/donations/btcpay/webhook

# 2. Check webhook secret matches
ssh user@192.168.1.15
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep BTCPAY_WEBHOOK_SECRET

# 3. Test webhook manually
curl -X POST https://www.veritablegames.com/api/donations/btcpay/webhook \
  -H "Content-Type: application/json" \
  -H "BTCPAY-SIG: your_signature_here" \
  -d '{"invoiceId": "test", "type": "InvoiceSettled"}'
```

### Transparency Dashboard Not Loading

```bash
# 1. Check API endpoint
curl https://www.veritablegames.com/api/donations/transparency

# 2. Check database has data
docker exec -it veritable-games-postgres psql -U postgres -d veritable_games -c "
  SELECT COUNT(*) FROM donations.donations WHERE payment_status = 'settled';
"

# 3. Check monthly summaries exist
docker exec -it veritable-games-postgres psql -U postgres -d veritable_games -c "
  SELECT * FROM donations.monthly_summaries ORDER BY year DESC, month DESC LIMIT 5;
"

# 4. Regenerate summaries if empty
# (Run in Node.js)
await donationService.regenerateMonthlySummaries();
```

### CSRF Token Error

```bash
# Symptom: "CSRF token invalid" error

# Solution 1: Use fetchJSON() wrapper (recommended)
import { fetchJSON } from '@/lib/utils/csrf';
const data = await fetchJSON('/api/donations/stripe', {
  method: 'POST',
  body: { amount: 10, projectId: 1 }
});

# Solution 2: Get token manually
const csrfToken = document.cookie
  .split('; ')
  .find(row => row.startsWith('csrf-token='))
  ?.split('=')[1];

fetch('/api/donations/stripe', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify({ amount: 10, projectId: 1 })
});
```

---

## Environment Variables

### Development (.env.local)

```bash
# Database (development uses SQLite, no connection string needed)
DATABASE_MODE=sqlite

# BTCPay Server
BTCPAY_SERVER_URL=http://localhost:14142  # Your BTCPay instance
BTCPAY_STORE_ID=your_store_id_here
BTCPAY_API_KEY=your_api_key_here
BTCPAY_WEBHOOK_SECRET=your_webhook_secret_here

# Stripe (Phase 2) - Use test keys
STRIPE_SECRET_KEY=sk_test_your_test_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_test_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Base URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Production (Coolify Environment Variables)

```bash
# Database
DATABASE_MODE=postgres
POSTGRES_URL=postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games

# BTCPay Server
BTCPAY_SERVER_URL=https://btcpay.example.com
BTCPAY_STORE_ID=production_store_id
BTCPAY_API_KEY=production_api_key
BTCPAY_WEBHOOK_SECRET=production_webhook_secret

# Stripe (Phase 2) - Use live keys
STRIPE_SECRET_KEY=sk_live_your_live_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_live_webhook_secret_here

# Base URL
NEXT_PUBLIC_BASE_URL=https://www.veritablegames.com
```

---

## Testing

### Test Donation Flow (BTCPay)

```bash
# 1. Start dev server
cd frontend
npm run dev

# 2. Visit donation page
open http://localhost:3000/donate

# 3. Fill form
# - Amount: $0.01 (minimum)
# - Project: Any
# - Payment method: Bitcoin/Lightning

# 4. Complete payment on BTCPay checkout
# - Use test Bitcoin address (if on testnet)
# - Or use Lightning test wallet

# 5. Check donation appears in database
sqlite3 data/donations.db "SELECT * FROM donations ORDER BY created_at DESC LIMIT 1;"
```

### Test Stripe Flow (Phase 2)

```bash
# 1. Use Stripe test card
Card: 4242 4242 4242 4242
Expiry: Any future date
CVC: Any 3 digits

# 2. Complete checkout
# Payment should complete instantly

# 3. Check webhook received
docker logs m4s0kwo4kc4oooocck4sswc4 | grep "Stripe Webhook"
```

### Test Transparency Dashboard (Phase 2)

```bash
# 1. Add test data
# Create some donations and expenses (see "Common Tasks")

# 2. Visit homepage
open http://localhost:3000

# 3. Verify dashboard displays
# - Total amounts
# - Expense pie chart
# - Project totals
# - Active goals
```

---

## Production Deployment Checklist

```bash
# 1. Verify TypeScript compiles
cd frontend
npm run type-check  # Must pass

# 2. Run tests
npm test  # Must pass

# 3. Commit changes
git add .
git commit -m "Add donations feature"
git push origin main

# 4. Trigger deployment (auto-deploy may trigger)
coolify deploy uuid m4s0kwo4kc4oooocck4sswc4

# 5. Wait 3-5 minutes for build

# 6. Check deployment status
coolify app get m4s0kwo4kc4oooocck4sswc4

# 7. Verify container is healthy
ssh user@192.168.1.15
docker ps --filter "name=m4s0kwo4kc4oooocck4sswc4"
# Should show: "Up X seconds (healthy)"

# 8. Check logs for errors
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 50

# 9. Test donation flow on production
open https://www.veritablegames.com/donate

# 10. Verify webhook endpoints work
# Make test donation, check it settles
```

---

## Useful SQL Queries

### Top Donors (All Time)

```sql
SELECT
  COALESCE(donor_name, 'Anonymous') AS donor,
  COUNT(*) AS donation_count,
  SUM(amount) AS total_donated
FROM donations.donations
WHERE payment_status = 'settled'
GROUP BY donor_name
ORDER BY total_donated DESC
LIMIT 10;
```

### Monthly Donation Totals

```sql
SELECT
  TO_CHAR(created_at, 'YYYY-MM') AS month,
  COUNT(*) AS count,
  SUM(amount) AS total
FROM donations.donations
WHERE payment_status = 'settled'
GROUP BY TO_CHAR(created_at, 'YYYY-MM')
ORDER BY month DESC;
```

### Expense Breakdown (This Year)

```sql
SELECT
  ec.name AS category,
  COUNT(*) AS expense_count,
  SUM(e.amount) AS total,
  ROUND(SUM(e.amount) / (SELECT SUM(amount) FROM donations.expenses WHERE EXTRACT(YEAR FROM expense_date) = 2025) * 100, 2) AS percentage
FROM donations.expenses e
JOIN donations.expense_categories ec ON e.category_id = ec.id
WHERE EXTRACT(YEAR FROM e.expense_date) = 2025
GROUP BY ec.name, ec.display_order
ORDER BY ec.display_order;
```

### Campaign Progress

```sql
SELECT
  fg.title,
  fp.name AS project,
  fg.target_amount,
  fg.current_amount,
  ROUND(fg.current_amount / fg.target_amount * 100, 2) AS progress_percent,
  fg.end_date
FROM donations.funding_goals fg
JOIN donations.funding_projects fp ON fg.project_id = fp.id
WHERE fg.is_active = TRUE
ORDER BY fg.end_date ASC NULLS LAST;
```

### Failed Donations (Needs Review)

```sql
SELECT
  id,
  amount,
  payment_processor,
  payment_id,
  created_at,
  metadata
FROM donations.donations
WHERE payment_status = 'failed'
ORDER BY created_at DESC;
```

---

## Performance Tips

1. **Use Pre-Calculated Summaries**: Don't query `donations` table directly for totals, use `monthly_summaries`
2. **Index Common Queries**: Database has indexes on `payment_status`, `created_at`, `project_id`
3. **Limit API Response Size**: Use pagination for large datasets
4. **Cache Transparency Metrics**: Consider caching `/api/donations/transparency` response for 5 minutes
5. **Optimize Pie Charts**: Recharts can be slow with 100+ data points, limit to top 10 categories

---

## Links

- **Full Documentation**: `docs/features/DONATIONS_SYSTEM_COMPLETE_ARCHITECTURE.md`
- **Implementation Plan**: `docs/features/DONATIONS_PHASE_2_IMPLEMENTATION_PLAN.md`
- **Architectural Decisions**: `docs/features/DONATIONS_ARCHITECTURAL_DECISIONS.md`
- **BTCPay Research**: `docs/BTCPAY_SERVER_RESEARCH_REPORT.md`
- **Production Access**: `docs/deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md`

---

**End of Quick Reference Guide**

_Print this and keep it by your desk!_
