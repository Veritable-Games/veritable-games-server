'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export function ClientNavigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { name: 'Home', href: '/' },
    { name: 'About', href: '/about' },
    { name: 'Projects', href: '/projects' },
    { name: 'Forums', href: '/forums' },
    { name: 'Library', href: '/library' },
    { name: 'Wiki', href: '/wiki' },
    { name: 'News', href: '/news' },
  ];

  const isActive = (path: string) => (path === '/' ? pathname === '/' : pathname?.startsWith(path));

  return (
    <nav className="relative z-50 transition-colors duration-300">
      <div className="w-full px-8 lg:px-12">
        <div className="flex h-16 items-center justify-between">
          {/* Logo/Brand - Positioned on the left */}
          <div className="flex-shrink-0">
            <Link
              href="/"
              className="flex items-center space-x-3 transition-opacity hover:opacity-90"
              aria-label="Veritable Games home page"
            >
              <Image
                src="/logoWhiteIcon_soft.png"
                alt=""
                width={132}
                height={132}
                className="h-12 w-12 flex-shrink-0"
                aria-hidden="true"
              />
              <Image
                src="/logo_text_white_horizontal_smooth.png"
                alt="Veritable Games"
                width={450}
                height={72}
                className="h-8 w-auto flex-shrink-0"
                priority
              />
            </Link>
          </div>

          {/* Desktop Navigation - Positioned on the right */}
          <div className="hidden items-center space-x-1 lg:flex" role="navigation">
            <ul className="flex items-center space-x-1">
              {navItems.map(item => {
                const baseClasses = isActive(item.href) ? 'text-blue-400' : 'text-neutral-400';

                const hoverClasses = 'hover:text-blue-400';

                const className = `${baseClasses} ${hoverClasses} transition-colors duration-200 font-medium whitespace-nowrap px-2 py-1 min-h-[44px] flex items-center`;

                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={className}
                      aria-current={isActive(item.href) ? 'page' : undefined}
                      suppressHydrationWarning
                    >
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center p-2 text-neutral-400 hover:text-white"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={isMobileMenuOpen ? 'Close main menu' : 'Open main menu'}
            >
              {/* Hamburger Icon */}
              <svg
                className="h-6 w-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                {isMobileMenuOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="border-b border-neutral-800/50 bg-neutral-900 lg:hidden" id="mobile-menu">
            <nav aria-label="Mobile navigation">
              <ul className="space-y-1 px-2 pb-3 pt-2">
                {navItems.map(item => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`${
                        isActive(item.href) ? 'bg-blue-900 text-blue-400' : 'text-neutral-400'
                      } block flex min-h-[44px] items-center rounded-md px-3 py-2 text-base font-medium hover:bg-neutral-800`}
                      onClick={() => setIsMobileMenuOpen(false)}
                      aria-current={isActive(item.href) ? 'page' : undefined}
                      suppressHydrationWarning
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        )}
      </div>
    </nav>
  );
}
