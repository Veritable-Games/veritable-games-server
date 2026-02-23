/**
 * Critical CSS Extraction and Inlining
 * Optimizes initial page load by inlining critical styles
 */

/**
 * Critical CSS configuration
 */
export interface CriticalCSSConfig {
  // Viewport dimensions for above-the-fold calculation
  viewport: {
    width: number;
    height: number;
  };
  // Paths to extract critical CSS from
  paths: string[];
  // CSS to always include
  include?: string[];
  // CSS to always exclude
  exclude?: string[];
  // Inline critical CSS in HTML
  inline: boolean;
  // Extract critical CSS for each route
  perRoute: boolean;
}

/**
 * Default critical CSS configuration
 */
export const defaultCriticalConfig: CriticalCSSConfig = {
  viewport: {
    width: 1440,
    height: 900,
  },
  paths: ['/', '/games', '/forums', '/wiki'],
  include: [
    // Always include reset and base styles
    '*{',
    'html{',
    'body{',
    ':root{',
    // Include font-face declarations
    '@font-face{',
    // Include animations used above the fold
    '@keyframes',
  ],
  exclude: [
    // Exclude print styles
    '@media print',
    // Exclude hover states (not critical for initial render)
    ':hover',
    // Exclude focus states
    ':focus-visible',
    // Exclude animation delays
    'animation-delay',
  ],
  inline: true,
  perRoute: true,
};

/**
 * Extract critical CSS for a given HTML content
 */
export function extractCriticalCSS(
  html: string,
  css: string,
  config: Partial<CriticalCSSConfig> = {}
): string {
  const mergedConfig = { ...defaultCriticalConfig, ...config };

  // This is a simplified version - in production you'd use a tool like critical or penthouse
  // For now, we'll extract CSS that matches certain patterns

  const criticalRules: string[] = [];
  const cssRules = css.split('}').map(rule => rule + '}');

  for (const rule of cssRules) {
    // Check if rule should be included
    if (shouldIncludeRule(rule, mergedConfig)) {
      criticalRules.push(rule);
    }
  }

  return criticalRules.join('\n').replace(/\n\s*\n/g, '\n');
}

/**
 * Check if a CSS rule should be included in critical CSS
 */
function shouldIncludeRule(rule: string, config: CriticalCSSConfig): boolean {
  // Always include rules
  if (config.include?.some(pattern => rule.includes(pattern))) {
    return true;
  }

  // Never include rules
  if (config.exclude?.some(pattern => rule.includes(pattern))) {
    return false;
  }

  // Include layout-critical selectors
  const criticalSelectors = [
    'body',
    'html',
    'main',
    'header',
    'nav',
    '.container',
    '.hero',
    '.above-fold',
    '[data-critical]',
  ];

  return criticalSelectors.some(selector => rule.includes(selector));
}

/**
 * Generate critical CSS for all routes
 */
export async function generateCriticalCSSForRoutes(
  routes: string[],
  config: Partial<CriticalCSSConfig> = {}
): Promise<Map<string, string>> {
  const criticalCSSMap = new Map<string, string>();

  // This would use a headless browser in production to render each route
  // and extract the critical CSS

  for (const route of routes) {
    // Placeholder - would extract actual critical CSS
    const criticalCSS = await extractCriticalCSSForRoute(route, config);
    criticalCSSMap.set(route, criticalCSS);
  }

  return criticalCSSMap;
}

/**
 * Extract critical CSS for a specific route
 */
async function extractCriticalCSSForRoute(
  route: string,
  config: Partial<CriticalCSSConfig> = {}
): Promise<string> {
  // In production, this would:
  // 1. Launch headless browser
  // 2. Navigate to route
  // 3. Extract CSS rules that apply to visible elements
  // 4. Return optimized critical CSS

  // For now, return base critical CSS
  return getBaseCriticalCSS();
}

/**
 * Get base critical CSS that applies to all pages
 */
