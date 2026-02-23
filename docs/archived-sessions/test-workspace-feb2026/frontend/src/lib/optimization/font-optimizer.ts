/**
 * Font Optimization and Preloading Utilities
 * Implements advanced font loading strategies for optimal performance
 */

/**
 * Font display strategies
 */
import { logger } from '@/lib/utils/logger';

export type FontDisplay = 'auto' | 'block' | 'swap' | 'fallback' | 'optional';

/**
 * Font configuration
 */
export interface FontConfig {
  family: string;
  src: string | FontSource[];
  display?: FontDisplay;
  weight?: string | number;
  style?: 'normal' | 'italic' | 'oblique';
  unicodeRange?: string;
  fallback?: string[];
  preload?: boolean;
  variable?: string;
}

interface FontSource {
  url: string;
  format?: 'woff2' | 'woff' | 'truetype' | 'opentype' | 'embedded-opentype';
}

/**
 * System font stacks for optimal performance
 */
export const systemFontStacks = {
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
  serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
};

/**
 * Font optimization configuration for Veritable Games
 */
export const fontConfig: FontConfig[] = [
  {
    family: 'Inter',
    src: [
      { url: '/fonts/inter-var.woff2', format: 'woff2' },
      { url: '/fonts/inter-var.woff', format: 'woff' },
    ],
    display: 'swap',
    weight: '100 900',
    style: 'normal',
    variable: '--font-inter',
    preload: true,
    fallback: ['system-ui', 'sans-serif'],
  },
  {
    family: 'JetBrains Mono',
    src: [
      { url: '/fonts/jetbrains-mono.woff2', format: 'woff2' },
      { url: '/fonts/jetbrains-mono.woff', format: 'woff' },
    ],
    display: 'swap',
    weight: '400 700',
    style: 'normal',
    variable: '--font-mono',
    preload: false,
    fallback: ['monospace'],
  },
];

/**
 * Generate @font-face CSS rules
 */
export function generateFontFace(config: FontConfig): string {
  const sources = Array.isArray(config.src)
    ? config.src.map(s => `url('${s.url}')${s.format ? ` format('${s.format}')` : ''}`).join(', ')
    : `url('${config.src}')`;

  return `
    @font-face {
      font-family: '${config.family}';
      src: ${sources};
      font-display: ${config.display || 'swap'};
      font-weight: ${config.weight || 'normal'};
      font-style: ${config.style || 'normal'};
      ${config.unicodeRange ? `unicode-range: ${config.unicodeRange};` : ''}
    }
  `.trim();
}

/**
 * Generate font preload links
 */
export function generateFontPreloadLinks(fonts: FontConfig[]): string {
  return fonts
    .filter(font => font.preload)
    .map(font => {
      const src = Array.isArray(font.src)
        ? (font.src[0] ?? { url: '', format: 'woff2' as const })
        : { url: font.src ?? '', format: undefined };
      return `<link rel="preload" href="${src.url ?? ''}" as="font" type="font/${src.format || 'woff2'}" crossorigin="anonymous">`;
    })
    .join('\n');
}

/**
 * Font loading observer using Font Face Observer pattern
 */
export class FontLoader {
  private static instance: FontLoader;
  private loadedFonts = new Set<string>();
  private loadingPromises = new Map<string, Promise<void>>();

  static getInstance(): FontLoader {
    if (!FontLoader.instance) {
      FontLoader.instance = new FontLoader();
    }
    return FontLoader.instance;
  }

  /**
   * Load a font with Promise-based API
   */
  async loadFont(
    family: string,
    options?: {
      weight?: string | number;
      style?: string;
      timeout?: number;
    }
  ): Promise<void> {
    const key = `${family}-${options?.weight || 'normal'}-${options?.style || 'normal'}`;

    // Return if already loaded
    if (this.loadedFonts.has(key)) {
      return Promise.resolve();
    }

    // Return existing promise if already loading
    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key)!;
    }

    // Create loading promise
    const loadPromise = this.loadFontInternal(family, options);
    this.loadingPromises.set(key, loadPromise);

    try {
      await loadPromise;
      this.loadedFonts.add(key);
    } finally {
      this.loadingPromises.delete(key);
    }
  }

  private async loadFontInternal(
    family: string,
    options?: {
      weight?: string | number;
      style?: string;
      timeout?: number;
    }
  ): Promise<void> {
    if (typeof window === 'undefined' || !document.fonts) {
      return Promise.resolve();
    }

    const weight = options?.weight || 'normal';
    const style = options?.style || 'normal';
    const timeout = options?.timeout || 3000;

    const fontString = `${style} ${weight} 16px "${family}"`;

    return Promise.race([
      document.fonts.load(fontString),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error(`Font loading timeout: ${family}`)), timeout)
      ),
    ])
      .then(() => {
        document.documentElement.classList.add(
          `font-${family.toLowerCase().replace(/\s+/g, '-')}-loaded`
        );
      })
      .catch(error => {
        logger.warn(`Failed to load font ${family}:`, error);
        // Don't throw - use fallback fonts
      });
  }

  /**
   * Load multiple fonts in parallel
   */
  async loadFonts(
    fonts: Array<{ family: string; weight?: string | number; style?: string }>
  ): Promise<void> {
    await Promise.all(fonts.map(font => this.loadFont(font.family, font)));
  }

  /**
   * Check if a font is loaded
   */
  isFontLoaded(family: string, weight = 'normal', style = 'normal'): boolean {
    const key = `${family}-${weight}-${style}`;
    return this.loadedFonts.has(key);
  }
}

