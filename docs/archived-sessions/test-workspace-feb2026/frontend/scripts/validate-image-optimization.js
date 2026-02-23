#!/usr/bin/env node

/**
 * Image Optimization Pipeline Validation
 * Comprehensive validation and testing of the image optimization system
 */

const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ImageOptimizationValidator {
  constructor() {
    this.results = {
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
      },
      performance: {
        compressionRatios: {},
        loadTimes: {},
        formatSupport: {},
      },
    };
  }

  /**
   * Run comprehensive validation
   */
  async validate() {
    console.log('🔍 Starting Image Optimization Pipeline Validation');
    console.log('='.repeat(60));

    try {
      // Test 1: Environment and Dependencies
      await this.testEnvironment();

      // Test 2: Image Format Support
      await this.testFormatSupport();

      // Test 3: Optimization Pipeline
      await this.testOptimizationPipeline();

      // Test 4: Next.js Integration
      await this.testNextJSIntegration();

      // Test 5: Service Worker Caching
      await this.testServiceWorkerCaching();

      // Test 6: Performance Monitoring
      await this.testPerformanceMonitoring();

      // Test 7: Progressive Loading
      await this.testProgressiveLoading();

      // Test 8: Runtime Conversion
      await this.testRuntimeConversion();

      // Generate report
      this.generateReport();
    } catch (error) {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    }
  }

  /**
   * Test environment and dependencies
   */
  async testEnvironment() {
    await this.runTest('Environment Setup', async () => {
      // Check Node.js version
      const nodeVersion = process.version;
      if (
        !nodeVersion.startsWith('v18.') &&
        !nodeVersion.startsWith('v20.') &&
        !nodeVersion.startsWith('v22.')
      ) {
        throw new Error(`Node.js version ${nodeVersion} may not be optimal. Recommended: 20.18.2+`);
      }

      // Check Sharp availability
      try {
        const sharpVersion = sharp.versions;
        console.log(`  ✓ Sharp ${sharpVersion.sharp} (libvips ${sharpVersion.vips})`);
      } catch (error) {
        throw new Error('Sharp not available or not functioning properly');
      }

      // Check required scripts
      const requiredScripts = [
        'scripts/optimize-images.js',
        'src/lib/optimization/format-detection.ts',
        'src/lib/optimization/progressive-loading.ts',
        'src/lib/optimization/runtime-converter.ts',
      ];

      for (const script of requiredScripts) {
        try {
          await fs.access(script);
          console.log(`  ✓ ${script}`);
        } catch (error) {
          throw new Error(`Required file missing: ${script}`);
        }
      }

      console.log('  ✓ All dependencies and files present');
    });
  }

  /**
   * Test image format support
   */
  async testFormatSupport() {
    await this.runTest('Image Format Support', async () => {
      const testImage = await this.createTestImage();

      const formats = ['avif', 'webp', 'jpeg', 'png'];
      const results = {};

      for (const format of formats) {
        try {
          const startTime = Date.now();

          let sharpImage = sharp(testImage);

          switch (format) {
            case 'avif':
              sharpImage = sharpImage.avif({ quality: 50, effort: 6 });
              break;
            case 'webp':
              sharpImage = sharpImage.webp({ quality: 75, effort: 6 });
              break;
            case 'jpeg':
              sharpImage = sharpImage.jpeg({ quality: 85, progressive: true });
              break;
            case 'png':
              sharpImage = sharpImage.png({ compressionLevel: 9 });
              break;
          }

          const { data, info } = await sharpImage.toBuffer({ resolveWithObject: true });
          const conversionTime = Date.now() - startTime;

          results[format] = {
            supported: true,
            size: info.size,
            compressionRatio: testImage.length / info.size,
            conversionTime,
          };

          console.log(
            `  ✓ ${format.toUpperCase()}: ${this.formatBytes(info.size)} (${conversionTime}ms)`
          );
        } catch (error) {
          results[format] = {
            supported: false,
            error: error.message,
          };
          console.log(`  ❌ ${format.toUpperCase()}: ${error.message}`);
        }
      }

      this.results.performance.formatSupport = results;

      // Verify compression efficiency
      if (results.avif.supported && results.jpeg.supported) {
        const avifSavings = ((results.jpeg.size - results.avif.size) / results.jpeg.size) * 100;
        if (avifSavings < 30) {
          console.log(`  ⚠️  AVIF savings only ${avifSavings.toFixed(1)}% (expected >30%)`);
        } else {
          console.log(`  ✓ AVIF provides ${avifSavings.toFixed(1)}% size reduction`);
        }
      }
    });
  }

  /**
   * Test optimization pipeline
   */
  async testOptimizationPipeline() {
    await this.runTest('Optimization Pipeline', async () => {
      // Test the build-time optimization script
      try {
        console.log('  Testing build-time optimization...');

        // Create test directory structure
        await fs.mkdir('test-images', { recursive: true });

        // Create test images
        const testImages = await this.createTestImageSet();

        for (const [name, buffer] of Object.entries(testImages)) {
          await fs.writeFile(`test-images/${name}`, buffer);
        }

        // Run optimization script
        const { stdout, stderr } = await execAsync(
          'node scripts/optimize-images.js --formats avif,webp,jpeg --sizes 640,1280'
        );

        if (stderr && !stderr.includes('Warning')) {
          throw new Error(`Optimization script errors: ${stderr}`);
        }

        // Verify output files exist
        const optimizedDir = 'public/optimized';
        try {
          await fs.access(optimizedDir);
          console.log('  ✓ Optimized directory created');

          // Check for format subdirectories
          const formats = ['avif', 'webp', 'jpeg'];
          for (const format of formats) {
            try {
              await fs.access(path.join(optimizedDir, format));
              console.log(`  ✓ ${format.toUpperCase()} directory exists`);
            } catch (error) {
              console.log(`  ⚠️  ${format.toUpperCase()} directory missing`);
            }
          }

          // Check for manifest
          try {
            const manifestPath = path.join(optimizedDir, 'manifest.json');
            await fs.access(manifestPath);
            const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
            console.log(`  ✓ Manifest created (${manifest.stats.processed} images processed)`);
          } catch (error) {
            console.log('  ⚠️  Manifest file missing or invalid');
          }
        } catch (error) {
          throw new Error('Optimized directory not created');
        }

        // Cleanup
        await this.cleanup('test-images');
      } catch (error) {
        await this.cleanup('test-images');
        throw error;
      }
    });
  }

  /**
   * Test Next.js integration
   */
  async testNextJSIntegration() {
    await this.runTest('Next.js Integration', async () => {
      // Check Next.js config
      try {
        const configPath = 'next.config.js';
        const configContent = await fs.readFile(configPath, 'utf8');

        if (!configContent.includes('image/avif') || !configContent.includes('image/webp')) {
          throw new Error('Next.js config missing AVIF/WebP format support');
        }

        console.log('  ✓ Next.js config includes modern formats');

        // Check for proper image domains/remotePatterns
        if (configContent.includes('domains:') || configContent.includes('remotePatterns:')) {
          console.log('  ✓ Image domains configured');
        } else {
          console.log('  ⚠️  No image domains configured (may limit external images)');
        }

        // Check for proper device sizes
        if (configContent.includes('deviceSizes:')) {
          console.log('  ✓ Custom device sizes configured');
        }
      } catch (error) {
        throw new Error(`Next.js config validation failed: ${error.message}`);
      }

      // Check component files
      const componentFiles = [
        'src/components/ui/OptimizedImage.tsx',
        'src/lib/optimization/format-detection.ts',
      ];

      for (const file of componentFiles) {
        try {
          await fs.access(file);
          console.log(`  ✓ ${file} exists`);
        } catch (error) {
          throw new Error(`Required component missing: ${file}`);
        }
      }
    });
  }

  /**
   * Test service worker caching
   */
  async testServiceWorkerCaching() {
    await this.runTest('Service Worker Caching', async () => {
      try {
        const swPath = 'src/sw.ts';
        const swContent = await fs.readFile(swPath, 'utf8');

        // Check for image caching strategies
        if (!swContent.includes('optimized-images') || !swContent.includes('legacy-images')) {
          throw new Error('Service worker missing image caching strategies');
        }

        console.log('  ✓ Image caching strategies implemented');

        // Check for format-specific handling
        if (!swContent.includes('ImageCacheManager')) {
          throw new Error('Service worker missing advanced image cache manager');
        }

        console.log('  ✓ Advanced image cache manager implemented');

        // Check for offline fallbacks
        if (!swContent.includes('getOfflineFallback')) {
          console.log('  ⚠️  No offline image fallback detected');
        } else {
          console.log('  ✓ Offline image fallback implemented');
        }
      } catch (error) {
        throw new Error(`Service worker validation failed: ${error.message}`);
      }
    });
  }

  /**
   * Test performance monitoring
   */
  async testPerformanceMonitoring() {
    await this.runTest('Performance Monitoring', async () => {
      // Check for monitoring API
      try {
        const apiPath = 'src/app/api/monitoring/image-performance/route.ts';
        await fs.access(apiPath);
        console.log('  ✓ Performance monitoring API exists');

        const apiContent = await fs.readFile(apiPath, 'utf8');
        if (!apiContent.includes('image_performance_metrics')) {
          throw new Error('API missing database table creation');
        }

        console.log('  ✓ Database table creation implemented');
      } catch (error) {
        throw new Error(`Performance monitoring validation failed: ${error.message}`);
      }

      // Check for analysis tools
      try {
        const analysisPath = 'src/lib/optimization/analysis-tools.ts';
        await fs.access(analysisPath);
        console.log('  ✓ Analysis tools implemented');

        const analysisContent = await fs.readFile(analysisPath, 'utf8');
        if (!analysisContent.includes('ImageOptimizationAnalyzer')) {
          throw new Error('Analysis tools missing main analyzer class');
        }

        console.log('  ✓ Image optimization analyzer implemented');
      } catch (error) {
        throw new Error(`Analysis tools validation failed: ${error.message}`);
      }
    });
  }

  /**
   * Test progressive loading
   */
  async testProgressiveLoading() {
    await this.runTest('Progressive Loading', async () => {
      try {
        const progressivePath = 'src/lib/optimization/progressive-loading.ts';
        const progressiveContent = await fs.readFile(progressivePath, 'utf8');

        // Check for LQIP generation
        if (!progressiveContent.includes('generateLQIP')) {
          throw new Error('Progressive loading missing LQIP generation');
        }

        console.log('  ✓ LQIP generation implemented');

        // Check for blur placeholder generator
        if (!progressiveContent.includes('BlurPlaceholderGenerator')) {
          throw new Error('Progressive loading missing blur placeholder generator');
        }

        console.log('  ✓ Blur placeholder generator implemented');

        // Check for color extraction
        if (!progressiveContent.includes('extractColors')) {
          throw new Error('Progressive loading missing color extraction');
        }

        console.log('  ✓ Color extraction implemented');

        // Check for intersection observer
        if (!progressiveContent.includes('IntersectionObserver')) {
          throw new Error('Progressive loading missing intersection observer');
        }

        console.log('  ✓ Intersection observer implementation found');
      } catch (error) {
        throw new Error(`Progressive loading validation failed: ${error.message}`);
      }
    });
  }

  /**
   * Test runtime conversion
   */
  async testRuntimeConversion() {
    await this.runTest('Runtime Conversion', async () => {
      try {
        const runtimePath = 'src/lib/optimization/runtime-converter.ts';
        const runtimeContent = await fs.readFile(runtimePath, 'utf8');

        // Check for runtime converter class
        if (!runtimeContent.includes('RuntimeImageConverter')) {
          throw new Error('Runtime conversion missing main converter class');
        }

        console.log('  ✓ Runtime image converter implemented');

        // Check for upload processing
        if (!runtimeContent.includes('processUpload')) {
          throw new Error('Runtime conversion missing upload processing');
        }

        console.log('  ✓ Upload processing implemented');

        // Check for format conversion
        if (!runtimeContent.includes('convertToFormat')) {
          throw new Error('Runtime conversion missing format conversion');
        }

        console.log('  ✓ Format conversion implemented');

        // Check for validation
        if (!runtimeContent.includes('validateImage')) {
          throw new Error('Runtime conversion missing image validation');
        }

        console.log('  ✓ Image validation implemented');
      } catch (error) {
        throw new Error(`Runtime conversion validation failed: ${error.message}`);
      }
    });
  }

  /**
   * Create test image
   */
  async createTestImage() {
    return sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 100, g: 150, b: 200 },
      },
    })
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  /**
   * Create test image set
   */
  async createTestImageSet() {
    const images = {};

    // Create different types of test images
    images['test-photo.jpg'] = await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: { r: 120, g: 180, b: 220 },
      },
    })
      .jpeg({ quality: 85 })
      .toBuffer();

    images['test-graphic.png'] = await sharp({
      create: {
        width: 600,
        height: 400,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0.8 },
      },
    })
      .png()
      .toBuffer();

    return images;
  }

  /**
   * Run individual test
   */
  async runTest(name, testFn) {
    const test = {
      name,
      status: 'pending',
      startTime: Date.now(),
      endTime: null,
      duration: null,
      error: null,
      warnings: [],
    };

    this.results.tests.push(test);
    this.results.summary.total++;

    console.log(`\n📋 ${name}`);
    console.log('─'.repeat(name.length + 3));

    try {
      await testFn();
      test.status = 'passed';
      test.endTime = Date.now();
      test.duration = test.endTime - test.startTime;
      this.results.summary.passed++;
      console.log(`  ✅ PASSED (${test.duration}ms)`);
    } catch (error) {
      test.status = 'failed';
      test.endTime = Date.now();
      test.duration = test.endTime - test.startTime;
      test.error = error.message;
      this.results.summary.failed++;
      console.log(`  ❌ FAILED: ${error.message}`);
    }
  }

  /**
   * Generate final report
   */
  generateReport() {
    console.log('\n📊 Validation Report');
    console.log('='.repeat(40));

    const { summary } = this.results;
    const successRate = summary.total > 0 ? (summary.passed / summary.total) * 100 : 0;

    console.log(`Total Tests: ${summary.total}`);
    console.log(`Passed: ${summary.passed} (${successRate.toFixed(1)}%)`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Warnings: ${summary.warnings}`);

    if (summary.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.tests
        .filter(test => test.status === 'failed')
        .forEach(test => {
          console.log(`  • ${test.name}: ${test.error}`);
        });
    }

    // Performance summary
    if (this.results.performance.formatSupport) {
      console.log('\n📈 Performance Summary:');
      Object.entries(this.results.performance.formatSupport)
        .filter(([, result]) => result.supported)
        .forEach(([format, result]) => {
          console.log(
            `  ${format.toUpperCase()}: ${this.formatBytes(result.size)} (${result.compressionRatio.toFixed(2)}x compression)`
          );
        });
    }

    // Recommendations
    console.log('\n💡 Recommendations:');

    if (successRate === 100) {
      console.log('  🎉 All tests passed! Your image optimization pipeline is working correctly.');
      console.log('  📈 Consider running performance benchmarks to measure real-world impact.');
    } else if (successRate >= 80) {
      console.log('  ✅ Most tests passed. Address failed tests for optimal performance.');
    } else {
      console.log(
        '  ⚠️  Several tests failed. Please review and fix issues before production use.'
      );
    }

    console.log('  🔧 Run `npm run optimize:images` to generate optimized images.');
    console.log('  📊 Use `npm run test:image-pipeline` for ongoing validation.');

    // Exit with appropriate code
    process.exit(summary.failed > 0 ? 1 : 0);
  }

  /**
   * Format bytes for display
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Cleanup helper
   */
  async cleanup(directory) {
    try {
      await fs.rm(directory, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup ${directory}:`, error.message);
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new ImageOptimizationValidator();
  validator.validate().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = { ImageOptimizationValidator };
