/**
 * Donation Analytics Tracking
 * Tracks user interactions and conversion funnel for A/B testing
 *
 * Events tracked:
 * - donation_page_viewed
 * - donation_payment_method_selected
 * - donation_amount_selected
 * - donation_project_selected
 * - donation_form_submitted
 * - donation_checkout_started
 * - donation_error
 */

import { logger } from '@/lib/utils/logger';

export interface DonationEventData {
  variant?: string;
  paymentMethod?: 'stripe' | 'btcpay';
  amount?: number;
  isCustomAmount?: boolean;
  projectId?: number;
  projectName?: string;
  error?: string;
  [key: string]: any;
}

/**
 * Track a donation-related event
 * In production, this would send to your analytics service (Google Analytics, Mixpanel, etc.)
 * For now, logs to console and could be extended to send to backend
 */
export function trackDonationEvent(eventName: string, data?: DonationEventData) {
  const timestamp = new Date().toISOString();
  const eventData = {
    event: eventName,
    timestamp,
    ...data,
  };

  // Log to console for development
  logger.info('[Analytics]', eventData);

  // TODO: In production, send to analytics service
  // Example:
  // if (typeof window !== 'undefined' && window.gtag) {
  //   window.gtag('event', eventName, data);
  // }

  // Could also send to backend for server-side tracking
  // fetch('/api/analytics/track', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(eventData),
  // }).catch(console.error);
}

/**
 * Track page view for donation variant
 */
export function trackDonationPageView(variant: string) {
  trackDonationEvent('donation_page_viewed', { variant });
}

/**
 * Track payment method selection
 */
export function trackPaymentMethodSelected(method: 'stripe' | 'btcpay', variant?: string) {
  trackDonationEvent('donation_payment_method_selected', {
    paymentMethod: method,
    variant,
  });
}

/**
 * Track donation amount selection
 */
export function trackAmountSelected(amount: number, isCustom: boolean, variant?: string) {
  trackDonationEvent('donation_amount_selected', {
    amount,
    isCustomAmount: isCustom,
    variant,
  });
}

/**
 * Track project/campaign selection
 */
export function trackProjectSelected(projectId: number, projectName: string, variant?: string) {
  trackDonationEvent('donation_project_selected', {
    projectId,
    projectName,
    variant,
  });
}

/**
 * Track form submission
 */
export function trackFormSubmitted(
  amount: number,
  paymentMethod: 'stripe' | 'btcpay',
  projectId: number,
  variant?: string
) {
  trackDonationEvent('donation_form_submitted', {
    amount,
    paymentMethod,
    projectId,
    variant,
  });
}

/**
 * Track successful checkout URL received
 */
export function trackCheckoutStarted(
  amount: number,
  paymentMethod: 'stripe' | 'btcpay',
  variant?: string
) {
  trackDonationEvent('donation_checkout_started', {
    amount,
    paymentMethod,
    variant,
  });
}

/**
 * Track donation errors
 */
export function trackDonationError(error: string, context?: Record<string, any>) {
  trackDonationEvent('donation_error', {
    error,
    ...context,
  });
}

/**
 * Calculate time to donate (from page load to form submit)
 */
export function createTimingTracker() {
  const startTime = Date.now();

  return {
    trackSubmit(variant?: string) {
      const timeToSubmit = Date.now() - startTime;
      trackDonationEvent('donation_time_to_submit', {
        timeToSubmitMs: timeToSubmit,
        timeToSubmitSeconds: Math.round(timeToSubmit / 1000),
        variant,
      });
    },
  };
}
