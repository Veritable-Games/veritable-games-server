'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'How are donations used?',
    answer:
      'All donations directly fund game development, infrastructure, and community initiatives. We maintain complete transparency through our dashboard, showing exactly where every dollar goes. Funds are allocated to active campaigns you choose to support, or distributed across all projects if you select general support.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept credit/debit cards via Stripe (Visa, Mastercard, American Express, Discover) and cryptocurrency payments through BTCPay Server. All transactions are encrypted and secure. We never store your payment information.',
  },
  {
    question: 'Is my payment secure?',
    answer:
      'Yes. All credit card payments are processed through Stripe, a PCI DSS Level 1 certified payment processor used by millions of businesses worldwide. Cryptocurrency payments use BTCPay Server with self-hosted security. Your payment information is encrypted end-to-end and never stored on our servers.',
  },
  {
    question: 'Can I get a receipt?',
    answer:
      "Yes. If you provide an email address during checkout, you'll automatically receive a receipt for your donation. You can also view your donation history and download receipts anytime from your account dashboard.",
  },
  {
    question: 'Can I choose where my donation goes?',
    answer:
      'Absolutely! You can support specific campaigns (like Infrastructure, Development, or Art Assets) or choose "General Support" to help fund all active projects. Campaign-specific donations are tracked separately and used exclusively for that purpose.',
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-8">
      <h2 className="mb-6 text-2xl font-bold text-white">Frequently Asked Questions</h2>

      <div className="space-y-3">
        {FAQ_ITEMS.map((item, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-lg border border-gray-700 bg-gray-800/50"
          >
            <button
              onClick={() => toggleFAQ(index)}
              className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-gray-700/30"
            >
              <span className="pr-4 font-medium text-white">{item.question}</span>
              {openIndex === index ? (
                <ChevronUp className="h-5 w-5 flex-shrink-0 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 flex-shrink-0 text-gray-400" />
              )}
            </button>

            {openIndex === index && (
              <div className="px-5 pb-5 leading-relaxed text-gray-400">{item.answer}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
