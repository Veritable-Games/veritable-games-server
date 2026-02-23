/**
 * Federal Tax Service
 *
 * Calculates US federal income tax using marginal tax brackets.
 * Nevada has no state income tax, so we only calculate federal.
 *
 * Uses 2024 tax brackets (Single Filer):
 * - 10%: $0 - $11,600
 * - 12%: $11,601 - $47,150
 * - 22%: $47,151 - $100,525
 * - 24%: $100,526 - $191,950
 * - 32%: $191,951 - $243,725
 * - 35%: $243,726 - $609,350
 * - 37%: Over $609,350
 */

// 2024 Tax Brackets (Single Filer)
// Updated annually by the IRS
export const TAX_BRACKETS_2024 = [
  { limit: 11600, rate: 0.1, label: '10%' },
  { limit: 47150, rate: 0.12, label: '12%' },
  { limit: 100525, rate: 0.22, label: '22%' },
  { limit: 191950, rate: 0.24, label: '24%' },
  { limit: 243725, rate: 0.32, label: '32%' },
  { limit: 609350, rate: 0.35, label: '35%' },
  { limit: Infinity, rate: 0.37, label: '37%' },
] as const;

export interface TaxCalculationResult {
  /** Total tax owed */
  tax: number;
  /** Effective tax rate as percentage (0-100) */
  effectiveRate: number;
  /** Marginal bracket the income falls into */
  marginalBracket: {
    rate: number;
    label: string;
    floorLimit: number;
    ceilingLimit: number;
  };
  /** Breakdown of tax by bracket */
  bracketBreakdown: Array<{
    bracket: string;
    rate: number;
    taxableAmount: number;
    taxOwed: number;
  }>;
}

export interface BracketInfo {
  rate: number;
  label: string;
  floorLimit: number;
  ceilingLimit: number;
  /** Amount of income taxed in this bracket */
  taxableInBracket: number;
  /** Tax owed for this bracket portion */
  taxForBracket: number;
}

/**
 * Calculate federal income tax using marginal bracket system
 *
 * @param income - Annual taxable income
 * @param brackets - Tax brackets to use (defaults to 2024 brackets)
 * @returns Detailed tax calculation result
 */
export function calculateFederalTax(
  income: number,
  brackets = TAX_BRACKETS_2024
): TaxCalculationResult {
  if (income <= 0) {
    return {
      tax: 0,
      effectiveRate: 0,
      marginalBracket: {
        rate: brackets[0].rate,
        label: brackets[0].label,
        floorLimit: 0,
        ceilingLimit: brackets[0].limit,
      },
      bracketBreakdown: [],
    };
  }

  let totalTax = 0;
  let prevLimit = 0;
  const breakdown: TaxCalculationResult['bracketBreakdown'] = [];
  let currentBracketIndex = 0;

  for (let i = 0; i < brackets.length; i++) {
    const bracket = brackets[i]!; // Always defined within loop bounds

    if (income <= prevLimit) break;

    const taxableInBracket = Math.min(income, bracket.limit) - prevLimit;
    const taxForBracket = taxableInBracket * bracket.rate;

    totalTax += taxForBracket;

    if (taxableInBracket > 0) {
      breakdown.push({
        bracket: bracket.label,
        rate: bracket.rate,
        taxableAmount: taxableInBracket,
        taxOwed: taxForBracket,
      });
      currentBracketIndex = i;
    }

    prevLimit = bracket.limit;
  }

  // Safe access - currentBracketIndex is always valid (0 to brackets.length-1)
  const currentBracket = brackets[currentBracketIndex]!;
  const prevBracket = currentBracketIndex > 0 ? brackets[currentBracketIndex - 1] : undefined;
  const floorLimit = prevBracket?.limit ?? 0;

  return {
    tax: totalTax,
    effectiveRate: income > 0 ? (totalTax / income) * 100 : 0,
    marginalBracket: {
      rate: currentBracket.rate,
      label: currentBracket.label,
      floorLimit,
      ceilingLimit: currentBracket.limit,
    },
    bracketBreakdown: breakdown,
  };
}

/**
 * Estimate annual tax liability from year-to-date income
 * Projects full-year income by extrapolating from current month
 *
 * @param ytdIncome - Year-to-date income (total income so far this year)
 * @param currentMonth - Current month (1-12)
 * @returns Estimated annual tax calculation
 */
export function estimateAnnualTax(
  ytdIncome: number,
  currentMonth: number = new Date().getMonth() + 1
): {
  estimated: TaxCalculationResult;
  projectedAnnualIncome: number;
  monthsCompleted: number;
} {
  // Ensure valid month
  const month = Math.max(1, Math.min(12, currentMonth));

  // Project annual income (simple linear projection)
  const projectedAnnualIncome = (ytdIncome / month) * 12;

  return {
    estimated: calculateFederalTax(projectedAnnualIncome),
    projectedAnnualIncome,
    monthsCompleted: month,
  };
}

/**
 * Get the current bracket information for a given income level
 *
 * @param income - Income level to check
 * @returns Bracket information
 */
export function getCurrentBracket(income: number): BracketInfo {
  const result = calculateFederalTax(income);

  // Get the taxable amount in the current bracket
  const lastBreakdown = result.bracketBreakdown[result.bracketBreakdown.length - 1];

  return {
    rate: result.marginalBracket.rate,
    label: result.marginalBracket.label,
    floorLimit: result.marginalBracket.floorLimit,
    ceilingLimit: result.marginalBracket.ceilingLimit,
    taxableInBracket: lastBreakdown?.taxableAmount || 0,
    taxForBracket: lastBreakdown?.taxOwed || 0,
  };
}

/**
 * Calculate quarterly estimated tax payment
 * Self-employed individuals typically need to pay quarterly
 *
 * @param annualIncome - Expected annual income
 * @returns Quarterly payment amount
 */
export function calculateQuarterlyPayment(annualIncome: number): {
  quarterlyPayment: number;
  annualTax: number;
  effectiveRate: number;
} {
  const result = calculateFederalTax(annualIncome);

  return {
    quarterlyPayment: result.tax / 4,
    annualTax: result.tax,
    effectiveRate: result.effectiveRate,
  };
}

/**
 * Format tax result for display
 *
 * @param result - Tax calculation result
 * @returns Formatted strings for UI display
 */
export function formatTaxResult(result: TaxCalculationResult): {
  tax: string;
  effectiveRate: string;
  marginalRate: string;
  bracket: string;
} {
  return {
    tax: new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(result.tax),
    effectiveRate: `${result.effectiveRate.toFixed(1)}%`,
    marginalRate: result.marginalBracket.label,
    bracket: `$${result.marginalBracket.floorLimit.toLocaleString()} - $${result.marginalBracket.ceilingLimit === Infinity ? '∞' : result.marginalBracket.ceilingLimit.toLocaleString()}`,
  };
}

// Export singleton for convenience
export const taxService = {
  calculate: calculateFederalTax,
  estimate: estimateAnnualTax,
  getBracket: getCurrentBracket,
  quarterlyPayment: calculateQuarterlyPayment,
  format: formatTaxResult,
  brackets: TAX_BRACKETS_2024,
};
