'use client';

import { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import type {
  FundingGoalWithProgress,
  PaymentProcessor,
  GoalId,
  ProjectId,
} from '@/lib/donations/types';

// Step components
import Step1ChooseCampaign from './Step1ChooseCampaign';
import Step2SelectAmount from './Step2SelectAmount';
import Step3PaymentDetails from './Step3PaymentDetails';
import Step4Confirmation from './Step4Confirmation';
import StepIndicator from './StepIndicator';

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaigns: FundingGoalWithProgress[];

  // Pre-selected values (optional)
  initialCampaignId?: number | null;
  initialAmount?: number | 'custom' | null;
}

export type DonationStep = 1 | 2 | 3 | 4;

export interface DonationFormData {
  // Step 1: Campaign Selection
  selectedCampaignId: number | null; // NULL = general support
  campaignName: string | null;

  // Step 2: Amount Selection
  amount: number | null;
  isCustomAmount: boolean;
  isRecurring: boolean;

  // Step 3: Payment Details
  paymentProcessor: PaymentProcessor | null;
  donorName: string;
  donorEmail: string;
  isAnonymous: boolean;
  message: string;

  // Step 4: Confirmation Data
  paymentIntentId?: string;
  confirmationNumber?: string;
}

const STEP_TITLES = {
  1: 'Choose Campaign',
  2: 'Select Amount',
  3: 'Payment Details',
  4: 'Confirmation',
};

export default function DonationModal({
  isOpen,
  onClose,
  campaigns,
  initialCampaignId = null,
  initialAmount = null,
}: DonationModalProps) {
  const [currentStep, setCurrentStep] = useState<DonationStep>(1);
  const [formData, setFormData] = useState<DonationFormData>({
    selectedCampaignId: initialCampaignId,
    campaignName: null,
    amount: typeof initialAmount === 'number' ? initialAmount : null,
    isCustomAmount: initialAmount === 'custom',
    isRecurring: false,
    paymentProcessor: null,
    donorName: '',
    donorEmail: '',
    isAnonymous: false,
    message: '',
  });

  // Reset modal state when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setFormData({
        selectedCampaignId: initialCampaignId,
        campaignName: null,
        amount: typeof initialAmount === 'number' ? initialAmount : null,
        isCustomAmount: initialAmount === 'custom',
        isRecurring: false,
        paymentProcessor: null,
        donorName: '',
        donorEmail: '',
        isAnonymous: false,
        message: '',
      });
    }
  }, [isOpen, initialCampaignId, initialAmount]);

  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    // Don't allow closing during payment processing (step 3 when processing)
    if (currentStep === 3 && formData.paymentIntentId) {
      const confirmClose = window.confirm(
        'Payment is being processed. Are you sure you want to close?'
      );
      if (!confirmClose) return;
    }
    onClose();
  }, [currentStep, formData.paymentIntentId, onClose]);

  const updateFormData = useCallback((updates: Partial<DonationFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const goToNextStep = useCallback(() => {
    if (currentStep < 4) {
      setCurrentStep(prev => (prev + 1) as DonationStep);
    }
  }, [currentStep]);

  const goToPreviousStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(prev => (prev - 1) as DonationStep);
    }
  }, [currentStep]);

  const goToStep = useCallback(
    (step: DonationStep) => {
      // Only allow navigating to previous steps (not forward)
      if (step <= currentStep && step >= 1 && step <= 4) {
        setCurrentStep(step);
      }
    },
    [currentStep]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4"
      onClick={e => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-gray-700 bg-gray-900"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 p-6">
          <div>
            <h2 className="text-2xl font-bold text-white">{STEP_TITLES[currentStep]}</h2>
            <p className="mt-1 text-sm text-gray-400">Step {currentStep} of 4</p>
          </div>
          <button
            onClick={handleClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 pt-4">
          <StepIndicator currentStep={currentStep} totalSteps={4} onStepClick={goToStep} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentStep === 1 && (
            <Step1ChooseCampaign
              campaigns={campaigns}
              formData={formData}
              onUpdate={updateFormData}
              onNext={goToNextStep}
            />
          )}

          {currentStep === 2 && (
            <Step2SelectAmount
              formData={formData}
              onUpdate={updateFormData}
              onNext={goToNextStep}
              onBack={goToPreviousStep}
            />
          )}

          {currentStep === 3 && (
            <Step3PaymentDetails
              formData={formData}
              onUpdate={updateFormData}
              onNext={goToNextStep}
              onBack={goToPreviousStep}
            />
          )}

          {currentStep === 4 && <Step4Confirmation formData={formData} onClose={handleClose} />}
        </div>

        {/* Debug Info (Remove in production) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="border-t border-gray-700 bg-gray-800 p-4 font-mono text-xs text-gray-400">
            <div>Campaign ID: {formData.selectedCampaignId || 'General Support'}</div>
            <div>Amount: ${formData.amount || 0}</div>
            <div>Processor: {formData.paymentProcessor || 'Not selected'}</div>
            <div>Recurring: {formData.isRecurring ? 'Yes' : 'No'}</div>
          </div>
        )}
      </div>
    </div>
  );
}
