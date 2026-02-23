'use client';

/**
 * Text Node Warning Badge Component
 *
 * Displays warning indicator when sticky note text becomes too small.
 * Implements 3-tier warning system (info/warning/critical) with accessibility.
 */

import { useMemo } from 'react';
import type { WarningState } from '@/lib/workspace/warning-thresholds';
import { CHARACTER_LIMITS } from '@/lib/workspace/warning-thresholds';

interface TextNodeWarningBadgeProps {
  /** Warning state information */
  warningState: WarningState;
  /** Whether node is in edit mode */
  isEditing: boolean;
  /** Current canvas zoom level */
  scale: number;
  /** Whether badge should be visible */
  visible: boolean;
  /** Node ID for unique ARIA IDs */
  nodeId: string;
}

/**
 * Warning badge with 3-tier visual states
 */
export default function TextNodeWarningBadge({
  warningState,
  isEditing,
  scale,
  visible,
  nodeId,
}: TextNodeWarningBadgeProps) {
  // Don't render if warning level is 'none' or not visible
  if (warningState.level === 'none' || !visible) {
    return null;
  }

  // Calculate badge scale (responsive to canvas zoom, but not too small/large)
  const badgeScale = Math.max(0.8, Math.min(1.2, 1 / scale));

  // Visual properties for each warning level
  const visualProps = useMemo(() => {
    switch (warningState.level) {
      case 'info':
        return {
          bgColor: 'bg-blue-500',
          textColor: 'text-white',
          borderColor: 'border-blue-600',
          icon: '●', // Simple dot for info
          ariaLabel: 'Information',
        };
      case 'warning':
        return {
          bgColor: 'bg-amber-500',
          textColor: 'text-white',
          borderColor: 'border-amber-600',
          icon: '!', // Exclamation mark for warning
          ariaLabel: 'Warning',
        };
      case 'critical':
        return {
          bgColor: 'bg-red-500',
          textColor: 'text-white',
          borderColor: 'border-red-600',
          icon: '⚠', // Warning triangle for critical
          ariaLabel: 'Critical',
        };
      default:
        return {
          bgColor: 'bg-gray-500',
          textColor: 'text-white',
          borderColor: 'border-gray-600',
          icon: '',
          ariaLabel: '',
        };
    }
  }, [warningState.level]);

  // Generate unique ID for ARIA association
  const badgeId = `warning-${nodeId}`;

  // Format character count message
  const charCountDisplay = warningState.showCharCount
    ? `${warningState.charCount}/${CHARACTER_LIMITS.SOFT}`
    : null;

  // Build full accessible message
  const accessibleMessage = `${visualProps.ariaLabel}: ${warningState.message}. Font size: ${Math.round(warningState.fontSize)}px.${charCountDisplay ? ` ${charCountDisplay} characters.` : ''}`;

  return (
    <div
      id={badgeId}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`absolute flex items-center gap-1 ${visualProps.bgColor} ${visualProps.textColor} rounded border px-1.5 py-0.5 ${visualProps.borderColor} pointer-events-auto select-none shadow-sm transition-opacity duration-150`}
      style={{
        top: '-10px',
        right: '-10px',
        fontSize: `${11 * badgeScale}px`,
        transform: `scale(${badgeScale})`,
        transformOrigin: 'top right',
        opacity: isEditing ? 1.0 : 0.7, // Dimmer in view mode
        zIndex: 1000, // Above node, below toolbar
      }}
      title={accessibleMessage} // Tooltip on hover
    >
      {/* Icon (decorative) */}
      <span aria-hidden="true" className="font-bold" style={{ fontSize: '12px' }}>
        {visualProps.icon}
      </span>

      {/* Character count (if applicable) */}
      {warningState.showCharCount && (
        <span className="whitespace-nowrap text-xs font-medium">{charCountDisplay}</span>
      )}

      {/* Screen reader only: Full message */}
      <span className="sr-only">{accessibleMessage}</span>
    </div>
  );
}
