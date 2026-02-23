/**
 * Donation Success Page
 * Shown after completing BTCPay checkout
 */

import Link from 'next/link';

export default function DonationSuccessPage() {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-8">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border border-green-800 bg-green-900/30">
          <svg
            className="h-8 w-8 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mb-2 text-3xl font-bold text-white">Thank You!</h1>
        <p className="text-gray-400">Your donation is being processed.</p>
      </div>

      <div className="mb-8 rounded-lg border border-gray-700 bg-gray-800/50 p-6">
        <h2 className="mb-3 font-semibold text-white">What happens next?</h2>
        <ul className="mx-auto max-w-md space-y-3 text-left text-sm text-gray-400">
          <li className="flex items-start">
            <span className="mr-2 text-blue-500">•</span>
            <span>Your payment is being confirmed on the blockchain</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-blue-500">•</span>
            <span>You'll receive a confirmation once it's settled</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-blue-500">•</span>
            <span>
              Your donation will appear in our{' '}
              <Link
                href="/donate/transparency"
                className="text-blue-400 underline hover:text-blue-300"
              >
                transparency dashboard
              </Link>
            </span>
          </li>
        </ul>
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        <Link
          href="/"
          className="inline-block rounded-md bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700"
        >
          Return Home
        </Link>
        <Link
          href="/donate/transparency"
          className="inline-block rounded-md border border-blue-600 bg-blue-900/30 px-6 py-2 text-blue-400 transition-colors hover:bg-blue-900/50"
        >
          View Transparency
        </Link>
        <Link
          href="/donate"
          className="inline-block rounded-md border border-gray-600 bg-gray-800 px-6 py-2 text-gray-300 transition-colors hover:bg-gray-700"
        >
          Make Another Donation
        </Link>
      </div>
    </div>
  );
}
