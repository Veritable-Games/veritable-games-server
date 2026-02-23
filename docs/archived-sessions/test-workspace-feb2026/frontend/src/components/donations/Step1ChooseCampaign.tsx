'use client';

import { useState } from 'react';
import { Heart, TrendingUp, AlertCircle } from 'lucide-react';
import type { FundingGoalWithProgress } from '@/lib/donations/types';
import type { DonationFormData } from './DonationModal';

interface Step1ChooseCampaignProps {
  campaigns: FundingGoalWithProgress[];
  formData: DonationFormData;
  onUpdate: (updates: Partial<DonationFormData>) => void;
  onNext: () => void;
}

export default function Step1ChooseCampaign({
  campaigns,
  formData,
  onUpdate,
  onNext,
}: Step1ChooseCampaignProps) {
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(
    formData.selectedCampaignId
  );

  const handleSelectCampaign = (campaignId: number | null, campaignName: string | null) => {
    setSelectedCampaignId(campaignId);
    onUpdate({
      selectedCampaignId: campaignId,
      campaignName: campaignName,
    });
  };

  const handleContinue = () => {
    if (selectedCampaignId !== null || selectedCampaignId === null) {
      onNext();
    }
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

  const activeCampaigns = campaigns.filter(c => c.is_active);

  return (
    <div className="space-y-6">
      {/* Intro Text */}
      <div className="text-center">
        <h3 className="mb-2 text-lg font-semibold text-white">Where should your support go?</h3>
        <p className="text-sm text-gray-400">
          Choose a specific campaign or support all projects equally.
        </p>
      </div>

      {/* General Support Option */}
      <button
        onClick={() => handleSelectCampaign(null, 'General Support')}
        className={`w-full rounded-lg border-2 p-6 text-left transition-all ${
          selectedCampaignId === null
            ? 'border-blue-500 bg-blue-900/30'
            : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
        } `}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600">
            <Heart className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h4 className="mb-1 text-lg font-bold text-white">General Support</h4>
            <p className="text-sm text-gray-400">
              Your donation will be distributed across all active projects based on current needs.
              Maximum flexibility and impact.
            </p>
          </div>
          {selectedCampaignId === null && (
            <div className="flex-shrink-0">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500">
                <div className="h-2 w-2 rounded-full bg-white" />
              </div>
            </div>
          )}
        </div>
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-700" />
        <span className="text-sm text-gray-500">or choose a specific campaign</span>
        <div className="h-px flex-1 bg-gray-700" />
      </div>

      {/* Campaign Options */}
      <div className="space-y-4">
        {activeCampaigns.length === 0 ? (
          <div className="py-8 text-center">
            <AlertCircle className="mx-auto mb-3 h-12 w-12 text-gray-600" />
            <p className="text-gray-500">No active campaigns at this time.</p>
          </div>
        ) : (
          activeCampaigns
            .sort((a, b) => {
              // Sort by urgency
              if (a.days_remaining === null) return 1;
              if (b.days_remaining === null) return -1;
              return a.days_remaining - b.days_remaining;
            })
            .map(campaign => {
              const isSelected = selectedCampaignId === campaign.id;
              const isUrgent = campaign.days_remaining !== null && campaign.days_remaining < 30;

              return (
                <button
                  key={campaign.id}
                  onClick={() => handleSelectCampaign(campaign.id, campaign.title)}
                  className={`w-full rounded-lg border-2 p-5 text-left transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-900/30'
                      : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                  } `}
                >
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <h4 className="text-base font-bold text-white">{campaign.title}</h4>
                    {isSelected && (
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-500">
                        <div className="h-2 w-2 rounded-full bg-white" />
                      </div>
                    )}
                    {!isSelected && isUrgent && (
                      <span className="flex-shrink-0 whitespace-nowrap text-xs font-semibold text-orange-400">
                        {campaign.days_remaining} days left
                      </span>
                    )}
                  </div>

                  <p className="mb-3 text-sm text-gray-400">{campaign.description}</p>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">
                        {formatCurrency(campaign.current_amount)} raised
                      </span>
                      <span className="text-gray-400">
                        {formatCurrency(campaign.target_amount)} goal
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-700">
                      <div
                        className={`h-full transition-all ${
                          isUrgent ? 'bg-orange-500' : 'bg-blue-500'
                        }`}
                        style={{
                          width: `${Math.min(Number(campaign.progress_percentage || 0), 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <TrendingUp className="h-3 w-3" />
                      <span>{Number(campaign.progress_percentage || 0).toFixed(1)}% funded</span>
                      {campaign.is_recurring && (
                        <span className="ml-auto text-blue-400">Recurring</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
        )}
      </div>

      {/* Continue Button */}
      <div className="border-t border-gray-700 pt-4">
        <button
          onClick={handleContinue}
          disabled={selectedCampaignId === undefined}
          className={`w-full rounded-lg px-6 py-3 font-semibold transition-all ${
            selectedCampaignId !== undefined
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'cursor-not-allowed bg-gray-700 text-gray-500'
          } `}
        >
          Continue to Amount →
        </button>
        {selectedCampaignId === undefined && (
          <p className="mt-2 text-center text-xs text-gray-500">
            Please select a campaign or general support
          </p>
        )}
      </div>
    </div>
  );
}
