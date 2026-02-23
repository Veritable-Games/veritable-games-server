'use client';

import React, { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import for Three.js to ensure it only loads on client side
const ThreeJSViewer = dynamic(() => import('./ThreeJSViewer'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-blue-900 via-gray-900 to-black">
      <div className="text-center text-white">
        <div className="mb-2 animate-pulse text-blue-300">◯ Loading Stellar Viewer</div>
        <div className="text-xs opacity-60">Initializing Three.js...</div>
      </div>
    </div>
  ),
});

interface StellarViewerProps {
  className?: string;
}

export const StellarViewer: React.FC<StellarViewerProps> = ({ className = '' }) => {
  return (
    <div className={`fixed inset-0 ${className}`} style={{ zIndex: 1 }}>
      <ThreeJSViewer />
    </div>
  );
};
