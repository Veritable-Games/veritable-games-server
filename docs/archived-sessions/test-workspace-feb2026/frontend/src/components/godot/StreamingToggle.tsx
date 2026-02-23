'use client';

import React, { useState, useEffect } from 'react';

interface StreamingToggleProps {
  versionId: number;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  isConnecting?: boolean;
  connectionError?: string | null;
}

export function StreamingToggle({
  versionId,
  isEnabled,
  onToggle,
  isConnecting = false,
  connectionError = null,
}: StreamingToggleProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleToggle = () => {
    if (!isConnecting) {
      onToggle(!isEnabled);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <button
          onClick={handleToggle}
          disabled={isConnecting}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
            isEnabled
              ? 'bg-green-600 text-white hover:bg-green-500'
              : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
          } ${isConnecting ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'} border border-gray-600`}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          title={isEnabled ? 'Using server rendering' : 'Using client rendering'}
        >
          {isConnecting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Connecting...</span>
            </>
          ) : isEnabled ? (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>Server Rendering</span>
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Client Rendering</span>
            </>
          )}
        </button>

        {showTooltip && (
          <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded border border-gray-600 bg-gray-900 px-3 py-2 text-xs text-white">
            {isEnabled
              ? 'Server renders graph and streams video (low laptop load)'
              : 'Your laptop renders graph (higher load)'}
            <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </div>
        )}
      </div>

      {connectionError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-700 bg-red-900/30 px-3 py-2 text-sm text-red-300">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{connectionError}</span>
        </div>
      )}

      {isEnabled && !connectionError && (
        <div className="flex items-center gap-2 px-2 py-1 text-xs text-green-300">
          <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          <span>Streaming</span>
        </div>
      )}
    </div>
  );
}

export default StreamingToggle;
