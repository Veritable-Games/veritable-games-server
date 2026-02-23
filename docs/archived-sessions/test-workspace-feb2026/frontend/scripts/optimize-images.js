#!/usr/bin/env node

/**
 * Build-time Image Optimization Pipeline
 * Generates AVIF/WebP versions and optimized sizes for all images
 */

const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const { promisify } = require('util');
const { exec } = require('child_process');

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
  inputDirs: ['public', 'src/assets'],
  outputDir: 'public/optimized',
  formats: ['avif', 'webp', 'jpeg'],
  sizes: [640, 768, 1024, 1280, 1600, 1920],
  qualities: {
    avif: 50, // AVIF can use lower quality due to better compression
    webp: 75, // WebP standard quality
    jpeg: 85, // JPEG fallback quality
    png: 90, // PNG quality for images with transparency
  },
  enableProgressive: true,
  enableLossless: false,
  skipPatterns: [
    '**/node_modules/**',
    '**/coverage/**',
    '**/*.ico',
    '**/*.svg', // SVG optimization handled separately
  ],
  compressionLevels: {
    avif: 6, // 0-9, higher = better compression, slower
    webp: 6, // 0-6, higher = better compression, slower
    png: 9, // 0-9, higher = better compression, slower
  },
};

class ImageOptimizer {
  constructor() {
    this.stats = {
      processed: 0,
      saved: 0,
      errors: 0,
      totalOriginalSize: 0,
      totalOptimizedSize: 0,
      formatStats: {},
    };
    this.processedFiles = new Set();
  }

  /**
   * Main optimization function
   */
  async optimize() {
    console.log('🖼️  Starting build-time image optimization...');
    console.log(`📁 Input directories: ${CONFIG.inputDirs.join(', ')}`);
    console.log(`📤 Output directory: ${CONFIG.outputDir}`);
    console.log(`🎯 Target formats: ${CONFIG.formats.join(', ')}`);
    console.log(`📏 Breakpoint sizes: ${CONFIG.sizes.join(', ')}`);

    try {
      // Ensure output directory exists
      await this.ensureOutputDir();

      // Find all images
      const imageFiles = await this.findImages();
      console.log(`📊 Found ${imageFiles.length} images to process`);

      if (imageFiles.length === 0) {
        console.log('ℹ️  No images found to optimize');
        return;
      }

      // Process images in batches to avoid memory issues
      const batchSize = 10;
      for (let i = 0; i < imageFiles.length; i += batchSize) {
        const batch = imageFiles.slice(i, i + batchSize);
        await Promise.all(batch.map(file => this.processImage(file)));

        const progress = Math.round(((i + batchSize) / imageFiles.length) * 100);
        console.log(
          `📈 Progress: ${Math.min(progress, 100)}% (${Math.min(i + batchSize, imageFiles.length)}/${imageFiles.length})`
        );
      }

      // Generate manifest
      await this.generateManifest();

      // Generate TypeScript types
      await this.generateTypes();

      // Display statistics
      this.displayStats();
    } catch (error) {
      console.error('❌ Optimization failed:', error);
      process.exit(1);
    }
  }

  /**
   * Ensure output directory exists
   */
  async ensureOutputDir() {
    try {
      await fs.access(CONFIG.outputDir);
    } catch {
      await fs.mkdir(CONFIG.outputDir, { recursive: true });
    }

    // Create subdirectories for each format
    for (const format of CONFIG.formats) {
      const formatDir = path.join(CONFIG.outputDir, format);
      try {
        await fs.access(formatDir);
      } catch {
        await fs.mkdir(formatDir, { recursive: true });
      }
    }
  }

  /**
   * Find all images to process
   */
  async findImages() {
    const files = [];

    for (const inputDir of CONFIG.inputDirs) {
      try {
        await fs.access(inputDir);
        const dirFiles = await this.findImagesInDirectory(inputDir);
        files.push(...dirFiles);
      } catch (error) {
        console.warn(`Directory ${inputDir} not found, skipping...`);
      }
    }

    return files.filter(file => {
      // Skip already optimized files
      return (
        !file.includes('/optimized/') &&
        !file.includes('node_modules') &&
        !file.includes('coverage')
      );
    });
  }

