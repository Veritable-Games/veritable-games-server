/**
 * Topic Status Bit Flags
 *
 * Efficient storage of multiple topic states using bitwise operations.
 * Each flag is a power of 2, allowing multiple states to coexist.
 *
 * Examples:
 * - Topic that is pinned and solved: 2 | 4 = 6
 * - Topic that is locked, pinned, and solved: 1 | 2 | 4 = 7
 * - Open topic (no flags): 0
 *
 * Maximum 32 flags possible with 32-bit integer.
 */

export const TopicStatusFlags = {
  /**
   * Topic is locked - no new replies allowed
   * Binary: 0001
   */
  LOCKED: 1 << 0, // 1

  /**
   * Topic is pinned - displays at top of category
   * Binary: 0010
   */
  PINNED: 1 << 1, // 2

  /**
   * Topic is solved - has accepted solution
   * Binary: 0100
   */
  SOLVED: 1 << 2, // 4

  /**
   * Topic is archived - read-only, hidden from main view
   * Binary: 1000
   */
  ARCHIVED: 1 << 3, // 8

  /**
   * Topic is deleted (soft delete marker)
   * Binary: 10000
   */
  DELETED: 1 << 4, // 16

  /**
   * Topic is featured - highlighted in listings
   * Binary: 100000
   */
  FEATURED: 1 << 5, // 32
} as const;

export type TopicStatusFlag = (typeof TopicStatusFlags)[keyof typeof TopicStatusFlags];

/**
 * Check if a status has a specific flag set
 *
 * @param status - The status integer (can have multiple flags)
 * @param flag - The flag to check (use TopicStatusFlags constants)
 * @returns true if the flag is set, false otherwise
 *
 * @example
 * const status = 6; // Pinned + Solved
 * hasFlag(status, TopicStatusFlags.PINNED); // true
 * hasFlag(status, TopicStatusFlags.LOCKED); // false
 */
export function hasFlag(status: number, flag: TopicStatusFlag): boolean {
  return (status & flag) !== 0;
}

/**
 * Add a flag to a status
 *
 * @param status - The current status
 * @param flag - The flag to add
 * @returns New status with flag added
 *
 * @example
 * const status = 2; // Pinned only
 * const newStatus = addFlag(status, TopicStatusFlags.SOLVED); // 6 (Pinned + Solved)
 */
export function addFlag(status: number, flag: TopicStatusFlag): number {
  return status | flag;
}

/**
 * Remove a flag from a status
 *
 * @param status - The current status
 * @param flag - The flag to remove
 * @returns New status with flag removed
 *
 * @example
 * const status = 7; // Locked + Pinned + Solved
 * const newStatus = removeFlag(status, TopicStatusFlags.LOCKED); // 6 (Pinned + Solved)
 */
export function removeFlag(status: number, flag: TopicStatusFlag): number {
  return status & ~flag;
}

/**
 * Toggle a flag (add if not present, remove if present)
 *
 * @param status - The current status
 * @param flag - The flag to toggle
 * @returns New status with flag toggled
 *
 * @example
 * const status = 2; // Pinned only
 * const toggled1 = toggleFlag(status, TopicStatusFlags.SOLVED); // 6 (Pinned + Solved)
 * const toggled2 = toggleFlag(toggled1, TopicStatusFlags.SOLVED); // 2 (Pinned only)
 */
export function toggleFlag(status: number, flag: TopicStatusFlag): number {
  return status ^ flag;
}

/**
 * Check if status has ANY of the provided flags
 *
 * @param status - The status to check
 * @param flags - Array of flags to check
 * @returns true if ANY flag is set
 *
 * @example
 * const status = 4; // Solved only
 * hasAnyFlag(status, [TopicStatusFlags.LOCKED, TopicStatusFlags.SOLVED]); // true
 */
export function hasAnyFlag(status: number, flags: TopicStatusFlag[]): boolean {
  return flags.some(flag => hasFlag(status, flag));
}

/**
 * Check if status has ALL of the provided flags
 *
 * @param status - The status to check
 * @param flags - Array of flags to check
 * @returns true if ALL flags are set
 *
 * @example
 * const status = 7; // Locked + Pinned + Solved
 * hasAllFlags(status, [TopicStatusFlags.PINNED, TopicStatusFlags.SOLVED]); // true
 * hasAllFlags(status, [TopicStatusFlags.PINNED, TopicStatusFlags.ARCHIVED]); // false
 */
export function hasAllFlags(status: number, flags: TopicStatusFlag[]): boolean {
  return flags.every(flag => hasFlag(status, flag));
}

