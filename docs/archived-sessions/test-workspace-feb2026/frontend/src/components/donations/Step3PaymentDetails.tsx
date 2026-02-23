'use client';

import { useState } from 'react';
import { CreditCard, Bitcoin, AlertCircle, Lock, Shield, Eye, EyeOff } from 'lucide-react';
import type { DonationFormData } from './DonationModal';
import type { PaymentProcessor } from '@/lib/donations/types';

interface Step3PaymentDetailsProps {
  formData: DonationFormData;
  onUpdate: (updates: Partial<DonationFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const PAYMENT_PROCESSORS: {
  id: PaymentProcessor;
  name: string;
  description: string;
  icon: typeof CreditCard;
}[] = [
  {
    id: 'stripe',
    name: 'Credit/Debit Card',
    description: 'Visa, Mastercard, Amex, Discover',
    icon: CreditCard,
  },
  {
    id: 'btcpay',
    name: 'Cryptocurrency',
    description: 'Bitcoin, Lightning Network',
    icon: Bitcoin,
  },
];

export default function Step3PaymentDetails({
  formData,
  onUpdate,
  onNext,
  onBack,
}: Step3PaymentDetailsProps) {
  const [selectedProcessor, setSelectedProcessor] = useState<PaymentProcessor | null>(
    formData.paymentProcessor
  );
  const [donorName, setDonorName] = useState(formData.donorName);
  const [donorEmail, setDonorEmail] = useState(formData.donorEmail);
  const [isAnonymous, setIsAnonymous] = useState(formData.isAnonymous);
  const [message, setMessage] = useState(formData.message);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const handleProcessorSelect = (processor: PaymentProcessor) => {
    setSelectedProcessor(processor);
    onUpdate({ paymentProcessor: processor });
    setErrors(prev => ({ ...prev, processor: '' }));
  };

  const handleAnonymousToggle = () => {
    const newValue = !isAnonymous;
    setIsAnonymous(newValue);
    onUpdate({ isAnonymous: newValue });
    if (newValue) {
      setDonorName('Anonymous');
      onUpdate({ donorName: 'Anonymous' });
    } else {
      setDonorName('');
      onUpdate({ donorName: '' });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedProcessor) {
      newErrors.processor = 'Please select a payment method';
    }

    if (!isAnonymous) {
      if (!donorName.trim()) {
        newErrors.donorName = 'Name is required';
      }
      if (!donorEmail.trim()) {
        newErrors.donorEmail = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail)) {
        newErrors.donorEmail = 'Invalid email address';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCompleteDonation = async () => {
    if (!validateForm()) return;

    setIsProcessing(true);

    // Update form data with final values
    onUpdate({
      donorName: isAnonymous ? 'Anonymous' : donorName,
      donorEmail: isAnonymous ? '' : donorEmail,
      message,
      isAnonymous,
    });

    // Simulate payment processing (replace with actual integration)
    setTimeout(() => {
      setIsProcessing(false);
      // Generate mock confirmation data
      onUpdate({
        paymentIntentId: `pi_${Date.now()}`,
        confirmationNumber: `VG${Date.now().toString().slice(-8)}`,
      });
      onNext();
    }, 2000);
  };

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
    <div className="space-y-6">
      {/* Donation Summary Card */}
      <div className="rounded-lg border border-blue-500/30 bg-gradient-to-br from-blue-900/30 to-purple-900/30 p-5">
        <h3 className="mb-3 font-semibold text-white">Donation Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Supporting:</span>
            <span className="font-medium text-white">
              {formData.campaignName || 'General Support'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Amount:</span>
            <span className="font-medium text-white">
              {formData.amount ? formatCurrency(formData.amount) : '$0.00'}
            </span>
          </div>
          {formData.isRecurring && (
            <div className="flex justify-between">
              <span className="text-gray-400">Frequency:</span>
              <span className="font-medium text-blue-400">Monthly</span>
            </div>
          )}
        </div>
      </div>

      {/* Payment Method Selection */}
      <div>
        <label className="mb-3 block text-sm font-medium text-gray-300">
          Payment Method <span className="text-red-400">*</span>
        </label>
        <div className="space-y-3">
          {PAYMENT_PROCESSORS.map(processor => {
            const Icon = processor.icon;
            const isSelected = selectedProcessor === processor.id;

            return (
              <button
                key={processor.id}
                onClick={() => handleProcessorSelect(processor.id)}
                className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-900/30'
                    : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                } `}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${isSelected ? 'bg-blue-600/30' : 'bg-gray-700/50'} `}
                  >
                    <Icon className={`h-5 w-5 ${isSelected ? 'text-blue-400' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">{processor.name}</p>
                    <p className="text-xs text-gray-400">{processor.description}</p>
                  </div>
                  {isSelected && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500">
                      <div className="h-2 w-2 rounded-full bg-white" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {errors.processor && (
          <p className="mt-2 flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4" />
            {errors.processor}
          </p>
        )}
      </div>

      {/* Anonymous Toggle */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-1 items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-700/50">
              {isAnonymous ? (
                <EyeOff className="h-5 w-5 text-gray-400" />
              ) : (
                <Eye className="h-5 w-5 text-gray-400" />
              )}
            </div>
            <div>
              <h4 className="mb-1 font-semibold text-white">Donate Anonymously</h4>
              <p className="text-sm text-gray-400">
                Your name won't appear in public donation lists
              </p>
            </div>
          </div>
          <button
            onClick={handleAnonymousToggle}
            className={`relative h-7 w-14 flex-shrink-0 rounded-full transition-colors ${isAnonymous ? 'bg-blue-600' : 'bg-gray-600'} `}
          >
            <div
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${isAnonymous ? 'translate-x-7' : 'translate-x-0.5'} `}
            />
          </button>
        </div>
      </div>

      {/* Donor Information */}
      {!isAnonymous && (
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Your Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={donorName}
              onChange={e => {
                setDonorName(e.target.value);
                onUpdate({ donorName: e.target.value });
                setErrors(prev => ({ ...prev, donorName: '' }));
              }}
              placeholder="Enter your name"
              className={`w-full rounded-lg border bg-gray-800 px-4 py-3 text-white transition-colors focus:outline-none ${errors.donorName ? 'border-red-500' : 'border-gray-700 focus:border-blue-500'} `}
            />
            {errors.donorName && (
              <p className="mt-1 flex items-center gap-2 text-sm text-red-400">
                <AlertCircle className="h-4 w-4" />
                {errors.donorName}
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Email Address <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={donorEmail}
              onChange={e => {
                setDonorEmail(e.target.value);
                onUpdate({ donorEmail: e.target.value });
                setErrors(prev => ({ ...prev, donorEmail: '' }));
              }}
              placeholder="you@example.com"
              className={`w-full rounded-lg border bg-gray-800 px-4 py-3 text-white transition-colors focus:outline-none ${errors.donorEmail ? 'border-red-500' : 'border-gray-700 focus:border-blue-500'} `}
            />
            {errors.donorEmail && (
              <p className="mt-1 flex items-center gap-2 text-sm text-red-400">
                <AlertCircle className="h-4 w-4" />
                {errors.donorEmail}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              For your receipt. We'll never share your email.
            </p>
          </div>
        </div>
      )}

      {/* Optional Message */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-300">Message (Optional)</label>
        <textarea
          value={message}
          onChange={e => {
            setMessage(e.target.value);
            onUpdate({ message: e.target.value });
          }}
          placeholder="Leave a message of support..."
          rows={3}
          maxLength={500}
          className="w-full resize-none rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white transition-colors focus:border-blue-500 focus:outline-none"
        />
        <p className="mt-1 text-right text-xs text-gray-500">{message.length}/500</p>
      </div>

      {/* Security Badge */}
      <div className="flex items-center justify-center gap-3 text-xs text-gray-400">
        <Lock className="h-4 w-4" />
        <span>Secure payment</span>
        <span>•</span>
        <Shield className="h-4 w-4" />
        <span>Your data is protected</span>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 border-t border-gray-700 pt-4">
        <button
          onClick={onBack}
          disabled={isProcessing}
          className="flex-1 rounded-lg bg-gray-700 px-6 py-3 font-semibold text-white transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ← Back
        </button>
        <button
          onClick={handleCompleteDonation}
          disabled={isProcessing}
          className="flex-1 rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isProcessing
            ? 'Processing...'
            : `Complete ${formData.amount ? formatCurrency(formData.amount) : ''} Donation`}
        </button>
      </div>
    </div>
  );
}
