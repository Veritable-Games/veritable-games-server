#!/usr/bin/env node

/**
 * Bundle Size Analyzer and Optimizer
 * Analyzes webpack bundle output and provides optimization recommendations
 */

const fs = require('fs');
const path = require('path');

class BundleAnalyzer {
  constructor() {
    this.buildPath = path.join(process.cwd(), '.next');
    this.staticPath = path.join(this.buildPath, 'static');
    this.thresholds = {
      pageSize: 250 * 1024, // 250KB max per page bundle
      chunkSize: 500 * 1024, // 500KB max per chunk
      totalJs: 2 * 1024 * 1024, // 2MB total JS threshold
      totalCss: 300 * 1024, // 300KB total CSS threshold
    };
  }

  async analyzeBuild() {
    console.log('📊 Starting Bundle Analysis');
    console.log('============================');

    if (!fs.existsSync(this.buildPath)) {
      console.error('❌ Build not found. Run `npm run build` first.');
      process.exit(1);
    }

    try {
      const analysis = {
        pages: this.analyzePages(),
        chunks: this.analyzeChunks(),
        assets: this.analyzeAssets(),
        dependencies: this.analyzeDependencies(),
      };

      this.generateReport(analysis);
      this.provideRecommendations(analysis);
    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      process.exit(1);
    }
  }

  analyzePages() {
    const pagesPath = path.join(this.staticPath, 'chunks', 'pages');
    if (!fs.existsSync(pagesPath)) return [];

    const pages = [];
    const files = fs.readdirSync(pagesPath, { recursive: true });

    for (const file of files) {
      if (file.endsWith('.js')) {
        const filePath = path.join(pagesPath, file);
        const stats = fs.statSync(filePath);
        const size = stats.size;

        pages.push({
          name: file,
          size,
          sizeKB: Math.round(size / 1024),
          oversized: size > this.thresholds.pageSize,
        });
      }
    }

    return pages.sort((a, b) => b.size - a.size);
  }

  analyzeChunks() {
    const chunksPath = path.join(this.staticPath, 'chunks');
    if (!fs.existsSync(chunksPath)) return [];

    const chunks = [];
    const files = fs.readdirSync(chunksPath, { recursive: true });

    for (const file of files) {
      if (file.endsWith('.js') && !file.includes('pages/')) {
        const filePath = path.join(chunksPath, file);
        const stats = fs.statSync(filePath);
        const size = stats.size;

        chunks.push({
          name: file,
          size,
          sizeKB: Math.round(size / 1024),
          oversized: size > this.thresholds.chunkSize,
          type: this.categorizeChunk(file),
        });
      }
    }

    return chunks.sort((a, b) => b.size - a.size);
  }

  analyzeAssets() {
    const jsFiles = this.getAssetsByType('.js');
    const cssFiles = this.getAssetsByType('.css');

    const totalJs = jsFiles.reduce((sum, file) => sum + file.size, 0);
    const totalCss = cssFiles.reduce((sum, file) => sum + file.size, 0);

    return {
      javascript: {
        files: jsFiles,
        totalSize: totalJs,
        totalKB: Math.round(totalJs / 1024),
        oversized: totalJs > this.thresholds.totalJs,
      },
      css: {
        files: cssFiles,
        totalSize: totalCss,
        totalKB: Math.round(totalCss / 1024),
        oversized: totalCss > this.thresholds.totalCss,
      },
    };
  }

