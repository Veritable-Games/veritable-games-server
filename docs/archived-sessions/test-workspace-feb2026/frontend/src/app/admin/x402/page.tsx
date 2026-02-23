import { Suspense } from 'react';
import X402DashboardClient from './X402DashboardClient';

export const metadata = {
  title: 'x402 Payment Dashboard | Veritable Games Admin',
  description: 'Monitor and manage x402 bot monetization payments',
};

function LoadingFallback() {
  return (
    <div className="animate-pulse">
      <div className="mb-8 h-10 w-64 rounded bg-neutral-800" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-lg bg-neutral-800" />
        ))}
      </div>
      <div className="mt-8 h-64 rounded-lg bg-neutral-800" />
    </div>
  );
}

export default function X402DashboardPage() {
  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold text-white">x402 Payment Dashboard</h1>
      <p className="mb-8 text-neutral-400">
        Monitor bot monetization via the x402 payment protocol
      </p>

      <Suspense fallback={<LoadingFallback />}>
        <X402DashboardClient />
      </Suspense>
    </div>
  );
}
