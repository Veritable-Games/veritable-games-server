import { getServerSession } from '@/lib/auth/session';
import { EditablePageHeader } from '@/components/shared/EditablePageHeader';
import { OverviewSection } from '@/components/donate/transparency/OverviewSection';
import { ExpensesSection } from '@/components/donate/transparency/ExpensesSection';
import { CategoriesSection } from '@/components/donate/transparency/CategoriesSection';
import { DonationsSection } from '@/components/donate/transparency/DonationsSection';
import { CollapsibleSection } from '@/components/donate/transparency/CollapsibleSection';
import { MonthlyTrendsChart } from '@/components/donate/transparency/MonthlyTrendsChart';
import { ExpenseBreakdownChart } from '@/components/donate/transparency/ExpenseBreakdownChart';

export const dynamic = 'force-dynamic';

export default async function TransparencyPage() {
  const session = await getServerSession();
  const isAdmin = session?.role === 'admin';

  // Fetch transparency metrics for charts
  let monthlyBreakdown = [];
  let expenseBreakdown = [];

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'}/api/transparency/metrics`,
      { cache: 'no-store' }
    );

    if (response.ok) {
      const data = await response.json();
      monthlyBreakdown = data.monthly_breakdown || [];
      expenseBreakdown = data.expense_breakdown || [];
    }
  } catch (error) {
    // Silent fail - components will handle empty data
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="mb-2 text-2xl font-bold text-white">Financial Transparency</h1>
        <p className="text-sm text-neutral-400">
          Our commitment to open finances and accountability
        </p>
      </div>

      {/* Overview Section - Public */}
      <div className="mb-6">
        <OverviewSection />
      </div>

      {/* Monthly Trends Chart - Public */}
      {monthlyBreakdown.length > 0 && (
        <div className="mb-6">
          <MonthlyTrendsChart data={monthlyBreakdown} />
        </div>
      )}

      {/* Expense Breakdown - Admin + Public Views */}
      {isAdmin ? (
        <div className="mb-6">
          <CollapsibleSection title="Manage Expenses">
            <ExpensesSection />
          </CollapsibleSection>
        </div>
      ) : (
        <div className="mb-6">
          <h2 className="mb-4 text-lg font-bold text-white">Expense Breakdown</h2>
          {expenseBreakdown.length > 0 && (
            <div className="mb-4">
              <ExpenseBreakdownChart data={expenseBreakdown} />
            </div>
          )}
          <ExpensesSection />
        </div>
      )}

      {/* Expense Categories - Admin Only */}
      {isAdmin && (
        <div className="mb-6">
          <CollapsibleSection title="Manage Categories">
            <CategoriesSection />
          </CollapsibleSection>
        </div>
      )}

      {/* Recent Support - Read-only for everyone */}
      <div className="mb-6">
        <h2 className="mb-4 text-lg font-bold text-white">Recent Support</h2>
        <DonationsSection />
      </div>
    </div>
  );
}
