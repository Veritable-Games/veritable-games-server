'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface DonateNavigationProps {
  isAdmin: boolean;
  isAuthenticated: boolean;
}

export function DonateNavigation({ isAdmin, isAuthenticated }: DonateNavigationProps) {
  const pathname = usePathname();

  // Exact match for /donate, otherwise use startsWith for sub-routes
  const isActive = (path: string) => {
    if (path === '/donate') {
      return pathname === '/donate';
    }
    return pathname === path;
  };

  return (
    <nav className="border-b border-neutral-800 bg-neutral-900/50">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Public Tabs (always visible) */}
          <Link
            href="/donate"
            className={`whitespace-nowrap border-b-2 px-4 py-4 text-sm font-medium transition-colors ${
              isActive('/donate')
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Donate
          </Link>

          <Link
            href="/donate/campaigns"
            className={`whitespace-nowrap border-b-2 px-4 py-4 text-sm font-medium transition-colors ${
              isActive('/donate/campaigns')
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Campaigns
          </Link>

          <Link
            href="/donate/transparency"
            className={`whitespace-nowrap border-b-2 px-4 py-4 text-sm font-medium transition-colors ${
              isActive('/donate/transparency')
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Transparency
          </Link>
        </div>
      </div>
    </nav>
  );
}
