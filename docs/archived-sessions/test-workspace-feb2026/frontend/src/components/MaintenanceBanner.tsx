'use client';

import { useEffect, useState } from 'react';

/**
 * Maintenance Mode Banner
 *
 * Shows a banner at the top of the page when:
 * 1. Site is in maintenance mode (database setting)
 * 2. Current user is an admin
 *
 * This alerts admins that they have special access while the site
 * is locked down for other users.
 */
export function MaintenanceBanner() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if maintenance mode is enabled AND user is admin
    const checkMaintenanceStatus = async () => {
      try {
        // First check if maintenance mode is actually enabled
        const maintenanceResponse = await fetch('/api/settings/maintenance');
        if (!maintenanceResponse.ok) {
          setLoading(false);
          return;
        }

        const maintenanceData = await maintenanceResponse.json();

        // If maintenance mode is not enabled, don't show banner
        if (!maintenanceData.success || !maintenanceData.data?.enabled) {
          setLoading(false);
          return;
        }

        // Check for auth indicator cookie to avoid 401s
        const hasAuthCookie = document.cookie
          .split(';')
          .some(
            cookie =>
              cookie.trim().startsWith('has_auth=') ||
              cookie.trim().startsWith('__Secure-has_auth=')
          );

        if (!hasAuthCookie) {
          // No auth - skip banner check
          setLoading(false);
          return;
        }

        // User is authenticated - check if admin
        const sessionResponse = await fetch('/api/auth/session');

        if (!sessionResponse.ok) {
          setLoading(false);
          return;
        }

        // Check content-type before parsing as JSON
        const contentType = sessionResponse.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          setLoading(false);
          return;
        }

        const sessionData = await sessionResponse.json();

        // Show banner only if user is admin AND maintenance mode is enabled
        if (sessionData.user?.role === 'admin') {
          setShow(true);
        }

        setLoading(false);
      } catch (error) {
        // Silently fail - banner just won't show
        setLoading(false);
      }
    };

    checkMaintenanceStatus();
  }, []);

  // Don't render anything while loading or if shouldn't show
  if (loading || !show) {
    return null;
  }

  return (
    <div className="relative z-40 bg-yellow-500 px-4 py-2 text-center font-semibold text-yellow-900 shadow-md">
      <div className="flex items-center justify-center gap-2">
        <span className="text-lg">⚠️</span>
        <span>Site in Maintenance Mode - You have admin access</span>
        <span className="text-lg">⚠️</span>
      </div>
    </div>
  );
}