/**
 * Get array of all flags set in a status
 *
 * @param status - The status to analyze
 * @returns Array of flag names that are set
 *
 * @example
 * const status = 6; // Pinned + Solved
 * getActiveFlags(status); // ['PINNED', 'SOLVED']
 */
export function getActiveFlags(status: number): string[] {
  const active: string[] = [];

  for (const [key, value] of Object.entries(TopicStatusFlags)) {
    if (hasFlag(status, value)) {
      active.push(key);
    }
  }

  return active;
}

/**
 * Convert old boolean fields to bit flag status
 * Used for database migration
 *
 * @param is_locked - Boolean locked state
 * @param is_pinned - Boolean pinned state
 * @param is_solved - Boolean solved state
 * @returns Status integer with appropriate flags set
 *
 * @example
 * fromBooleans(true, false, true); // 5 (Locked + Solved)
 */
export function fromBooleans(
  is_locked: boolean = false,
  is_pinned: boolean = false,
  is_solved: boolean = false
): number {
  let status = 0;

  if (is_locked) status = addFlag(status, TopicStatusFlags.LOCKED);
  if (is_pinned) status = addFlag(status, TopicStatusFlags.PINNED);
  if (is_solved) status = addFlag(status, TopicStatusFlags.SOLVED);

  return status;
}

/**
 * Convert bit flag status to boolean properties
 * Used for backward compatibility and UI display
 *
 * @param status - Status integer
 * @returns Object with boolean properties
 *
 * @example
 * toBooleans(6); // { is_locked: false, is_pinned: true, is_solved: true }
 */
export function toBooleans(status: number): {
  is_locked: boolean;
  is_pinned: boolean;
  is_solved: boolean;
  is_archived: boolean;
  is_deleted: boolean;
  is_featured: boolean;
} {
  return {
    is_locked: hasFlag(status, TopicStatusFlags.LOCKED),
    is_pinned: hasFlag(status, TopicStatusFlags.PINNED),
    is_solved: hasFlag(status, TopicStatusFlags.SOLVED),
    is_archived: hasFlag(status, TopicStatusFlags.ARCHIVED),
    is_deleted: hasFlag(status, TopicStatusFlags.DELETED),
    is_featured: hasFlag(status, TopicStatusFlags.FEATURED),
  };
}

/**
 * Get human-readable status text
 *
 * @param status - Status integer
 * @returns Comma-separated list of active statuses
 *
 * @example
 * getStatusText(6); // "Pinned, Solved"
 * getStatusText(0); // "Open"
 */
export function getStatusText(status: number): string {
  if (status === 0) return 'Open';

  const flags = getActiveFlags(status);
  return flags.map(flag => flag.charAt(0) + flag.slice(1).toLowerCase()).join(', ');
}

/**
 * Validate status integer (ensure no invalid bits set)
 *
 * @param status - Status to validate
 * @returns true if valid, false if has unexpected bits
 */
export function isValidStatus(status: number): boolean {
  // Calculate maximum valid status (all flags combined)
  const maxValid = Object.values(TopicStatusFlags).reduce((acc, val) => acc | val, 0);

  // Check if status has any bits set beyond our defined flags
  return (status & ~maxValid) === 0 && status >= 0;
}

/**
 * SQL query helpers for filtering by status flags
 */
export const StatusQueryHelpers = {
  /**
   * Generate SQL WHERE clause for topics with specific flag set
   * @example WHERE (status & 2) > 0  -- Pinned topics
   */
  hasFlag: (flag: TopicStatusFlag) => `(status & ${flag}) > 0`,

  /**
   * Generate SQL WHERE clause for topics without specific flag
   * @example WHERE (status & 1) = 0  -- Not locked
   */
  notHasFlag: (flag: TopicStatusFlag) => `(status & ${flag}) = 0`,

  /**
   * Generate SQL WHERE clause for topics with ALL specified flags
   * @example WHERE (status & 6) = 6  -- Both pinned AND solved
   */
  hasAllFlags: (flags: TopicStatusFlag[]) => {
    const combined = flags.reduce((acc, flag) => acc | flag, 0);
    return `(status & ${combined}) = ${combined}`;
  },

  /**
   * Generate SQL WHERE clause for topics with ANY specified flag
   * @example WHERE (status & 6) > 0  -- Pinned OR solved
   */
  hasAnyFlag: (flags: TopicStatusFlag[]) => {
    const combined = flags.reduce((acc, flag) => acc | flag, 0);
    return `(status & ${combined}) > 0`;
  },
};
