'use client';

import { Check } from 'lucide-react';
import type { DonationStep } from './DonationModal';

interface StepIndicatorProps {
  currentStep: DonationStep;
  totalSteps: number;
  onStepClick?: (step: DonationStep) => void;
}

const STEP_LABELS = ['Campaign', 'Amount', 'Payment', 'Done'];

export default function StepIndicator({
  currentStep,
  totalSteps,
  onStepClick,
}: StepIndicatorProps) {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  const getStepStatus = (step: number): 'completed' | 'current' | 'upcoming' => {
    if (step < currentStep) return 'completed';
    if (step === currentStep) return 'current';
    return 'upcoming';
  };

  const isClickable = (step: number): boolean => {
    // Can only navigate to previous steps (not forward)
    return step < currentStep;
  };

  return (
    <div className="relative">
      {/* Progress Bar Background */}
      <div className="absolute left-0 right-0 top-5 h-0.5 bg-gray-700">
        {/* Progress Bar Fill */}
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{
            width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%`,
          }}
        />
      </div>

      {/* Step Circles */}
      <div className="relative flex justify-between">
        {steps.map(step => {
          const status = getStepStatus(step);
          const clickable = isClickable(step);

          return (
            <button
              key={step}
              onClick={() => {
                if (clickable && onStepClick) {
                  onStepClick(step as DonationStep);
                }
              }}
              disabled={!clickable}
              className={`flex flex-col items-center gap-2 ${clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} transition-opacity`}
            >
              {/* Circle */}
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                  status === 'completed'
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : status === 'current'
                      ? 'border-blue-600 bg-blue-600 text-white ring-4 ring-blue-600/30'
                      : 'border-gray-600 bg-gray-800 text-gray-500'
                } `}
              >
                {status === 'completed' ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-bold">{step}</span>
                )}
              </div>

              {/* Label */}
              <span
                className={`text-xs font-medium transition-colors ${
                  status === 'completed' || status === 'current' ? 'text-white' : 'text-gray-500'
                } `}
              >
                {STEP_LABELS[step - 1]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
