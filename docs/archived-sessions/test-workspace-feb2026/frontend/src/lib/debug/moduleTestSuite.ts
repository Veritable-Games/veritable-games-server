// Module Loading Test Suite for Next.js ES6 Import Issues
// This provides comprehensive testing of different import strategies

import { logger } from '../utils/logger';

/**
 * Extended Window interface for test properties
 */
interface WindowWithTestModules extends Window {
  StellarDodecahedronViewer?: unknown;
  TestStellarViewer?: unknown;
  EvalStellarViewer?: unknown;
}

declare const window: WindowWithTestModules;

export interface ModuleTestResult {
  method: string;
  success: boolean;
  error?: string;
  details?: any;
  timing?: number;
  moduleKeys?: string[];
}

export class ModuleTestSuite {
  private results: ModuleTestResult[] = [];

  async runAllTests(): Promise<ModuleTestResult[]> {
    logger.debug('🧪 === MODULE LOADING TEST SUITE ===');
    this.results = [];

    await this.testFileAccessibility();
    await this.testStandardDynamicImport();
    await this.testFunctionConstructorImport();
    await this.testScriptTagModuleLoading();
    await this.testCDNBasedApproach();
    await this.testFetchAndEvalApproach();

    logger.debug('✅ Test suite complete, results:', this.results);
    return this.results;
  }

  private async testFileAccessibility(): Promise<void> {
    const startTime = performance.now();

    try {
      const response = await fetch('/stellar/script.js', { method: 'HEAD' });
      const timing = performance.now() - startTime;

      this.results.push({
        method: 'File Accessibility',
        success: response.ok,
        timing,
        details: {
          status: response.status,
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length'),
        },
      });
    } catch (error) {
      this.results.push({
        method: 'File Accessibility',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timing: performance.now() - startTime,
      });
    }
  }

  private async testStandardDynamicImport(): Promise<void> {
    const startTime = performance.now();

    // NOTE: This method cannot work in Next.js build because webpack tries to resolve
    // imports at build time. This test will always fail in production build.
    this.results.push({
      method: 'Standard Dynamic Import',
      success: false,
      error: 'Not supported in Next.js build - webpack tries to resolve at build time',
      timing: performance.now() - startTime,
      details: {
        reason: 'Webpack attempts to bundle public assets',
        alternative: 'Use runtime script loading instead',
      },
    });
  }

  private async testFunctionConstructorImport(): Promise<void> {
    const startTime = performance.now();

    // NOTE: Runtime-only test using Function constructor to avoid build-time resolution
    try {
      logger.debug('Testing function constructor runtime import...');

      // This approach avoids webpack build-time resolution by using runtime evaluation
      const importFunction = new Function(`
        return fetch('/stellar/script.js')
          .then(response => response.text())
          .then(scriptText => ({ scriptText, length: scriptText.length }))
      `);

      const result = await importFunction();
      const timing = performance.now() - startTime;

      this.results.push({
        method: 'Function Constructor Import',
        success: !!result.scriptText,
        timing,
        moduleKeys: ['scriptText', 'length'],
        details: {
          scriptLength: result.length,
          hasContent: result.scriptText.includes('StellarDodecahedronViewer'),
        },
      });
    } catch (error) {
      this.results.push({
        method: 'Function Constructor Import',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timing: performance.now() - startTime,
      });
    }
  }

  private async testScriptTagModuleLoading(): Promise<void> {
    const startTime = performance.now();

    try {
      logger.debug('Testing script tag module loading...');

      const result = await new Promise<boolean>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/stellar/script.js';
        script.type = 'module';

        const timeout = setTimeout(() => {
          document.head.removeChild(script);
          reject(new Error('Script loading timeout'));
        }, 5000);

        script.onload = () => {
          clearTimeout(timeout);
          document.head.removeChild(script);
          // Check if global was set (shouldn't be with pure ES6 modules)
          resolve(!!window.StellarDodecahedronViewer);
        };

        script.onerror = error => {
          clearTimeout(timeout);
          document.head.removeChild(script);
          reject(error);
        };

        document.head.appendChild(script);
      });