  analyzeDependencies() {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

      const heavyDependencies = this.identifyHeavyDependencies(packageJson.dependencies);

      return {
        heavy: heavyDependencies,
        total: Object.keys(packageJson.dependencies || {}).length,
      };
    } catch (error) {
      console.warn('⚠️  Could not analyze dependencies:', error.message);
      return { heavy: [], total: 0 };
    }
  }

  getAssetsByType(extension) {
    const files = [];

    try {
      const walkDir = dir => {
        const items = fs.readdirSync(dir, { withFileTypes: true });

        for (const item of items) {
          const fullPath = path.join(dir, item.name);

          if (item.isDirectory()) {
            walkDir(fullPath);
          } else if (item.name.endsWith(extension)) {
            const stats = fs.statSync(fullPath);
            files.push({
              name: path.relative(this.staticPath, fullPath),
              size: stats.size,
              sizeKB: Math.round(stats.size / 1024),
            });
          }
        }
      };

      walkDir(this.staticPath);
    } catch (error) {
      console.warn(`⚠️  Could not analyze ${extension} files:`, error.message);
    }

    return files.sort((a, b) => b.size - a.size);
  }

  categorizeChunk(filename) {
    if (filename.includes('vendor')) return 'vendor';
    if (filename.includes('three')) return 'threejs';
    if (filename.includes('markdown')) return 'markdown';
    if (filename.includes('editor')) return 'editor';
    if (filename.includes('state')) return 'state-management';
    if (filename.includes('data')) return 'data-fetching';
    if (filename.includes('utils')) return 'utilities';
    return 'application';
  }

  identifyHeavyDependencies(dependencies) {
    const knownHeavy = [
      'three',
      'react-markdown',
      'lodash',
      '@tanstack/react-query',
      'socket.io-client',
      'better-sqlite3',
      'marked',
      'dompurify',
    ];

    return Object.keys(dependencies).filter(dep => knownHeavy.some(heavy => dep.includes(heavy)));
  }

  generateReport(analysis) {
    console.log('\n📈 Bundle Analysis Report');
    console.log('=========================');

    // Page bundles
    console.log('\n📄 Page Bundles:');
    analysis.pages.slice(0, 10).forEach(page => {
      const status = page.oversized ? '🔴' : '🟢';
      console.log(`  ${status} ${page.name}: ${page.sizeKB}KB`);
    });

    // Chunks
    console.log('\n🧩 Code Chunks:');
    analysis.chunks.slice(0, 10).forEach(chunk => {
      const status = chunk.oversized ? '🔴' : '🟢';
      console.log(`  ${status} ${chunk.name}: ${chunk.sizeKB}KB (${chunk.type})`);
    });

    // Asset totals
    console.log('\n📦 Asset Totals:');
    const jsStatus = analysis.assets.javascript.oversized ? '🔴' : '🟢';
    const cssStatus = analysis.assets.css.oversized ? '🔴' : '🟢';

    console.log(`  ${jsStatus} JavaScript: ${analysis.assets.javascript.totalKB}KB`);
    console.log(`  ${cssStatus} CSS: ${analysis.assets.css.totalKB}KB`);

    // Dependencies
    console.log('\n📚 Dependencies:');
    console.log(`  Total packages: ${analysis.dependencies.total}`);
    console.log(`  Heavy packages: ${analysis.dependencies.heavy.join(', ')}`);

    // Performance score
    const score = this.calculateScore(analysis);
    console.log(`\n🏆 Performance Score: ${score}/100`);

    // Write JSON file for CI/CD pipeline
    this.writeJsonReport(analysis, score);
  }

  writeJsonReport(analysis, score) {
    const jsonReport = {
      timestamp: new Date().toISOString(),
      score,
      totalSize: analysis.assets.javascript.totalSize + analysis.assets.css.totalSize,
      jsSize: analysis.assets.javascript.totalSize,
      cssSize: analysis.assets.css.totalSize,
      chunks: analysis.chunks,
      pages: analysis.pages,
      summary: {
        oversizedPages: analysis.pages.filter(p => p.oversized).length,
        oversizedChunks: analysis.chunks.filter(c => c.oversized).length,
        totalPages: analysis.pages.length,
        totalChunks: analysis.chunks.length,
        heavyDependencies: analysis.dependencies.heavy,
      },
    };

    const outputPath = path.join(process.cwd(), 'bundle-analysis.json');
    fs.writeFileSync(outputPath, JSON.stringify(jsonReport, null, 2), 'utf8');
    console.log(`\n✅ Bundle analysis written to: ${outputPath}`);
  }

  calculateScore(analysis) {
    let score = 100;

    // Deduct for oversized pages
    const oversizedPages = analysis.pages.filter(p => p.oversized).length;
    score -= oversizedPages * 10;

    // Deduct for oversized chunks
    const oversizedChunks = analysis.chunks.filter(c => c.oversized).length;
    score -= oversizedChunks * 5;

    // Deduct for total asset size
    if (analysis.assets.javascript.oversized) score -= 20;
    if (analysis.assets.css.oversized) score -= 10;

    // Deduct for heavy dependencies
    score -= analysis.dependencies.heavy.length * 2;

    return Math.max(0, score);
  }

  provideRecommendations(analysis) {
    console.log('\n💡 Optimization Recommendations');
    console.log('================================');

    const recommendations = [];

    // Page bundle recommendations
    const oversizedPages = analysis.pages.filter(p => p.oversized);
    if (oversizedPages.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Page Bundles',
        issue: `${oversizedPages.length} pages exceed 250KB limit`,
        solutions: [
          'Implement dynamic imports for heavy components',
          'Split large pages into smaller components',
          'Use lazy loading for non-critical features',
        ],
      });
    }

    // Output recommendations
    if (recommendations.length === 0) {
      console.log('🎉 No major issues found! Bundle is well optimized.');
      return;
    }

    recommendations.forEach((rec, index) => {
      console.log(`\n${index + 1}. [${rec.priority}] ${rec.category}`);
      console.log(`   Issue: ${rec.issue}`);
      console.log('   Solutions:');
      rec.solutions.forEach(solution => {
        console.log(`   • ${solution}`);
      });
    });
  }
}

async function main() {
  const analyzer = new BundleAnalyzer();
  await analyzer.analyzeBuild();
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { BundleAnalyzer };
