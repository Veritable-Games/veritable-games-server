/**
 * Mathematical Color Conversion: Blue to Purple Theme
 * This utility provides precise color conversion from blue spectrum to purple spectrum
 * while maintaining saturation, lightness, and alpha values
 */

// Color conversion constants
const BLUE_HUE_MIN = 180;
const BLUE_HUE_MAX = 260;
const PURPLE_TARGET_HUE = 280; // Primary purple target
const HUE_ROTATION_OFFSET = 70; // Rotation from blue (~210°) to purple (~280°)

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result && result[1] && result[2] && result[3]
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : null;
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [h * 360, s * 100, l * 100];
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * Check if a hue is in the blue spectrum
 */
function isBlueTinted(hue: number, saturation: number): boolean {
  return hue >= BLUE_HUE_MIN && hue <= BLUE_HUE_MAX && saturation > 5;
}

/**
 * Convert blue color to purple
 */
export function convertBlueToPurple(color: string): string {
  // Handle hex colors
  if (color.startsWith('#')) {
    const rgb = hexToRgb(color);
    if (!rgb) return color;

    const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);

    if (isBlueTinted(h, s)) {
      const newHue = (h + HUE_ROTATION_OFFSET) % 360;
      const [r, g, b] = hslToRgb(newHue, s, l);
      return rgbToHex(r, g, b);
    }

    return color;
  }

  // Handle rgb/rgba colors
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]) {
    const r = parseInt(rgbMatch[1]);
    const g = parseInt(rgbMatch[2]);
    const b = parseInt(rgbMatch[3]);
    const a = rgbMatch[4] || '1';

    const [h, s, l] = rgbToHsl(r, g, b);

    if (isBlueTinted(h, s)) {
      const newHue = (h + HUE_ROTATION_OFFSET) % 360;
      const [newR, newG, newB] = hslToRgb(newHue, s, l);
      return rgbMatch[4]
        ? `rgba(${newR}, ${newG}, ${newB}, ${a})`
        : `rgb(${newR}, ${newG}, ${newB})`;
    }

    return color;
  }

  // Handle hsl/hsla colors
  const hslMatch = color.match(/hsla?\((\d+),\s*([\d.]+)%,\s*([\d.]+)%(?:,\s*([\d.]+))?\)/);
  if (hslMatch && hslMatch[1] && hslMatch[2] && hslMatch[3]) {
    const h = parseInt(hslMatch[1]);
    const s = parseFloat(hslMatch[2]);
    const l = parseFloat(hslMatch[3]);
    const a = hslMatch[4] || '1';

    if (isBlueTinted(h, s)) {
      const newHue = (h + HUE_ROTATION_OFFSET) % 360;
      return hslMatch[4] ? `hsla(${newHue}, ${s}%, ${l}%, ${a})` : `hsl(${newHue}, ${s}%, ${l}%)`;
    }

    return color;
  }

  return color;
}

/**
 * Tailwind color class mapping for blue to purple conversion
 */