export function getBaseCriticalCSS(): string {
  return `
    /* Critical Base Styles */
    *,::after,::before{box-sizing:border-box;border:0;padding:0;margin:0}
    html{line-height:1.5;-webkit-text-size-adjust:100%;-moz-tab-size:4;tab-size:4;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-feature-settings:normal;scroll-behavior:smooth}
    body{margin:0;line-height:inherit;min-height:100vh;text-rendering:optimizeSpeed}
    main{display:block}
    h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}
    a{color:inherit;text-decoration:inherit}
    img,svg,video,canvas,audio,iframe,embed,object{display:block;vertical-align:middle;max-width:100%;height:auto}
    
    /* Critical Layout */
    .container{width:100%;margin-right:auto;margin-left:auto;padding-right:1rem;padding-left:1rem}
    @media (min-width:640px){.container{max-width:640px}}
    @media (min-width:768px){.container{max-width:768px}}
    @media (min-width:1024px){.container{max-width:1024px}}
    @media (min-width:1280px){.container{max-width:1280px}}
    @media (min-width:1536px){.container{max-width:1536px}}
    
    /* Critical Colors */
    :root{
      --color-primary:59 130 246;
      --color-secondary:147 51 234;
      --color-success:34 197 94;
      --color-warning:250 204 21;
      --color-danger:239 68 68;
      --color-background:255 255 255;
      --color-foreground:0 0 0;
    }
    @media (prefers-color-scheme:dark){
      :root{
        --color-background:0 0 0;
        --color-foreground:255 255 255;
      }
    }
    
    /* Critical Typography */
    .text-xs{font-size:.75rem;line-height:1rem}
    .text-sm{font-size:.875rem;line-height:1.25rem}
    .text-base{font-size:1rem;line-height:1.5rem}
    .text-lg{font-size:1.125rem;line-height:1.75rem}
    .text-xl{font-size:1.25rem;line-height:1.75rem}
    .text-2xl{font-size:1.5rem;line-height:2rem}
    .text-3xl{font-size:1.875rem;line-height:2.25rem}
    .text-4xl{font-size:2.25rem;line-height:2.5rem}
    
    /* Critical Flexbox */
    .flex{display:flex}
    .inline-flex{display:inline-flex}
    .flex-row{flex-direction:row}
    .flex-col{flex-direction:column}
    .items-center{align-items:center}
    .justify-center{justify-content:center}
    .justify-between{justify-content:space-between}
    
    /* Critical Grid */
    .grid{display:grid}
    .grid-cols-1{grid-template-columns:repeat(1,minmax(0,1fr))}
    .grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}
    .grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}
    .grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}
    .gap-4{gap:1rem}
    .gap-6{gap:1.5rem}
    
    /* Critical Spacing */
    .p-4{padding:1rem}
    .p-6{padding:1.5rem}
    .px-4{padding-left:1rem;padding-right:1rem}
    .py-2{padding-top:.5rem;padding-bottom:.5rem}
    .m-0{margin:0}
    .mx-auto{margin-left:auto;margin-right:auto}
    .mt-4{margin-top:1rem}
    .mb-4{margin-bottom:1rem}
    
    /* Critical Display */
    .hidden{display:none}
    .block{display:block}
    .inline-block{display:inline-block}
    
    /* Critical Position */
    .relative{position:relative}
    .absolute{position:absolute}
    .fixed{position:fixed}
    .sticky{position:sticky}
    .top-0{top:0}
    .left-0{left:0}
    .right-0{right:0}
    
    /* Critical Loading States */
    .skeleton{animation:skeleton-loading 1.5s ease-in-out infinite;background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:200% 100%}
    @keyframes skeleton-loading{0%{background-position:200% 0}100%{background-position:-200% 0}}
    
    /* Critical Animations */
    .animate-pulse{animation:pulse 2s cubic-bezier(0.4,0,0.6,1) infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
    
    .animate-spin{animation:spin 1s linear infinite}
    @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
    
    /* Critical Accessibility */
    .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0}
    
    /* Critical Focus */
    :focus-visible{outline:2px solid transparent;outline-offset:2px;box-shadow:0 0 0 2px rgb(59 130 246)}
  `
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Inline critical CSS in HTML
 */
export function inlineCriticalCSS(html: string, criticalCSS: string): string {
  const styleTag = `<style data-critical="true">${criticalCSS}</style>`;

  // Insert before closing head tag
  if (html.includes('</head>')) {
    return html.replace('</head>', `${styleTag}</head>`);
  }

  // Or insert at the beginning of body if no head tag
  return html.replace('<body', `${styleTag}<body`);
}

/**
 * Generate link preload for non-critical CSS
 */
export function generateCSSPreload(cssPath: string): string {
  return `
    <link rel="preload" href="${cssPath}" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="${cssPath}"></noscript>
  `.trim();
}

/**
 * Load non-critical CSS asynchronously
 */
export function loadCSS(href: string, media = 'all'): void {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.media = 'only x'; // Temporarily set to non-matching media

  document.head.appendChild(link);

  // Switch to correct media after loaded
  link.onload = () => {
    link.media = media;
  };
}

/**
 * Remove unused CSS based on PurgeCSS configuration
 */
export const purgeCSSConfig = {
  content: ['./src/**/*.{js,ts,jsx,tsx}', './public/**/*.html'],
  safelist: [
    // Always keep these classes
    /^(hover|focus|active|disabled|group-hover):/,
    /^(sm|md|lg|xl|2xl):/,
    /^animate-/,
    /^transition/,
    /data-/,
  ],
  blocklist: [
    // Remove these classes
    /^debug-/,
    /^test-/,
  ],
};

/**
 * CSS optimization metrics
 */
export interface CSSMetrics {
  totalSize: number;
  criticalSize: number;
  unusedPercentage: number;
  rules: {
    total: number;
    used: number;
    critical: number;
  };
  selectors: {
    total: number;
    used: number;
    complex: number;
  };
}

/**
 * Analyze CSS usage and generate metrics
 */
export async function analyzeCSSUsage(): Promise<CSSMetrics> {
  // This would use tools like Chrome DevTools Coverage API in production
  // For now, return mock metrics
  return {
    totalSize: 150000, // 150KB
    criticalSize: 15000, // 15KB
    unusedPercentage: 65,
    rules: {
      total: 2500,
      used: 875,
      critical: 200,
    },
    selectors: {
      total: 3500,
      used: 1200,
      complex: 150,
    },
  };
}

/**
 * Generate optimized CSS loading strategy
 */
export function generateOptimizedCSSStrategy(): string {
  return `
    <!-- Critical CSS (inlined) -->
    <style data-critical="true">${getBaseCriticalCSS()}</style>

    <!-- Preload main stylesheet -->
    <link rel="preload" href="/_next/static/css/main.css" as="style">

    <!-- Load non-critical CSS asynchronously -->
    <link rel="stylesheet" href="/_next/static/css/main.css" media="print" onload="this.media='all'; this.onload=null;">

    <!-- Fallback for browsers without JavaScript -->
    <noscript>
      <link rel="stylesheet" href="/_next/static/css/main.css">
    </noscript>
  `.trim();
}

// Export old function name for compatibility
export const generateCloudFlareCSSStrategy = generateOptimizedCSSStrategy;

// Export utilities
export const CriticalCSS = {
  extractCriticalCSS,
  generateCriticalCSSForRoutes,
  getBaseCriticalCSS,
  inlineCriticalCSS,
  generateCSSPreload,
  loadCSS,
  analyzeCSSUsage,
  generateOptimizedCSSStrategy,
};
