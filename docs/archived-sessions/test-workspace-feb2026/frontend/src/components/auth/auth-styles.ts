/**
 * Shared Authentication Styles
 *
 * Consistent styling constants for all authentication forms (Login, Register, Forgot Password, 2FA).
 * These classes follow the site's design language from Settings/Profile pages.
 */

// Card container for auth forms
export const authCardClass =
  'mx-auto max-w-md rounded-lg border border-gray-700 bg-gray-900/80 p-5';

// Form title styling
export const authTitleClass = 'mb-3 text-center text-2xl font-bold text-white';

// Subtitle/description text
export const authSubtitleClass = 'mb-4 text-center text-sm text-gray-400';

// Link styling (e.g., "Forgot password?", "Sign up here")
// inline-text-link exempts from 44px min-height touch target rule
export const authLinkClass =
  'inline-text-link text-sm text-blue-400 transition-colors hover:text-blue-300';

// Primary action button
export const authButtonClass =
  'w-full rounded-md bg-blue-600 py-2.5 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';

// Secondary/outline button
export const authSecondaryButtonClass =
  'w-full rounded-md border border-gray-600 bg-transparent py-2.5 font-medium text-gray-300 transition-colors hover:border-gray-500 hover:bg-gray-800 hover:text-white';

// Error alert container
export const authErrorClass =
  'mb-4 rounded border border-red-700 bg-red-900/50 px-4 py-3 text-red-200';

// Success alert container
export const authSuccessClass =
  'mb-4 rounded border border-green-700 bg-green-900/50 px-4 py-3 text-green-200';

// Info alert container
export const authInfoClass =
  'mb-4 rounded border border-blue-700 bg-blue-900/50 px-4 py-3 text-blue-200';

// Form spacing (between fields)
export const authFormSpacingClass = 'space-y-2.5';

// Divider text (e.g., "or")
export const authDividerClass = 'text-center text-sm text-gray-500';

// Footer text (e.g., "Don't have an account?")
export const authFooterClass = 'mt-3 text-center text-gray-400';

// Back button for multi-step flows
export const authBackButtonClass = 'mr-3 text-gray-400 transition-colors hover:text-white';

// 2FA specific styles
export const auth2FAInputClass =
  'flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-center font-mono text-lg tracking-widest ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

// 2FA section title
export const auth2FATitleClass = 'text-xl font-bold text-white';
