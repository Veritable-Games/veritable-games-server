/**
 * Comprehensive no-op polyfill for styled-jsx
 * This replaces all styled-jsx functionality with safe no-op implementations
 * to prevent "originalFactory is undefined" and other runtime errors when styled-jsx is disabled.
 */

// Create a comprehensive no-op function that handles all styled-jsx patterns
function createStyledJsxPolyfill() {
  // Base no-op function
  const noop = function (...args) {
    // Return empty string for css calls, empty object for others
    if (typeof args[0] === 'string' || (Array.isArray(args[0]) && args[0].raw)) {
      return ''; // For template literal calls like css`...`
    }
    return noop;
  };

  // Add all styled-jsx properties and methods
  noop.css = function (...args) {
    return ''; // Always return empty string for CSS
  };

  noop.resolve = function (...args) {
    return {
      className: '',
      styles: null,
      __html: '',
    };
  };

  noop.dynamic = function (...args) {
    return '';
  };

  noop.styled = noop;
  noop.default = noop;

  // Handle template literal calls directly on the function
  noop.toString = () => '';
  noop.valueOf = () => '';

  return noop;
}

// Create the main polyfill
const styledJsxPolyfill = createStyledJsxPolyfill();

// StyleRegistry component for Next.js App Router compatibility
function StyleRegistry({ children, registry }) {
  // Simply return children without any styling logic
  return children || null;
}

// createStyleRegistry for compatibility
function createStyleRegistry() {
  return {
    styles: () => null,
    add: () => {},
    remove: () => {},
    flush: () => [],
    registry: new Map(),
    clear: () => {},
  };
}

// JSX runtime compatibility
function jsx() {
  return null;
}

function jsxs() {
  return null;
}

// Export everything that styled-jsx might export
module.exports = styledJsxPolyfill;
module.exports.default = styledJsxPolyfill;
module.exports.css = styledJsxPolyfill.css;
module.exports.resolve = styledJsxPolyfill.resolve;
module.exports.dynamic = styledJsxPolyfill.dynamic;
module.exports.styled = styledJsxPolyfill;
module.exports.StyleRegistry = StyleRegistry;
module.exports.createStyleRegistry = createStyleRegistry;
module.exports.jsx = jsx;
module.exports.jsxs = jsxs;

// ES module compatibility
module.exports.__esModule = true;

// Handle any property access dynamically
const handler = {
  get: function (target, prop) {
    if (prop in target) {
      return target[prop];
    }
    // Return the polyfill function for any unknown property
    return styledJsxPolyfill;
  },
};

// Export a Proxy to catch any unexpected property access
module.exports = new Proxy(module.exports, handler);
