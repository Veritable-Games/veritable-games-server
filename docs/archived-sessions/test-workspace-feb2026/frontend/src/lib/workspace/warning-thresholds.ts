/**
 * Warning Thresholds for Sticky Notes
 *
 * Defines thresholds for when to show warnings about text readability.
 * Implements Miro-style soft warnings with progressive disclosure.
 */

/**
 * Font size thresholds for warning levels
 */
export const WARNING_THRESHOLDS = {
  INFO: 14, // Font < 14px: Show info badge (blue)
  WARNING: 12, // Font < 12px: Show warning badge (amber) + character count
  CRITICAL: 10, // Font < 10px: Show critical badge (red) + suggest resize
} as const;

/**
 * Character limits for content
 *
 * NOTE: As of Phase 6 (January 2026), character limits have been removed
 * per user request. SOFT limit increased for counter display, HARD limit
 * set to Infinity (no enforcement).
 */
export const CHARACTER_LIMITS = {
  SOFT: 2000, // Soft limit: Show character count when approaching (for awareness only)
  HARD: Infinity, // No hard limit - users can write unlimited text
  SHOW_COUNTER_THRESHOLD: 1500, // Show counter when chars > this OR font < WARNING
} as const;

/**
 * Warning level types
 */
export type WarningLevel = 'none' | 'info' | 'warning' | 'critical';

/**
 * Warning state information
 */
export interface WarningState {
  level: WarningLevel;
  fontSize: number;
  charCount: number;
  message: string;
  showCharCount: boolean;
}

/**
 * Calculate warning state based on font size and character count
 *
 * @param fontSize - Current calculated font size in pixels
 * @param charCount - Number of characters in content
 * @returns Warning state with level, message, and display flags
 */
export function calculateWarningState(fontSize: number, charCount: number): WarningState {
  // Determine warning level based on font size
  let level: WarningLevel = 'none';
  let message = '';
  let showCharCount = false;

  if (fontSize < WARNING_THRESHOLDS.CRITICAL) {
    level = 'critical';
    message = 'Text is very small. Resize note or remove content.';
    showCharCount = true;
  } else if (fontSize < WARNING_THRESHOLDS.WARNING) {
    level = 'warning';
    message = 'Consider resizing or removing content.';
    showCharCount = true;
  } else if (fontSize < WARNING_THRESHOLDS.INFO) {
    level = 'info';
    message = 'Text is getting small.';
    showCharCount = false; // Don't show counter for info level
  }

  // Also show character count if approaching soft limit (regardless of font size)
  if (charCount > CHARACTER_LIMITS.SHOW_COUNTER_THRESHOLD && level !== 'none') {
    showCharCount = true;
  }

  return {
    level,
    fontSize,
    charCount,
    message,
    showCharCount,
  };
}
