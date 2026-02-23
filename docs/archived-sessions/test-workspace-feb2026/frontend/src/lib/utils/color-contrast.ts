/**
 * Color Contrast Utilities
 *
 * Provides WCAG 2.1 compliant contrast calculation and text color selection
 * for dynamic backgrounds.
 */

/**
 * Convert hex color to RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove # if present
  const cleanHex = hex.replace('#', '');

  // Handle 3-digit hex codes
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0]! + cleanHex[0]!, 16);
    const g = parseInt(cleanHex[1]! + cleanHex[1]!, 16);
    const b = parseInt(cleanHex[2]! + cleanHex[2]!, 16);
    return { r, g, b };
  }

  // Handle 6-digit hex codes
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return { r, g, b };
  }

  return null;
}

/**
 * Calculate relative luminance according to WCAG 2.1
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
export function getLuminance(r: number, g: number, b: number): number {
  // Convert RGB to sRGB
  const rsRGB = r / 255;
  const gsRGB = g / 255;
  const bsRGB = b / 255;

  // Apply gamma correction
  const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  // Calculate luminance using ITU-R BT.709 coefficients
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculate contrast ratio between two colors
 * Returns a value between 1 (no contrast) and 21 (maximum contrast)
 */
export function getContrastRatio(luminance1: number, luminance2: number): number {
  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determine if a background color is "light" or "dark"
 * Uses WCAG 2.1 luminance threshold
 */
export function isLightColor(hexColor: string): boolean {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return false;

  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);

  // WCAG threshold: 0.5 is roughly the midpoint
  // Colors with luminance > 0.5 are considered "light"
  return luminance > 0.5;
}

/**
 * Get appropriate text color (white or black) for a given background color
 * Ensures WCAG AA compliance (4.5:1 contrast ratio for normal text)
 */
export function getContrastTextColor(hexColor: string): string {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return '#FFFFFF'; // Default to white if parsing fails

  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);

  // Calculate contrast ratios with white and black
  const whiteLuminance = 1.0; // White has maximum luminance
  const blackLuminance = 0.0; // Black has minimum luminance

  const contrastWithWhite = getContrastRatio(luminance, whiteLuminance);
  const contrastWithBlack = getContrastRatio(luminance, blackLuminance);

  // Return the color with better contrast
  // For edge cases, prefer white text (common in dark-themed apps)
  return contrastWithWhite >= contrastWithBlack ? '#FFFFFF' : '#000000';
}

/**
 * Get themed text colors based on background
 * Returns neutral-100 for dark backgrounds, neutral-900 for light backgrounds
 */
export function getThemedTextColor(hexColor: string): string {
  return isLightColor(hexColor) ? 'text-neutral-900' : 'text-neutral-100';
}

/**
 * Darken a hex color by a percentage (0-100)
 * Useful for creating hover states or gradients
 */
export function darkenColor(hexColor: string, percent: number): string {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return hexColor;

  const factor = 1 - percent / 100;
  const r = Math.max(0, Math.min(255, Math.round(rgb.r * factor)));
  const g = Math.max(0, Math.min(255, Math.round(rgb.g * factor)));
  const b = Math.max(0, Math.min(255, Math.round(rgb.b * factor)));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Lighten a hex color by a percentage (0-100)
 */
export function lightenColor(hexColor: string, percent: number): string {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return hexColor;

  const factor = percent / 100;
  const r = Math.max(0, Math.min(255, Math.round(rgb.r + (255 - rgb.r) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(rgb.g + (255 - rgb.g) * factor)));
  const b = Math.max(0, Math.min(255, Math.round(rgb.b + (255 - rgb.b) * factor)));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
