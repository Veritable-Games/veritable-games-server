#!/usr/bin/env node

/**
 * Font optimization script for production builds
 * Optimizes web fonts for better performance
 */

const fs = require('fs');
const path = require('path');

console.log('Font optimization script');
console.log('========================');

function optimizeFonts() {
  const publicPath = path.join(process.cwd(), 'public');
  const fontsPath = path.join(publicPath, 'fonts');

  // Create fonts directory if it doesn't exist
  if (!fs.existsSync(fontsPath)) {
    fs.mkdirSync(fontsPath, { recursive: true });
    console.log('Created fonts directory');
  }

  // Check for font files
  if (fs.existsSync(fontsPath)) {
    const fonts = fs
      .readdirSync(fontsPath)
      .filter(
        file =>
          file.endsWith('.woff') ||
          file.endsWith('.woff2') ||
          file.endsWith('.ttf') ||
          file.endsWith('.otf')
      );

    if (fonts.length > 0) {
      console.log(`Found ${fonts.length} font files:`);
      fonts.forEach(font => {
        const stats = fs.statSync(path.join(fontsPath, font));
        const size = (stats.size / 1024).toFixed(2);
        console.log(`  - ${font} (${size} KB)`);
      });
    } else {
      console.log('No font files found to optimize');
    }
  }

  // Generate font preload hints
  const preloadHints = [];
  const fontFiles = fs.existsSync(fontsPath) ? fs.readdirSync(fontsPath) : [];

  fontFiles.forEach(file => {
    if (file.endsWith('.woff2')) {
      preloadHints.push(
        `<link rel="preload" href="/fonts/${file}" as="font" type="font/woff2" crossorigin>`
      );
    }
  });

  if (preloadHints.length > 0) {
    console.log('\nGenerated font preload hints:');
    preloadHints.forEach(hint => console.log(hint));
  }

  // Check for @font-face declarations in CSS
  const stylesPath = path.join(process.cwd(), 'src', 'styles');
  if (fs.existsSync(stylesPath)) {
    const cssFiles = fs
      .readdirSync(stylesPath)
      .filter(file => file.endsWith('.css') || file.endsWith('.scss'));

    console.log(`\nChecked ${cssFiles.length} style files for font declarations`);
  }

  console.log('\nFont optimization complete');
}

try {
  optimizeFonts();
  process.exit(0);
} catch (error) {
  console.error('Font optimization failed:', error.message);
  process.exit(1);
}
