'use client';

import { Target, CreditCard, BarChart3 } from 'lucide-react';

export default function HowItWorks() {
  return (
    <section className="rounded-lg bg-gray-800/30 py-12">
      <h2 className="mb-8 text-center text-2xl font-bold text-white">How It Works</h2>

      <div className="grid grid-cols-1 gap-8 px-6 md:grid-cols-3">
        {/* Step 1 */}
        <div className="text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border-2 border-blue-500 bg-blue-600/20">
            <Target className="h-8 w-8 text-blue-400" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">Choose a Campaign</h3>
          <p className="text-sm text-gray-400">
            Support specific projects or contribute to all development efforts. Your choice.
          </p>
        </div>

        {/* Step 2 */}
        <div className="text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border-2 border-green-500 bg-green-600/20">
            <CreditCard className="h-8 w-8 text-green-400" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">Donate Securely</h3>
          <p className="text-sm text-gray-400">
            Pay with credit card via Stripe or use cryptocurrency. All transactions are encrypted
            and secure.
          </p>
        </div>

        {/* Step 3 */}
        <div className="text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border-2 border-purple-500 bg-purple-600/20">
            <BarChart3 className="h-8 w-8 text-purple-400" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">Track Impact</h3>
          <p className="text-sm text-gray-400">
            See exactly how your funds are used with our transparent expense tracking and project
            updates.
          </p>
        </div>
      </div>
    </section>
  );
}
