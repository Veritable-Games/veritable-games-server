/**
 * Forum Visual Theme
 *
 * Enhanced visual design system with glass morphism, gradients, and animations.
 * Centralized styling constants for consistent forum UI.
 *
 * Features:
 * - Glass morphism effects (backdrop-filter blur)
 * - Gradient backgrounds and borders
 * - Enhanced hover states with scale/glow
 * - Smooth transitions
 * - Vibrant accent colors
 *
 * @module styles/forum-theme
 */

/**
 * Glass morphism card styles
 */
export const glassCard = {
  base: 'bg-gray-900/40 backdrop-blur-md border border-gray-700/50',
  hover: 'hover:bg-gray-900/60 hover:border-gray-600/50 hover:shadow-lg hover:shadow-blue-500/10',
  transition: 'transition-all duration-300',
  full: 'bg-gray-900/40 backdrop-blur-md border border-gray-700/50 hover:bg-gray-900/60 hover:border-gray-600/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300',
} as const;

/**
 * Glass morphism panel styles (lighter than cards)
 */
export const glassPanel = {
  base: 'bg-gray-800/30 backdrop-blur-sm border border-gray-700/40',
  hover: 'hover:bg-gray-800/50 hover:border-gray-600/40',
  transition: 'transition-all duration-200',
  full: 'bg-gray-800/30 backdrop-blur-sm border border-gray-700/40 hover:bg-gray-800/50 hover:border-gray-600/40 transition-all duration-200',
} as const;

/**
 * Button styles with glass effect
 */
export const glassButton = {
  primary:
    'bg-blue-600/80 hover:bg-blue-500/90 backdrop-blur-sm text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:scale-105 transition-all duration-200',
  secondary:
    'bg-gray-700/60 hover:bg-gray-600/70 backdrop-blur-sm text-gray-200 hover:text-white shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200',
  ghost:
    'bg-transparent hover:bg-gray-800/40 backdrop-blur-sm text-gray-300 hover:text-white border border-gray-700/40 hover:border-gray-600/60 transition-all duration-200',
} as const;

/**
 * Badge/tag styles with glow effect
 */
export const glowBadge = {
  blue: 'bg-blue-600/20 text-blue-400 border border-blue-500/40 backdrop-blur-sm hover:bg-blue-600/30 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-200',
  green:
    'bg-green-600/20 text-green-400 border border-green-500/40 backdrop-blur-sm hover:bg-green-600/30 hover:shadow-lg hover:shadow-green-500/30 transition-all duration-200',
  yellow:
    'bg-yellow-600/20 text-yellow-400 border border-yellow-500/40 backdrop-blur-sm hover:bg-yellow-600/30 hover:shadow-lg hover:shadow-yellow-500/30 transition-all duration-200',
  purple:
    'bg-purple-600/20 text-purple-400 border border-purple-500/40 backdrop-blur-sm hover:bg-purple-600/30 hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-200',
  red: 'bg-red-600/20 text-red-400 border border-red-500/40 backdrop-blur-sm hover:bg-red-600/30 hover:shadow-lg hover:shadow-red-500/30 transition-all duration-200',
  gray: 'bg-gray-600/20 text-gray-400 border border-gray-500/40 backdrop-blur-sm hover:bg-gray-600/30 hover:shadow-lg hover:shadow-gray-500/30 transition-all duration-200',
} as const;

/**
 * Gradient backgrounds
 */
export const gradientBg = {
  subtle: 'bg-gradient-to-br from-gray-900/90 via-gray-900/80 to-gray-800/90',
  blue: 'bg-gradient-to-br from-blue-900/20 via-gray-900/80 to-purple-900/20',
  green: 'bg-gradient-to-br from-green-900/20 via-gray-900/80 to-teal-900/20',
  purple: 'bg-gradient-to-br from-purple-900/20 via-gray-900/80 to-pink-900/20',
} as const;

/**
 * Interactive row/item styles
 */
export const interactiveRow = {
  base: 'bg-gray-900/20 border-b border-gray-700/40',
  hover: 'hover:bg-gray-800/40 hover:border-gray-600/50 hover:shadow-md hover:shadow-blue-500/5',
  active: 'bg-gray-800/50 border-gray-600/60 shadow-md shadow-blue-500/10',
  transition: 'transition-all duration-200',
  full: 'bg-gray-900/20 border-b border-gray-700/40 hover:bg-gray-800/40 hover:border-gray-600/50 hover:shadow-md hover:shadow-blue-500/5 transition-all duration-200',
} as const;

/**
 * Status indicator colors (for badges, icons, etc.)
 */
export const statusColors = {
  solved: {
    bg: 'bg-green-600/20',
    text: 'text-green-400',
    border: 'border-green-500/40',
    glow: 'shadow-green-500/30',
  },
  locked: {
    bg: 'bg-red-600/20',
    text: 'text-red-400',
    border: 'border-red-500/40',
    glow: 'shadow-red-500/30',
  },
  pinned: {
    bg: 'bg-yellow-600/20',
    text: 'text-yellow-400',
    border: 'border-yellow-500/40',
    glow: 'shadow-yellow-500/30',
  },
  active: {
    bg: 'bg-blue-600/20',
    text: 'text-blue-400',
    border: 'border-blue-500/40',
    glow: 'shadow-blue-500/30',
  },
} as const;

/**
 * Link styles with hover effects
 */
export const enhancedLink = {
  primary: 'text-blue-400 hover:text-blue-300 hover:underline transition-colors duration-150',
  secondary: 'text-gray-400 hover:text-gray-200 hover:underline transition-colors duration-150',
  bold: 'text-blue-400 hover:text-blue-300 font-semibold hover:underline transition-colors duration-150',
  subtle: 'text-gray-300 hover:text-white transition-colors duration-150',
} as const;

/**
 * Input/form styles with glass effect
 */
export const glassInput = {
  base: 'bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200',
  error:
    'bg-red-900/20 backdrop-blur-sm border border-red-500/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all duration-200',
} as const;

/**
 * Animation classes
 */
export const animations = {
  fadeIn: 'animate-fadeIn',
  slideUp: 'animate-slideUp',
  pulse: 'animate-pulse',
  spin: 'animate-spin',
  bounce: 'animate-bounce',
} as const;

/**
 * Hover scale effects
 */
export const hoverScale = {
  sm: 'hover:scale-[1.02] transition-transform duration-200',
  md: 'hover:scale-105 transition-transform duration-200',
  lg: 'hover:scale-110 transition-transform duration-200',
} as const;

/**
 * Shadow/glow effects
 */
export const glowEffects = {
  blue: 'shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40',
  green: 'shadow-lg shadow-green-500/20 hover:shadow-green-500/40',
  purple: 'shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40',
  yellow: 'shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/40',
  red: 'shadow-lg shadow-red-500/20 hover:shadow-red-500/40',
} as const;

/**
 * Helper function to combine theme classes
 */
export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Export all as default for convenience
 */
export default {
  glassCard,
  glassPanel,
  glassButton,
  glowBadge,
  gradientBg,
  interactiveRow,
  statusColors,
  enhancedLink,
  glassInput,
  animations,
  hoverScale,
  glowEffects,
  cn,
};
