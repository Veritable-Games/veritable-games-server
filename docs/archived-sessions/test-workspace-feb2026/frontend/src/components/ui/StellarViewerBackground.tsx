'use client';

import React from 'react';
import { StellarViewer } from '@/lib/stellar/StellarViewer';

interface StellarViewerBackgroundProps {
  className?: string;
}

export const StellarViewerBackground: React.FC<StellarViewerBackgroundProps> = ({
  className = '',
}) => {
  return <StellarViewer className={className} />;
};

export default StellarViewerBackground;
