'use client';

import { CheckCircle, Mail, TrendingUp, Heart, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { DonationFormData } from './DonationModal';

interface Step4ConfirmationProps {
  formData: DonationFormData;
  onClose: () => void;
}

export default function Step4Confirmation({ formData, onClose }: Step4ConfirmationProps) {
  const formatCurrency = (amount: number) => {
    const numericAmount = Number(amount) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericAmount);
  };

  return (
    <div className="space-y-6 py-4">
      {/* Success Icon */}
      <div className="flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-green-500 bg-green-600/20">
          <CheckCircle className="h-12 w-12 text-green-400" />
        </div>
      </div>

      {/* Success Message */}
      <div className="text-center">
        <h3 className="mb-2 text-2xl font-bold text-white">Thank You for Your Support!</h3>
        <p className="text-gray-400">Your donation has been processed successfully.</p>
      </div>

      {/* Confirmation Details */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-5">
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Confirmation Number:</span>
            <span className="font-mono font-semibold text-white">
              {formData.confirmationNumber || 'VG12345678'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Amount:</span>
            <span className="font-semibold text-white">
              {formData.amount ? formatCurrency(formData.amount) : '$0.00'}
            </span>
          </div>
          {formData.isRecurring && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Frequency:</span>
              <span className="font-semibold text-blue-400">Monthly Recurring</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Supporting:</span>
            <span className="font-semibold text-white">
              {formData.campaignName || 'General Support'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Payment Method:</span>
            <span className="font-semibold capitalize text-white">
              {formData.paymentProcessor === 'stripe'
                ? 'Credit Card'
                : formData.paymentProcessor === 'btcpay'
                  ? 'Cryptocurrency'
                  : formData.paymentProcessor || 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* What Happens Next */}
      <div className="rounded-lg border border-blue-500/30 bg-blue-900/20 p-5">
        <h4 className="mb-3 flex items-center gap-2 font-semibold text-white">
          <Mail className="h-5 w-5 text-blue-400" />
          What happens next?
        </h4>
        <ul className="space-y-2 text-sm text-gray-300">
          {!formData.isAnonymous && formData.donorEmail && (
            <li className="flex items-start gap-2">
              <span className="mt-1 text-blue-400">•</span>
              <span>
                A receipt has been sent to{' '}
                <span className="text-blue-400">{formData.donorEmail}</span>
              </span>
            </li>
          )}
          <li className="flex items-start gap-2">
            <span className="mt-1 text-blue-400">•</span>
            <span>
              Your donation will be allocated to {formData.campaignName || 'active projects'}
            </span>
          </li>
          {formData.isRecurring && (
            <li className="flex items-start gap-2">
              <span className="mt-1 text-blue-400">•</span>
              <span>Monthly donations will be processed on the same day each month</span>
            </li>
          )}
          <li className="flex items-start gap-2">
            <span className="mt-1 text-blue-400">•</span>
            <span>Track how your donation is used on our transparency dashboard</span>
          </li>
        </ul>
      </div>

      {/* Impact Message */}
      <div className="rounded-lg border border-purple-500/30 bg-gradient-to-br from-purple-900/30 to-pink-900/30 p-5">
        <div className="flex items-start gap-3">
          <Heart className="mt-0.5 h-6 w-6 flex-shrink-0 text-purple-400" />
          <div>
            <h4 className="mb-2 font-semibold text-white">Your Impact</h4>
            <p className="text-sm leading-relaxed text-gray-300">
              {formData.isRecurring ? (
                <>
                  Your monthly support of {formData.amount ? formatCurrency(formData.amount) : '$0'}{' '}
                  provides sustainable funding that helps us plan long-term projects and maintain
                  reliable infrastructure. Thank you for being a sustaining supporter!
                </>
              ) : (
                <>
                  Your {formData.amount ? formatCurrency(formData.amount) : '$0'} donation directly
                  funds game development, infrastructure improvements, and community initiatives.
                  Every contribution makes a real difference in what we can build together.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Call to Action Buttons */}
      <div className="space-y-3 pt-4">
        <Link
          href="/donate/transparency"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <TrendingUp className="h-5 w-5" />
          View Transparency Dashboard
          <ExternalLink className="h-4 w-4" />
        </Link>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-600"
          >
            Make Another Donation
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>

      {/* Social Proof / Encouragement */}
      <div className="border-t border-gray-700 pt-4 text-center">
        <p className="text-sm text-gray-400">
          You're one of many supporters making Veritable Games possible. Together, we're building
          something amazing.
        </p>
      </div>
    </div>
  );
}
