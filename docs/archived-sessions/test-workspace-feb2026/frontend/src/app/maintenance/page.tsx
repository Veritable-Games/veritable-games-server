'use client';

import { useEffect, useState } from 'react';

export default function MaintenancePage() {
  const [message, setMessage] = useState(
    "We're currently performing scheduled maintenance to improve your experience. We'll be back online shortly."
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMaintenanceMessage = async () => {
      try {
        const response = await fetch('/api/settings/maintenance');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.message) {
            setMessage(data.data.message);
          }
        }
      } catch (error) {
        // Use default message on error
      } finally {
        setLoading(false);
      }
    };

    fetchMaintenanceMessage();
  }, []);

  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mb-6">
          <svg
            className="mx-auto h-24 w-24 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>

        <h1 className="mb-4 text-3xl font-bold text-white">Site Under Maintenance</h1>

        <p className={`mb-8 text-gray-400 ${loading ? 'animate-pulse' : ''}`}>{message}</p>

        <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
          <p className="text-sm text-gray-500">
            If you're an administrator, you can still access the site.
          </p>
        </div>
      </div>
    </div>
  );
}
