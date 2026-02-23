import React from 'react';
import Link from 'next/link';
import { Navigation } from '../nav/Navigation';
import { MaintenanceBanner } from '../MaintenanceBanner';

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  // Static year - no hydration issues
  const currentYear = 2025;

  return (
    <div className="relative flex h-screen flex-col">
      {/* Navigation Bar */}
      <header role="banner" className="relative z-50 shrink-0">
        <nav
          id="main-navigation"
          className="border-b border-neutral-800/50 bg-neutral-900/90 backdrop-blur-sm"
          aria-label="Main navigation"
        >
          <Navigation />
        </nav>
      </header>

      {/* Maintenance Mode Banner (only visible to admins) */}
      <MaintenanceBanner />

      {/* Main Content Area - Scrollable between header and footer */}
      <main
        id="main-content"
        className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block"
        role="main"
        aria-label="Main content"
        tabIndex={-1}
      >
        {children}
      </main>

      {/* Footer - Always rendered, no hydration concerns */}
      <footer
        id="footer"
        className="relative shrink-0 bg-neutral-900/90 backdrop-blur-sm"
        role="contentinfo"
        aria-label="Site footer"
      >
        <div className="w-full px-8 py-3 lg:px-12">
          <div className="text-center">
            <p className="mb-1 text-xs text-neutral-600 dark:text-neutral-400">
              © {currentYear} Veritable Games. All rights reserved.
            </p>
            <nav aria-label="Footer navigation">
              <ul className="flex items-center justify-center space-x-2 text-[10px]">
                <li>
                  <Link
                    href="/contact"
                    className="flex min-h-[24px] items-center px-1 py-0.5 text-neutral-600 outline-none transition-colors hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-400"
                  >
                    Contact Us
                  </Link>
                </li>
                <li aria-hidden="true" className="text-neutral-400 dark:text-neutral-500">
                  •
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="flex min-h-[24px] items-center px-1 py-0.5 text-neutral-600 outline-none transition-colors hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-400"
                  >
                    Terms
                  </Link>
                </li>
                <li aria-hidden="true" className="text-neutral-400 dark:text-neutral-500">
                  •
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="flex min-h-[24px] items-center px-1 py-0.5 text-neutral-600 outline-none transition-colors hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-400"
                  >
                    Privacy
                  </Link>
                </li>
                <li aria-hidden="true" className="text-neutral-400 dark:text-neutral-500">
                  •
                </li>
                <li>
                  <Link
                    href="/cookies"
                    className="flex min-h-[24px] items-center px-1 py-0.5 text-neutral-600 outline-none transition-colors hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-400"
                  >
                    Cookies
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;
