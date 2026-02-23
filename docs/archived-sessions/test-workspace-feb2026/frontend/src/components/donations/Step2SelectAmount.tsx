'use client';

import { useState, useEffect } from 'react';
import { DollarSign, RefreshCw, Heart, AlertCircle } from 'lucide-react';
import type { DonationFormData } from './DonationModal';

interface Step2SelectAmountProps {
  formData: DonationFormData;
  onUpdate: (updates: Partial<DonationFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

export default function Step2SelectAmount({
  formData,
  onUpdate,
  onNext,
  onBack,
}: Step2SelectAmountProps) {
  const [selectedPreset, setSelectedPreset] = useState<number | null>(
    formData.amount && !formData.isCustomAmount ? formData.amount : null
  );
  const [customAmount, setCustomAmount] = useState<string>(
    formData.isCustomAmount && formData.amount ? formData.amount.toString() : ''
  );
  const [isCustomMode, setIsCustomMode] = useState(formData.isCustomAmount);
  const [isRecurring, setIsRecurring] = useState(formData.isRecurring);
  const [error, setError] = useState<string | null>(null);

  const handlePresetClick = (amount: number) => {
    setSelectedPreset(amount);
    setCustomAmount('');
    setIsCustomMode(false);
    setError(null);
    onUpdate({
      amount,
      isCustomAmount: false,
    });
  };

  const handleCustomClick = () => {
    setSelectedPreset(null);
    setIsCustomMode(true);
    setError(null);
  };

  const handleCustomAmountChange = (value: string) => {
    // Only allow numbers and decimal point
    const sanitized = value.replace(/[^0-9.]/g, '');

    // Only allow one decimal point
    const parts = sanitized.split('.');
    const finalValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitized;

    setCustomAmount(finalValue);

    // Update form data if valid
    const numericValue = parseFloat(finalValue);
    if (!isNaN(numericValue) && numericValue > 0) {
      setError(null);
      onUpdate({
        amount: numericValue,
        isCustomAmount: true,
      });
    } else if (finalValue !== '' && finalValue !== '.') {
      setError('Please enter a valid amount');
    }
  };

  const handleRecurringToggle = (value: boolean) => {
    setIsRecurring(value);
    onUpdate({ isRecurring: value });
  };

  const handleContinue = () => {
    const amount = isCustomMode ? parseFloat(customAmount) : selectedPreset;

    if (!amount || amount <= 0) {
      setError('Please select or enter an amount');
      return;
    }

    if (amount < 1) {
      setError('Minimum donation is $1');
      return;
    }

    if (amount > 100000) {
      setError('Maximum donation is $100,000');
      return;
    }

    onNext();
  };

  const getCurrentAmount = (): number | null => {
    if (isCustomMode) {
      const num = parseFloat(customAmount);
      return isNaN(num) ? null : num;
    }
    return selectedPreset;
  };

  const formatCurrency = (amount: number) => {
    const numericAmount = Number(amount) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numericAmount);
  };

  const currentAmount = getCurrentAmount();
  const isValid = currentAmount !== null && currentAmount >= 1 && currentAmount <= 100000;

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="text-center">
        <h3 className="mb-2 text-lg font-semibold text-white">How much would you like to give?</h3>
        {formData.campaignName && (
          <p className="text-sm text-gray-400">
            Supporting: <span className="font-medium text-blue-400">{formData.campaignName}</span>
          </p>
        )}
      </div>

      {/* Preset Amounts */}
      <div>
        <label className="mb-3 block text-sm font-medium text-gray-300">Choose an amount</label>
        <div className="grid grid-cols-3 gap-3">
          {PRESET_AMOUNTS.map(amount => (
            <button
              key={amount}
              onClick={() => handlePresetClick(amount)}
              className={`rounded-lg border-2 p-4 font-semibold transition-all ${
                selectedPreset === amount && !isCustomMode
                  ? 'border-blue-500 bg-blue-900/30 text-white'
                  : 'border-gray-700 bg-gray-800/30 text-gray-300 hover:border-gray-600'
              } `}
            >
              ${amount}
            </button>
          ))}
          <button
            onClick={handleCustomClick}
            className={`rounded-lg border-2 p-4 font-semibold transition-all ${
              isCustomMode
                ? 'border-blue-500 bg-blue-900/30 text-white'
                : 'border-gray-700 bg-gray-800/30 text-gray-300 hover:border-gray-600'
            } `}
          >
            Custom
          </button>
        </div>
      </div>

      {/* Custom Amount Input */}
      {isCustomMode && (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-300">
            Enter custom amount
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <DollarSign className="h-5 w-5" />
            </div>
            <input
              type="text"
              value={customAmount}
              onChange={e => handleCustomAmountChange(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 py-3 pl-12 pr-4 text-lg text-white transition-colors focus:border-blue-500 focus:outline-none"
              autoFocus
            />
          </div>
          {error && (
            <p className="mt-2 flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          )}
        </div>
      )}

      {/* Recurring Toggle */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-1 items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600/20">
              <RefreshCw className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h4 className="mb-1 font-semibold text-white">Make this recurring</h4>
              <p className="text-sm text-gray-400">
                Support us every month with an automatic donation. Cancel anytime.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleRecurringToggle(!isRecurring)}
            className={`relative h-7 w-14 flex-shrink-0 rounded-full transition-colors ${isRecurring ? 'bg-blue-600' : 'bg-gray-600'} `}
          >
            <div
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${isRecurring ? 'translate-x-7' : 'translate-x-0.5'} `}
            />
          </button>
        </div>
      </div>

      {/* Impact Preview */}
      {currentAmount && currentAmount >= 1 && (
        <div className="rounded-lg border border-blue-500/30 bg-gradient-to-br from-blue-900/30 to-purple-900/30 p-4">
          <div className="flex items-start gap-3">
            <Heart className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-400" />
            <div>
              <h4 className="mb-1 font-semibold text-white">Your Impact</h4>
              <p className="text-sm text-gray-300">
                {isRecurring ? (
                  <>
                    Your monthly {formatCurrency(currentAmount)} will provide{' '}
                    <span className="font-semibold text-blue-400">
                      {formatCurrency(currentAmount * 12)}/year
                    </span>{' '}
                    in sustainable funding for {formData.campaignName || 'all active projects'}.
                  </>
                ) : (
                  <>
                    Your {formatCurrency(currentAmount)} will directly support{' '}
                    {formData.campaignName || 'all active projects'}, funding development,
                    infrastructure, and community initiatives.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 border-t border-gray-700 pt-4">
        <button
          onClick={onBack}
          className="flex-1 rounded-lg bg-gray-700 px-6 py-3 font-semibold text-white transition-colors hover:bg-gray-600"
        >
          ← Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!isValid}
          className={`flex-1 rounded-lg px-6 py-3 font-semibold transition-colors ${
            isValid
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'cursor-not-allowed bg-gray-700 text-gray-500'
          } `}
        >
          Continue to Payment →
        </button>
      </div>
    </div>
  );
}