export const tailwindBlueToPurple: Record<string, string> = {
  // Blue 50-950 to Purple equivalents
  'blue-50': 'purple-50',
  'blue-100': 'purple-100',
  'blue-200': 'purple-200',
  'blue-300': 'purple-300',
  'blue-400': 'purple-400',
  'blue-500': 'purple-500',
  'blue-600': 'purple-600',
  'blue-700': 'purple-700',
  'blue-800': 'purple-800',
  'blue-900': 'purple-900',
  'blue-950': 'purple-950',

  // Text colors
  'text-blue-50': 'text-purple-50',
  'text-blue-100': 'text-purple-100',
  'text-blue-200': 'text-purple-200',
  'text-blue-300': 'text-purple-300',
  'text-blue-400': 'text-purple-400',
  'text-blue-500': 'text-purple-500',
  'text-blue-600': 'text-purple-600',
  'text-blue-700': 'text-purple-700',
  'text-blue-800': 'text-purple-800',
  'text-blue-900': 'text-purple-900',

  // Background colors
  'bg-blue-50': 'bg-purple-50',
  'bg-blue-100': 'bg-purple-100',
  'bg-blue-200': 'bg-purple-200',
  'bg-blue-300': 'bg-purple-300',
  'bg-blue-400': 'bg-purple-400',
  'bg-blue-500': 'bg-purple-500',
  'bg-blue-600': 'bg-purple-600',
  'bg-blue-700': 'bg-purple-700',
  'bg-blue-800': 'bg-purple-800',
  'bg-blue-900': 'bg-purple-900',

  // Border colors
  'border-blue-50': 'border-purple-50',
  'border-blue-100': 'border-purple-100',
  'border-blue-200': 'border-purple-200',
  'border-blue-300': 'border-purple-300',
  'border-blue-400': 'border-purple-400',
  'border-blue-500': 'border-purple-500',
  'border-blue-600': 'border-purple-600',
  'border-blue-700': 'border-purple-700',
  'border-blue-800': 'border-purple-800',
  'border-blue-900': 'border-purple-900',

  // Hover states
  'hover:text-blue-300': 'hover:text-purple-300',
  'hover:text-blue-400': 'hover:text-purple-400',
  'hover:text-blue-500': 'hover:text-purple-500',
  'hover:text-blue-600': 'hover:text-purple-600',
  'hover:text-blue-700': 'hover:text-purple-700',

  'hover:bg-blue-50': 'hover:bg-purple-50',
  'hover:bg-blue-100': 'hover:bg-purple-100',
  'hover:bg-blue-500': 'hover:bg-purple-500',
  'hover:bg-blue-600': 'hover:bg-purple-600',
  'hover:bg-blue-700': 'hover:bg-purple-700',
  'hover:bg-blue-800': 'hover:bg-purple-800',

  'hover:border-blue-300': 'hover:border-purple-300',
  'hover:border-blue-400': 'hover:border-purple-400',
  'hover:border-blue-500': 'hover:border-purple-500',

  // Dark mode variants
  'dark:text-blue-400': 'dark:text-purple-400',
  'dark:text-blue-300': 'dark:text-purple-300',
  'dark:bg-blue-900': 'dark:bg-purple-900',
  'dark:hover:bg-blue-900': 'dark:hover:bg-purple-900',

  // Focus states
  'focus:border-blue-500': 'focus:border-purple-500',
  'focus:ring-blue-500': 'focus:ring-purple-500',

  // Border specific
  'border-l-blue-400': 'border-l-purple-400',
  'border-l-2': 'border-l-2', // Keep as-is

  // Combined classes
  'bg-blue-900/20': 'bg-purple-900/20',
  'bg-blue-900/30': 'bg-purple-900/30',
  'border-blue-400/50': 'border-purple-400/50',
  'border-blue-300/50': 'border-purple-300/50',
};

/**
 * Convert Tailwind classes in a string from blue to purple
 */
export function convertTailwindClasses(className: string, isLibrary: boolean): string {
  if (!isLibrary) return className;

  let converted = className;

  // Replace each blue class with purple equivalent
  Object.entries(tailwindBlueToPurple).forEach(([blue, purple]) => {
    const regex = new RegExp(`\\b${blue}\\b`, 'g');
    converted = converted.replace(regex, purple);
  });

  return converted;
}

/**
 * Generate color mapping table for documentation
 */
export function generateColorMappingTable(): Array<{
  original: string;
  converted: string;
  usage: string;
}> {
  return [
    // Primary blues to purples
    {
      original: '#3B82F6',
      converted: '#9333EA',
      usage: 'Primary action color (blue-500 → purple-600)',
    },
    { original: '#2563EB', converted: '#7C3AED', usage: 'Hover state (blue-600 → purple-700)' },
    { original: '#1D4ED8', converted: '#6D28D9', usage: 'Active state (blue-700 → purple-800)' },

    // Light blues to light purples
    {
      original: '#DBEAFE',
      converted: '#F3E8FF',
      usage: 'Light background (blue-100 → purple-100)',
    },
    {
      original: '#BFDBFE',
      converted: '#E9D5FF',
      usage: 'Subtle background (blue-200 → purple-200)',
    },

    // Text colors
    { original: '#60A5FA', converted: '#C084FC', usage: 'Link text (blue-400 → purple-400)' },
    { original: '#93C5FD', converted: '#D8B4FE', usage: 'Subtle text (blue-300 → purple-300)' },

    // Dark mode colors
    {
      original: '#1E40AF',
      converted: '#6B21A8',
      usage: 'Dark mode accent (blue-800 → purple-800)',
    },
    { original: '#1E3A8A', converted: '#581C87', usage: 'Dark mode deep (blue-900 → purple-900)' },
  ];
}
