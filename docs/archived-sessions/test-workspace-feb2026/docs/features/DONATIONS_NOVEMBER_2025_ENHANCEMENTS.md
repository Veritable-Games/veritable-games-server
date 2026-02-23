# Donation System Enhancements - November 2025

**Date**: November 30, 2025
**Status**: Complete and Deployed

## Overview

This document details the comprehensive donation system enhancements implemented in November 2025, including federal tax calculations, expense category management, and a 3-tier transparency dashboard.

---

## 1. Federal Tax Service

### Purpose
Calculate US federal tax liability with 2024 marginal brackets for transparency reporting.

### Location
`frontend/src/lib/donations/tax-service.ts`

### Features
- **Marginal Tax Calculation**: Uses 2024 US federal brackets for single filers
- **Effective Rate**: Calculates actual tax rate based on total income
- **Quarterly Payments**: Estimates quarterly tax payments
- **Nevada-Specific**: No state tax (federal only)

### Tax Brackets (2024)
| Income Range | Marginal Rate |
|--------------|---------------|
| $0 - $11,600 | 10% |
| $11,601 - $47,150 | 12% |
| $47,151 - $100,525 | 22% |
| $100,526 - $191,950 | 24% |
| $191,951 - $243,725 | 32% |
| $243,726 - $609,350 | 35% |
| $609,350+ | 37% |

### Usage
```typescript
import { federalTaxService } from '@/lib/donations/tax-service';

const result = federalTaxService.calculateFederalTax(annualIncome);
// Returns: { tax, effectiveRate, marginalBracket, quarterlyPayment }
```

---

## 2. Expense Category Admin CRUD

### Purpose
Allow administrators to dynamically manage expense categories for transparency reporting.

### Admin Page
**URL**: `/admin/transparency/categories`

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/transparency/categories` | List all categories |
| POST | `/api/admin/transparency/categories` | Create new category |
| GET | `/api/admin/transparency/categories/[id]` | Get single category |
| PUT | `/api/admin/transparency/categories/[id]` | Update category |
| DELETE | `/api/admin/transparency/categories/[id]` | Delete category |

### Category Properties
- `name`: Display name
- `slug`: URL-safe identifier
- `description`: Optional description
- `color`: Hex color for charts
- `icon`: Optional icon identifier
- `display_order`: Sort order
- `is_active`: Active/inactive status

### Files
- `frontend/src/app/admin/transparency/categories/page.tsx`
- `frontend/src/components/admin/CategoryManager.tsx`
- `frontend/src/app/api/admin/transparency/categories/route.ts`
- `frontend/src/app/api/admin/transparency/categories/[id]/route.ts`

---

## 3. Enhanced Transparency Dashboard

### Purpose
Provide a 3-tier detail view of financial transparency data.

### Location
`frontend/src/components/donations/TransparencyDashboard.tsx`

### Tier Structure

#### Tier 1: Category Totals
- Pie chart visualization of expense breakdown
- Aggregated amounts per category
- Percentage of total expenses

#### Tier 2: Line Items (Expandable)
- Individual expenses within each category
- Click category header to expand/collapse
- Shows: description, date, amount, recurring status

#### Tier 3: Monthly Breakdown (Collapsible)
- Month-by-month financial summary
- Shows: donations, expenses, net amount
- Collapsible for cleaner view

### New Types
```typescript
interface ExpenseLineItem {
  id: ExpenseId;
  description: string;
  amount: number;
  expense_date: string;
  is_recurring: boolean;
  recurrence_period: 'monthly' | 'yearly' | null;
}

interface ExpenseCategoryWithItems extends ExpenseCategoryBreakdown {
  items: ExpenseLineItem[];
}
```

### Stats Cards
- **Total Raised**: All-time donation total
- **This Year**: Current year donations
- **Net This Year**: Donations minus expenses (color-coded)
- **Avg Goal Progress**: Average completion of active goals

### Tax Info Card
Displays when tax data is available:
- Estimated Tax
- Effective Rate
- Marginal Bracket
- Quarterly Payment

---

## 4. Database Changes

### Migration Applied
`003-subscriptions-and-paypal-removal.sql` - Creates `subscriptions` table

### Service Methods Added
```typescript
// TransparencyService additions
getDetailedExpensesByCategory(year: number): Promise<ExpenseCategoryWithItems[]>
getAllExpenseCategories(): Promise<ExpenseCategory[]>
getExpenseCategoryById(id: number): Promise<ExpenseCategory | null>
createExpenseCategory(data): Promise<ExpenseCategory>
updateExpenseCategory(id, data): Promise<ExpenseCategory>
deleteExpenseCategory(id): Promise<void>
```

---

## 5. Dashboard Quick Fixes

### DonorDashboardClient.tsx
- "Set up recurring donation" now links to `/donate?frequency=monthly`
- Net this year properly formats negative values

### donation-form.tsx
- Reads `?frequency=monthly` URL parameter
- Pre-selects Monthly when parameter present

---

## Related Documentation
- [DONATIONS_SYSTEM_COMPLETE_ARCHITECTURE.md](./DONATIONS_SYSTEM_COMPLETE_ARCHITECTURE.md)
- [DONATIONS_QUICK_REFERENCE.md](./DONATIONS_QUICK_REFERENCE.md)
- [DONATIONS_UI_CONSISTENCY_NOV_2025.md](./DONATIONS_UI_CONSISTENCY_NOV_2025.md)
