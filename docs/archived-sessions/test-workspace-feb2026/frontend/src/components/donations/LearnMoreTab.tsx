'use client';

/**
 * Learn More Tab - FAQ and Information
 * Educational content about donations
 */

import { useState } from 'react';
import { ChevronDown, Shield, CreditCard, Bitcoin, HelpCircle } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

interface LearnMoreTabProps {
  onDonateClick: () => void;
}

export function LearnMoreTab({ onDonateClick }: LearnMoreTabProps) {
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(0);

  const faqs: FAQItem[] = [
    {
      question: 'How are donations used?',
      answer:
        'All donations directly support Veritable Games projects. We maintain full transparency with detailed expense breakdowns available in the Transparency tab. Funds go toward development, infrastructure, asset creation, and community initiatives.',
    },
    {
      question: 'Can I designate my donation to a specific project?',
      answer:
        'Yes! When making a donation, you can select which project to support. Your contribution will be allocated specifically to that project. You can also make a general donation that supports all projects.',
    },
    {
      question: 'What payment methods do you accept?',
      answer:
        'We accept credit/debit cards via Stripe (minimum $0.50) and cryptocurrency payments via BTCPay Server including Bitcoin and Lightning Network (minimum $0.01). Both payment processors use industry-standard security.',
    },
    {
      question: 'Is my payment information secure?',
      answer:
        'Absolutely. We never store your payment information on our servers. All transactions are processed securely through Stripe or BTCPay Server. Card payments are PCI DSS compliant, and crypto payments are processed directly on the blockchain.',
    },
    {
      question: 'Can I make a recurring donation?',
      answer:
        'Currently, we support one-time donations. Recurring donation functionality is planned for a future update. You can make multiple donations at any time.',
    },
    {
      question: 'Do I need to provide my name and email?',
      answer:
        'No, all donor information is optional. You can donate anonymously if you prefer. Providing your email allows us to send you a receipt and updates about the project you supported.',
    },
    {
      question: 'How can I see how my donation is being used?',
      answer:
        'Check the Transparency tab to see real-time financial data including total funds raised, expense breakdowns by category, and progress on active funding goals. We update this information regularly.',
    },
  ];

  const toggleFAQ = (index: number) => {
    setExpandedFAQ(expandedFAQ === index ? null : index);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="mb-2 text-2xl font-bold text-white">About Donations</h2>
        <p className="text-gray-400">
          Learn about how donations work, security measures, and how we use your contributions to
          build the community.
        </p>
      </div>

      {/* How Donations Are Used */}
      <section className="rounded-lg border border-gray-700 bg-gray-800/50 p-6">
        <h3 className="mb-4 text-xl font-semibold text-white">How We Use Your Donations</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 rounded-lg bg-blue-600/20 p-2">
              <svg
                className="h-5 w-5 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <div>
              <h4 className="mb-1 font-semibold text-white">Development</h4>
              <p className="text-sm text-gray-400">
                Funding for game development, features, bug fixes, and technical improvements
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 rounded-lg bg-purple-600/20 p-2">
              <svg
                className="h-5 w-5 text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                />
              </svg>
            </div>
            <div>
              <h4 className="mb-1 font-semibold text-white">Infrastructure</h4>
              <p className="text-sm text-gray-400">
                Server hosting, database management, CDN costs, and technical infrastructure
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 rounded-lg bg-green-600/20 p-2">
              <svg
                className="h-5 w-5 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h4 className="mb-1 font-semibold text-white">Assets & Content</h4>
              <p className="text-sm text-gray-400">
                Art, music, sound effects, 3D models, and other creative assets
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Payment Security */}
      <section className="rounded-lg border border-gray-700 bg-gray-800/50 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-6 w-6 text-green-400" />
          <h3 className="text-xl font-semibold text-white">Secure Payment Processing</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <CreditCard className="mt-1 h-5 w-5 flex-shrink-0 text-blue-400" />
            <div>
              <h4 className="mb-1 font-semibold text-white">Stripe</h4>
              <p className="text-sm text-gray-400">
                Industry-leading payment processor trusted by millions. PCI DSS compliant with
                end-to-end encryption. Your card details are never stored on our servers.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Bitcoin className="mt-1 h-5 w-5 flex-shrink-0 text-orange-400" />
            <div>
              <h4 className="mb-1 font-semibold text-white">BTCPay Server</h4>
              <p className="text-sm text-gray-400">
                Self-hosted cryptocurrency payment processor. Direct blockchain transactions with no
                intermediaries. Supports Bitcoin on-chain and Lightning Network.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section>
        <h3 className="mb-4 text-xl font-semibold text-white">Frequently Asked Questions</h3>
        <div className="space-y-2">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-lg border border-gray-700 bg-gray-800/50"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-gray-700/50"
              >
                <div className="flex items-center gap-3">
                  <HelpCircle className="h-5 w-5 flex-shrink-0 text-blue-400" />
                  <span className="font-medium text-white">{faq.question}</span>
                </div>
                <ChevronDown
                  className={`h-5 w-5 flex-shrink-0 text-gray-400 transition-transform ${
                    expandedFAQ === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {expandedFAQ === index && (
                <div className="border-t border-gray-700 bg-gray-900/30 p-4">
                  <p className="text-sm leading-relaxed text-gray-300">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="rounded-lg border border-blue-500/30 bg-blue-900/10 p-6 text-center">
        <h3 className="mb-2 text-lg font-semibold text-white">Ready to Support Veritable Games?</h3>
        <p className="mb-4 text-sm text-gray-300">
          Your contribution helps us build amazing gaming experiences for the community.
        </p>
        <button
          onClick={onDonateClick}
          className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700"
        >
          Make a Donation →
        </button>
      </div>
    </div>
  );
}