      this.results.push({
        method: 'Script Tag Module Loading',
        success: result,
        timing: performance.now() - startTime,
        details: {
          globalFound: !!window.StellarDodecahedronViewer,
        },
      });
    } catch (error) {
      this.results.push({
        method: 'Script Tag Module Loading',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timing: performance.now() - startTime,
      });
    }
  }

  private async testCDNBasedApproach(): Promise<void> {
    const startTime = performance.now();

    try {
      logger.debug('Testing CDN-based approach...');

      // Load Three.js from CDN first
      await this.loadScriptAsync('https://unpkg.com/three@0.158.0/build/three.module.js', 'module');
      await this.loadScriptAsync(
        'https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js',
        'module'
      );

      // Fetch and modify our script
      const response = await fetch('/stellar/script.js');
      const scriptText = await response.text();

      const modifiedScript = scriptText
        .replace(
          /import \* as THREE from ['"]\.\/three\.js\/three\.module\.js['"];?/g,
          "import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';"
        )
        .replace(
          /import { OrbitControls } from ['"]\.\/three\.js\/examples\/jsm\/controls\/OrbitControls\.js['"];?/g,
          "import { OrbitControls } from 'https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js';"
        )
        .replace(
          /export { StellarDodecahedronViewer };?/,
          'window.TestStellarViewer = StellarDodecahedronViewer;'
        );

      // Execute modified script
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = modifiedScript;

      await new Promise<void>((resolve, reject) => {
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Script execution failed'));
        document.head.appendChild(script);

        setTimeout(() => {
          if (window.TestStellarViewer) {
            resolve();
          } else {
            reject(new Error('TestStellarViewer not found'));
          }
        }, 2000);
      });

      this.results.push({
        method: 'CDN-Based Approach',
        success: !!window.TestStellarViewer,
        timing: performance.now() - startTime,
        details: {
          stellarViewerType: typeof window.TestStellarViewer,
        },
      });

      // Cleanup
      document.head.removeChild(script);
      delete window.TestStellarViewer;
    } catch (error) {
      this.results.push({
        method: 'CDN-Based Approach',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timing: performance.now() - startTime,
      });
    }
  }

  private async testFetchAndEvalApproach(): Promise<void> {
    const startTime = performance.now();

    try {
      logger.debug('Testing fetch + eval approach...');

      const response = await fetch('/stellar/script.js');
      const scriptText = await response.text();

      // Replace imports and exports for eval context
      const modifiedScript = scriptText
        .replace(/import[^;]+;/g, '// Import removed for eval')
        .replace(
          /export { StellarDodecahedronViewer };?/,
          'window.EvalStellarViewer = StellarDodecahedronViewer;'
        )
        // Mock THREE and OrbitControls for basic functionality test
        .replace(
          /THREE\./g,
          '({Scene: function(){}, WebGLRenderer: function(){}, PerspectiveCamera: function(){}, BufferGeometry: function(){}, Points: function(){}, PointsMaterial: function(){}, Float32Array: Float32Array, Color: function(){}, Vector3: function(){}, Raycaster: function(){}, Vector2: function(){}, Math: {degToRad: function(d){return d*Math.PI/180}}, MOUSE: {LEFT:0}, TOUCH: {ROTATE:0}}).'
        )
        .replace(/OrbitControls/g, 'function OrbitControls(){}; OrbitControls');

      // Use Function constructor for safer eval
      const evalContext = new Function('window', modifiedScript);
      evalContext(window);

      this.results.push({
        method: 'Fetch + Eval Approach',
        success: !!window.EvalStellarViewer,
        timing: performance.now() - startTime,
        details: {
          stellarViewerType: typeof window.EvalStellarViewer,
        },
      });

      // Cleanup
      delete window.EvalStellarViewer;
    } catch (error) {
      this.results.push({
        method: 'Fetch + Eval Approach',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timing: performance.now() - startTime,
      });
    }
  }

  private loadScriptAsync(src: string, type?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      if (type) script.type = type;

      script.onload = () => {
        resolve();
      };

      script.onerror = error => {
        reject(new Error(`Failed to load ${src}`));
      };

      document.head.appendChild(script);
    });
  }

  getResults(): ModuleTestResult[] {
    return this.results;
  }

  getSuccessfulMethods(): ModuleTestResult[] {
    return this.results.filter(result => result.success);
  }

  exportResults(): string {
    return JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        results: this.results,
      },
      null,
      2
    );
  }
}
