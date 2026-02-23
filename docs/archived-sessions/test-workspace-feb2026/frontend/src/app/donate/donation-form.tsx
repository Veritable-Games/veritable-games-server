'use client';

/**
 * Donation Form Component
 * Tabbed interface supporting both Stripe (default) and BTCPay payment methods
 * With preset amount buttons and dynamic messaging
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { FundingProjectWithProgress } from '@/lib/donations/types';
import { fetchJSON } from '@/lib/utils/csrf';
import { CreditCard, Bitcoin } from 'lucide-react';
import { logger } from '@/lib/utils/logger';

interface DonationFormProps {
  projects: FundingProjectWithProgress[];
}

type PaymentMethod = 'stripe' | 'btcpay';

export function DonationForm({ projects }: DonationFormProps) {
  const searchParams = useSearchParams();

  // Payment method state (STRIPE is DEFAULT per user requirement)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('stripe');

  // Recurring payment state - check URL param for initial value
  const [isRecurring, setIsRecurring] = useState(false);

  // Read URL params on mount to pre-select monthly if specified
  useEffect(() => {
    const frequency = searchParams.get('frequency');
    if (frequency === 'monthly') {
      setIsRecurring(true);
    }
  }, [searchParams]);

  // Form state
  const [amount, setAmount] = useState('10.00');
  const [customAmountInput, setCustomAmountInput] = useState('');
  const [projectId, setProjectId] = useState(projects[0]?.id || 1);
  const [donorName, setDonorName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Dynamic minimum amount based on payment method
  const minAmount = paymentMethod === 'stripe' ? 0.5 : 0.01;
  const presetAmounts = [5, 10, 25, 50, 100];

  const selectPresetAmount = (preset: number) => {
    setAmount(preset.toFixed(2));
    setCustomAmountInput(''); // Clear custom input when selecting preset
  };

  const handleCustomAmountChange = (value: string) => {
    // Allow only numbers and one decimal point
    const sanitized = value.replace(/[^\d.]/g, '');

    // Prevent multiple decimal points
    const parts = sanitized.split('.');
    const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitized;

    // Limit to 2 decimal places
    const decimalParts = formatted.split('.');
    const limitedDecimals =
      decimalParts.length > 1
        ? decimalParts[0] + '.' + (decimalParts[1] ?? '').slice(0, 2)
        : formatted;

    setCustomAmountInput(limitedDecimals);

    const parsed = parseFloat(limitedDecimals);
    if (!isNaN(parsed) && parsed >= minAmount) {
      setAmount(parsed.toFixed(2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      // Dynamic endpoint based on payment method
      const endpoint =
        paymentMethod === 'stripe' ? '/api/donations/stripe' : '/api/donations/btcpay';

      // Create donation and payment session (fetchJSON handles CSRF automatically)
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
          isRecurring: paymentMethod === 'stripe' ? isRecurring : false, // Only Stripe supports recurring
        },
      });

      // Redirect to payment checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: any) {
      logger.error('Donation error:', err);
      setError(err.message || 'Failed to create donation');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Payment Method Tabs */}
      <div>
        <label className="mb-3 block text-sm font-medium text-gray-300">Payment Method</label>
        <div className="flex gap-2 rounded-lg border border-gray-700 bg-gray-800/50 p-1">
          {/* Stripe Tab (DEFAULT) */}
          <button
            type="button"
            onClick={() => setPaymentMethod('stripe')}
            className={`flex-1 rounded-md px-4 py-3 text-sm font-medium transition-all ${paymentMethod === 'stripe' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-700/50'} `}
            aria-selected={paymentMethod === 'stripe'}
            role="tab"
          >
            <span className="flex items-center justify-center gap-2">
              <CreditCard className="h-4 w-4" />
              Credit/Debit Card
            </span>
          </button>

          {/* BTCPay Tab */}
          <button
            type="button"
            onClick={() => setPaymentMethod('btcpay')}
            className={`flex-1 rounded-md px-4 py-3 text-sm font-medium transition-all ${paymentMethod === 'btcpay' ? 'bg-orange-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-700/50'} `}
            aria-selected={paymentMethod === 'btcpay'}
            role="tab"
          >
            <span className="flex items-center justify-center gap-2">
              <Bitcoin className="h-4 w-4" />
              Bitcoin/Lightning
            </span>
          </button>
        </div>
      </div>

      {/* Payment Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Amount Selection with Presets */}
        <div>
          <label className="mb-3 block text-sm font-medium text-gray-300">Select Amount</label>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {presetAmounts.map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => selectPresetAmount(preset)}
                className={`rounded-lg border px-4 py-6 text-center font-semibold transition-all ${
                  !customAmountInput && amount === preset.toFixed(2)
                    ? 'border-blue-600 bg-blue-600/20 text-blue-400 shadow-lg'
                    : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600 hover:bg-gray-800'
                } `}
              >
                <div className="text-2xl">${preset}</div>
              </button>
            ))}
          </div>

          {/* Custom Amount Input - Always Visible */}
          <div className="mt-4">
            <label htmlFor="customAmount" className="mb-2 block text-sm font-medium text-gray-300">
              Or enter custom amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                id="customAmount"
                type="text"
                inputMode="decimal"
                value={customAmountInput}
                onChange={e => handleCustomAmountChange(e.target.value)}
                placeholder={`Min ${minAmount.toFixed(2)}`}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2.5 pl-8 pr-4 text-white placeholder-gray-500 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Recurring Payment Options */}
        <div>
          <label className="mb-3 block text-sm font-medium text-gray-300">Frequency</label>
          <div className="flex gap-2 rounded-lg border border-gray-700 bg-gray-800/50 p-1">
            {/* One-Time */}
            <button
              type="button"
              onClick={() => setIsRecurring(false)}
              className={`flex-1 rounded-md px-4 py-3 text-sm font-medium transition-all ${!isRecurring ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-700/50'} `}
            >
              One-Time
            </button>

            {/* Monthly */}
            <button
              type="button"
              onClick={() => setIsRecurring(true)}
              className={`flex-1 rounded-md px-4 py-3 text-sm font-medium transition-all ${isRecurring ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-700/50'} `}
            >
              Monthly
            </button>
          </div>
        </div>

        {/* Name and Email (Optional) */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="donorName" className="mb-2 block text-sm font-medium text-gray-300">
              Name (Optional)
            </label>
            <input
              id="donorName"
              type="text"
              value={donorName}
              onChange={e => setDonorName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="donorEmail" className="mb-2 block text-sm font-medium text-gray-300">
              Email (Optional)
            </label>
            <input
              id="donorEmail"
              type="email"
              value={donorEmail}
              onChange={e => setDonorEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Project Selection */}
        <div>
          <label htmlFor="project" className="mb-2 block text-sm font-medium text-gray-300">
            Support Project
          </label>
          <select
            id="project"
            value={projectId}
            onChange={e => setProjectId(parseInt(e.target.value))}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white focus:border-blue-600 focus:outline-none"
            required
          >
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        {/* Optional Message */}
        <div>
          <label htmlFor="message" className="mb-2 block text-sm font-medium text-gray-300">
            Message (Optional)
          </label>
          <textarea
            id="message"
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={3}
            placeholder="Leave a message of support..."
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-blue-600 focus:outline-none"
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="rounded-lg border border-red-800 bg-red-900/20 p-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-blue-600 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'Processing...' : `Donate $${amount}`}
        </button>

        {/* Security Note */}
        <p className="text-center text-xs text-gray-500">
          {paymentMethod === 'stripe'
            ? 'Payments secured by Stripe'
            : 'Payments processed by BTCPay Server'}
        </p>
      </form>
    </div>
  );
}
