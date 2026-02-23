'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export function Footer() {
  const { user } = useAuth();

  return (
    <footer className="mt-auto border-t border-gray-800 bg-gray-900">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Company Info */}
          <div>
            <h3 className="mb-3 font-semibold text-white">Veritable Games</h3>
            <p className="text-sm text-gray-400">
              For all in love and justice. Works against the discriminating man.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="mb-3 font-semibold text-white">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/about"
                  className="text-sm text-gray-400 transition-colors hover:text-white"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/projects"
                  className="text-sm text-gray-400 transition-colors hover:text-white"
                >
                  Projects
                </Link>
              </li>
              <li>
                <Link
                  href="/news"
                  className="text-sm text-gray-400 transition-colors hover:text-white"
                >
                  News
                </Link>
              </li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h3 className="mb-3 font-semibold text-white">Community</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/forums"
                  className="text-sm text-gray-400 transition-colors hover:text-white"
                >
                  Forums
                </Link>
              </li>
              <li>
                <Link
                  href="/wiki"
                  className="text-sm text-gray-400 transition-colors hover:text-white"
                >
                  Wiki
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-sm text-gray-400 transition-colors hover:text-white"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Admin Section */}
          <div>
            <h3 className="mb-3 font-semibold text-white">Resources</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-gray-400 transition-colors hover:text-white"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-sm text-gray-400 transition-colors hover:text-white"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-800 pt-6">
          <p className="text-center text-sm text-gray-500">
            © 2025 Veritable Games. All rights reserved.
          </p>
          {process.env.NEXT_PUBLIC_BUILD_COMMIT && (
            <p className="mt-2 text-center text-xs text-gray-600">
              Build {process.env.NEXT_PUBLIC_BUILD_COMMIT}
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