  /**
   * Recursively find images in directory
   */
  async findImagesInDirectory(dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip certain directories
        if (['node_modules', 'coverage', '.next', '.git', 'optimized'].includes(entry.name)) {
          continue;
        }
        const subFiles = await this.findImagesInDirectory(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tiff', '.bmp'].includes(ext)) {
          files.push(path.resolve(fullPath));
        }
      }
    }

    return files;
  }

  /**
   * Process individual image
   */
  async processImage(filePath) {
    try {
      const fileName = path.basename(filePath, path.extname(filePath));
      const relativePath = path.relative(process.cwd(), filePath);

      console.log(`🔄 Processing: ${relativePath}`);

      // Get image metadata
      const metadata = await this.getImageMetadata(filePath);

      // Skip very small images
      if (metadata.width < 100 || metadata.height < 100) {
        console.log(
          `⏭️  Skipping small image: ${relativePath} (${metadata.width}x${metadata.height})`
        );
        return;
      }

      const originalStats = await fs.stat(filePath);
      this.stats.totalOriginalSize += originalStats.size;

      // Generate optimized versions for each format and size
      const optimizedVersions = [];

      for (const format of CONFIG.formats) {
        // Skip if format is same as original and not explicitly requested
        if (format === metadata.format && !CONFIG.enableLossless) {
          continue;
        }

        for (const size of CONFIG.sizes) {
          // Skip if size is larger than original
          if (size > Math.max(metadata.width, metadata.height)) {
            continue;
          }

          const outputPath = path.join(CONFIG.outputDir, format, `${fileName}-${size}w.${format}`);

          // Skip if already exists and newer than source
          if (await this.isUpToDate(filePath, outputPath)) {
            continue;
          }

          const optimizedSize = await this.optimizeImage(
            filePath,
            outputPath,
            format,
            size,
            metadata
          );

          if (optimizedSize > 0) {
            optimizedVersions.push({
              format,
              size,
              path: outputPath,
              fileSize: optimizedSize,
            });

            this.stats.totalOptimizedSize += optimizedSize;
            this.updateFormatStats(format, originalStats.size, optimizedSize);
          }
        }

        // Also create full-size optimized version
        const fullSizeOutput = path.join(CONFIG.outputDir, format, `${fileName}.${format}`);

        if (!(await this.isUpToDate(filePath, fullSizeOutput))) {
          const optimizedSize = await this.optimizeImage(
            filePath,
            fullSizeOutput,
            format,
            Math.max(metadata.width, metadata.height),
            metadata
          );

          if (optimizedSize > 0) {
            optimizedVersions.push({
              format,
              size: 'original',
              path: fullSizeOutput,
              fileSize: optimizedSize,
            });

            this.stats.totalOptimizedSize += optimizedSize;
            this.updateFormatStats(format, originalStats.size, optimizedSize);
          }
        }
      }

      // Generate LQIP (Low Quality Image Placeholder)
      await this.generateLQIP(filePath, fileName, metadata);

      this.stats.processed++;
      this.stats.saved += optimizedVersions.length;

      console.log(`✅ Optimized: ${relativePath} (${optimizedVersions.length} versions)`);
    } catch (error) {
      console.error(`❌ Failed to process ${filePath}:`, error.message);
      this.stats.errors++;
    }
  }

  /**
   * Get image metadata
   */
  async getImageMetadata(filePath) {
    const image = sharp(filePath);
    const metadata = await image.metadata();

    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      hasAlpha: metadata.hasAlpha,
      density: metadata.density,
      colorSpace: metadata.space,
    };
  }

  /**
   * Check if optimized image is up to date
   */
  async isUpToDate(sourcePath, outputPath) {
    try {
      const [sourceStats, outputStats] = await Promise.all([
        fs.stat(sourcePath),
        fs.stat(outputPath),
      ]);

      return outputStats.mtime > sourceStats.mtime;
    } catch {
      return false;
    }
  }

  /**
   * Optimize single image
   */
  async optimizeImage(inputPath, outputPath, format, size, metadata) {
    try {
      let image = sharp(inputPath);

      // Resize if needed
      if (typeof size === 'number') {
        image = image.resize({
          width: size,
          height: size,
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      // Apply format-specific optimizations
      switch (format) {
        case 'avif':
          image = image.avif({
            quality: CONFIG.qualities.avif,
            effort: CONFIG.compressionLevels.avif,
            chromaSubsampling: '4:2:0',
          });
          break;

        case 'webp':
          image = image.webp({
            quality: CONFIG.qualities.webp,
            effort: CONFIG.compressionLevels.webp,
            smartSubsample: true,
          });
          break;

        case 'jpeg':
          image = image.jpeg({
            quality: CONFIG.qualities.jpeg,
            progressive: CONFIG.enableProgressive,
            mozjpeg: true,
          });
          break;

        case 'png':
          image = image.png({
            quality: CONFIG.qualities.png,
            compressionLevel: CONFIG.compressionLevels.png,
            progressive: CONFIG.enableProgressive,
          });
          break;

        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      // Ensure output directory exists
      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      // Save optimized image
      await image.toFile(outputPath);

      // Get file size
      const stats = await fs.stat(outputPath);
      return stats.size;
    } catch (error) {
      console.error(`Failed to optimize ${inputPath} to ${format}:`, error.message);
      return 0;
    }
  }

  /**
   * Generate LQIP (Low Quality Image Placeholder)
   */
  async generateLQIP(inputPath, fileName, metadata) {
    try {
      const lqipPath = path.join(CONFIG.outputDir, 'lqip', `${fileName}-lqip.webp`);

      // Ensure LQIP directory exists
      await fs.mkdir(path.dirname(lqipPath), { recursive: true });

      // Skip if already exists and newer
      if (await this.isUpToDate(inputPath, lqipPath)) {
        return;
      }

      await sharp(inputPath)
        .resize(40, 40, { fit: 'inside' })
        .blur(2)
        .webp({ quality: 10 })
        .toFile(lqipPath);
    } catch (error) {
      console.warn(`Failed to generate LQIP for ${fileName}:`, error.message);
    }
  }

  /**
   * Update format statistics
   */
  updateFormatStats(format, originalSize, optimizedSize) {
    if (!this.stats.formatStats[format]) {
      this.stats.formatStats[format] = {
        count: 0,
        originalSize: 0,
        optimizedSize: 0,
        savings: 0,
      };
    }

    const stats = this.stats.formatStats[format];
    stats.count++;
    stats.originalSize += originalSize;
    stats.optimizedSize += optimizedSize;
    stats.savings = ((stats.originalSize - stats.optimizedSize) / stats.originalSize) * 100;
  }

  /**
   * Generate optimization manifest
   */
  async generateManifest() {
    const manifestPath = path.join(CONFIG.outputDir, 'manifest.json');

    const manifest = {
      generatedAt: new Date().toISOString(),
      config: CONFIG,
      stats: this.stats,
      version: '1.0.0',
    };

    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`📄 Generated manifest: ${manifestPath}`);
  }

  /**
   * Generate TypeScript types for optimized images
   */
  async generateTypes() {
    const typesPath = path.join('src', 'types', 'optimized-images.d.ts');

    const typeDefinitions = `
/**
 * Auto-generated TypeScript types for optimized images
 * Generated at: ${new Date().toISOString()}
 */

export interface OptimizedImageSources {
  avif?: string;
  webp?: string;
  jpeg?: string;
  png?: string;
  fallback: string;
}

export interface OptimizedImageSizes {
  ${CONFIG.sizes.map(size => `'${size}w': OptimizedImageSources;`).join('\n  ')}
  original: OptimizedImageSources;
}

export interface ImageOptimizationManifest {
  generatedAt: string;
  config: typeof import('../../scripts/optimize-images').CONFIG;
  stats: {
    processed: number;
    saved: number;
    errors: number;
    totalOriginalSize: number;
    totalOptimizedSize: number;
    formatStats: Record<string, {
      count: number;
      originalSize: number;
      optimizedSize: number;
      savings: number;
    }>;
  };
  version: string;
}

declare module '*.jpg' {
  const value: OptimizedImageSizes;
  export default value;
}

declare module '*.jpeg' {
  const value: OptimizedImageSizes;
  export default value;
}

declare module '*.png' {
  const value: OptimizedImageSizes;
  export default value;
}

declare module '*.webp' {
  const value: OptimizedImageSizes;
  export default value;
}

declare module '*.avif' {
  const value: OptimizedImageSizes;
  export default value;
}
`.trim();

    // Ensure types directory exists
    await fs.mkdir(path.dirname(typesPath), { recursive: true });
    await fs.writeFile(typesPath, typeDefinitions);
    console.log(`📝 Generated types: ${typesPath}`);
  }

  /**
   * Display optimization statistics
   */
  displayStats() {
    console.log('\n📊 Optimization Statistics:');
    console.log('═'.repeat(50));
    console.log(`📁 Images processed: ${this.stats.processed}`);
    console.log(`💾 Optimized versions created: ${this.stats.saved}`);
    console.log(`❌ Errors: ${this.stats.errors}`);

    const totalSavings = this.stats.totalOriginalSize - this.stats.totalOptimizedSize;
    const savingsPercent =
      this.stats.totalOriginalSize > 0
        ? ((totalSavings / this.stats.totalOriginalSize) * 100).toFixed(1)
        : 0;

    console.log(`💰 Total size reduction: ${this.formatBytes(totalSavings)} (${savingsPercent}%)`);
    console.log(`📏 Original total size: ${this.formatBytes(this.stats.totalOriginalSize)}`);
    console.log(`📏 Optimized total size: ${this.formatBytes(this.stats.totalOptimizedSize)}`);

    console.log('\n📈 Format Statistics:');
    console.log('─'.repeat(50));

    for (const [format, stats] of Object.entries(this.stats.formatStats)) {
      console.log(`${format.toUpperCase()}:`);
      console.log(`  📊 Files: ${stats.count}`);
      console.log(
        `  💾 Savings: ${this.formatBytes(stats.originalSize - stats.optimizedSize)} (${stats.savings.toFixed(1)}%)`
      );
      console.log(`  📏 Avg size: ${this.formatBytes(stats.optimizedSize / stats.count)}`);
    }

    console.log('\n🎉 Image optimization completed successfully!');
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
}

// CLI execution
if (require.main === module) {
  const optimizer = new ImageOptimizer();

  // Handle CLI arguments
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Image Optimization Pipeline

Usage: node optimize-images.js [options]

Options:
  --help, -h        Show this help message
  --clean          Clean output directory before optimization
  --formats        Comma-separated list of formats (default: avif,webp,jpeg)
  --sizes          Comma-separated list of sizes (default: 640,768,1024,1280,1600,1920)
  --quality-avif   AVIF quality (0-100, default: 50)
  --quality-webp   WebP quality (0-100, default: 75)
  --quality-jpeg   JPEG quality (0-100, default: 85)

Examples:
  node optimize-images.js
  node optimize-images.js --clean
  node optimize-images.js --formats avif,webp --sizes 640,1280
  node optimize-images.js --quality-avif 60 --quality-webp 80
    `);
    process.exit(0);
  }

  // Parse CLI options
  if (args.includes('--clean')) {
    console.log('🧹 Cleaning output directory...');
    const rimraf = require('rimraf');
    rimraf.sync(CONFIG.outputDir);
  }

  if (args.includes('--formats')) {
    const formatIndex = args.indexOf('--formats');
    if (formatIndex !== -1 && args[formatIndex + 1]) {
      CONFIG.formats = args[formatIndex + 1].split(',');
    }
  }

  if (args.includes('--sizes')) {
    const sizeIndex = args.indexOf('--sizes');
    if (sizeIndex !== -1 && args[sizeIndex + 1]) {
      CONFIG.sizes = args[sizeIndex + 1].split(',').map(Number);
    }
  }

  // Quality options
  ['avif', 'webp', 'jpeg'].forEach(format => {
    const arg = `--quality-${format}`;
    if (args.includes(arg)) {
      const qualityIndex = args.indexOf(arg);
      if (qualityIndex !== -1 && args[qualityIndex + 1]) {
        CONFIG.qualities[format] = parseInt(args[qualityIndex + 1]);
      }
    }
  });

  // Run optimization
  optimizer.optimize().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { ImageOptimizer, CONFIG };