/**
 * Critical fonts that should be loaded immediately
 */
export const criticalFonts = [
  { family: 'Inter', weight: '400' },
  { family: 'Inter', weight: '600' },
  { family: 'Inter', weight: '700' },
];

/**
 * Generate CSS for font loading classes
 */
export function generateFontLoadingCSS(): string {
  return `
    /* Font loading states */
    .fonts-loading {
      font-family: ${systemFontStacks.sans};
    }
    
    .font-inter-loaded {
      font-family: 'Inter', ${systemFontStacks.sans};
    }
    
    .font-jetbrains-mono-loaded {
      font-family: 'JetBrains Mono', ${systemFontStacks.mono};
    }
    
    /* Reduce layout shift during font swap */
    .fonts-loading * {
      letter-spacing: 0.02em;
      word-spacing: -0.01em;
    }
    
    /* Font smoothing for better rendering */
    body {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }
    
    /* Variable font settings */
    :root {
      --font-inter: 'Inter';
      --font-mono: 'JetBrains Mono';
      --font-system: ${systemFontStacks.sans};
      --font-system-mono: ${systemFontStacks.mono};
    }
    
    /* Font weight variables */
    :root {
      --font-weight-thin: 100;
      --font-weight-light: 300;
      --font-weight-regular: 400;
      --font-weight-medium: 500;
      --font-weight-semibold: 600;
      --font-weight-bold: 700;
      --font-weight-black: 900;
    }
  `.trim();
}

/**
 * Subset fonts for specific character ranges
 */
export const fontSubsets = {
  latin:
    'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  latinExt:
    'U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF',
  cyrillic: 'U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116',
  greek: 'U+0370-03FF',
};

/**
 * Optimize font loading URL
 */
export function generateOptimizedFontURL(fontPath: string): string {
  // Return the font path as-is, Next.js will handle optimization
  return fontPath;
}

/**
 * Font metrics for reducing layout shift
 */
export const fontMetrics = {
  inter: {
    unitsPerEm: 2816,
    ascent: 2728,
    descent: -680,
    lineGap: 0,
    capHeight: 2048,
    xHeight: 1536,
  },
  jetbrainsMono: {
    unitsPerEm: 1000,
    ascent: 1020,
    descent: -300,
    lineGap: 0,
    capHeight: 730,
    xHeight: 550,
  },
};

/**
 * Calculate font adjustment for FOUT reduction
 */
export function calculateFontAdjustment(
  targetFont: keyof typeof fontMetrics,
  fallbackFont = 'arial'
): {
  sizeAdjust: number;
  ascentOverride: number;
  descentOverride: number;
  lineGapOverride: number;
} {
  const target = fontMetrics[targetFont];

  // These values would be calculated based on the fallback font metrics
  // For now, return approximations
  return {
    sizeAdjust: 1.05,
    ascentOverride: target.ascent / target.unitsPerEm,
    descentOverride: Math.abs(target.descent) / target.unitsPerEm,
    lineGapOverride: target.lineGap / target.unitsPerEm,
  };
}

/**
 * Initialize font optimization
 */
export async function initializeFontOptimization(): Promise<void> {
  const loader = FontLoader.getInstance();

  // Load critical fonts
  await loader.loadFonts(criticalFonts);

  // Preconnect to Google Fonts if used
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = 'https://fonts.googleapis.com';
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}

// Export old function name for compatibility
export const generateCloudFlareFontURL = generateOptimizedFontURL;

// Export utilities
export const FontOptimizer = {
  generateFontFace,
  generateFontPreloadLinks,
  generateFontLoadingCSS,
  FontLoader: FontLoader.getInstance(),
  initializeFontOptimization,
  systemFontStacks,
  fontConfig,
  criticalFonts,
};
