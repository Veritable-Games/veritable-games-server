/**
 * Enhanced Stellar Generation and Processing Web Worker
 * Handles star field generation, spectral classification, and astronomical data processing
 * Optimized for batch processing with scientific accuracy
 */

class StellarGeneratorWorker {
  constructor() {
    this.starCache = new Map();
    this.spectrumCache = new Map();
    this.magnitudeDistribution = new Map();

    // Initialize stellar classification system
    this.initializeSpectralSystem();
    this.initializeLuminosityDistribution();

    console.log('⭐ StellarGeneratorWorker initialized with Morgan-Keenan system');
  }

  /**
   * Initialize Morgan-Keenan spectral classification system
   * O, B, A, F, G, K, M with luminosity classes I-V
   */
  initializeSpectralSystem() {
    this.spectralTypes = {
      O: {
        frequency: 0.00003, // 0.003% - Very rare blue supergiants
        tempRange: [30000, 50000],
        colorIndex: { bv: -0.3, ub: -1.2 },
        baseColor: [157, 180, 255], // Hot blue-white
        luminosityClasses: {
          I: { frequency: 0.1, absoluteMag: -6.0 }, // Supergiants
          III: { frequency: 0.3, absoluteMag: -4.5 }, // Giants
          V: { frequency: 0.6, absoluteMag: -3.0 }, // Main sequence
        },
      },
      B: {
        frequency: 0.13, // 13% - Blue stars
        tempRange: [10000, 30000],
        colorIndex: { bv: -0.2, ub: -0.5 },
        baseColor: [162, 185, 255], // Blue-white
        luminosityClasses: {
          I: { frequency: 0.05, absoluteMag: -5.5 },
          III: { frequency: 0.15, absoluteMag: -2.0 },
          V: { frequency: 0.8, absoluteMag: -1.0 },
        },
      },
      A: {
        frequency: 0.6, // 6% - White stars
        tempRange: [7500, 10000],
        colorIndex: { bv: 0.0, ub: 0.0 },
        baseColor: [213, 224, 255], // White
        luminosityClasses: {
          III: { frequency: 0.1, absoluteMag: 0.5 },
          IV: { frequency: 0.2, absoluteMag: 1.5 }, // Sub-giants
          V: { frequency: 0.7, absoluteMag: 2.0 },
        },
      },
      F: {
        frequency: 3.0, // 3% - Yellow-white stars
        tempRange: [6000, 7500],
        colorIndex: { bv: 0.3, ub: 0.1 },
        baseColor: [249, 245, 255], // Yellow-white
        luminosityClasses: {
          IV: { frequency: 0.15, absoluteMag: 2.5 },
          V: { frequency: 0.85, absoluteMag: 3.5 },
        },
      },
      G: {
        frequency: 7.6, // 7.6% - Yellow stars (like our Sun)
        tempRange: [5200, 6000],
        colorIndex: { bv: 0.6, ub: 0.2 },
        baseColor: [255, 244, 234], // Yellow
        luminosityClasses: {
          III: { frequency: 0.05, absoluteMag: 1.0 },
          IV: { frequency: 0.15, absoluteMag: 3.5 },
          V: { frequency: 0.8, absoluteMag: 4.8 }, // Sun-like
        },
      },
      K: {
        frequency: 12.1, // 12.1% - Orange stars
        tempRange: [3700, 5200],
        colorIndex: { bv: 1.0, ub: 0.5 },
        baseColor: [255, 210, 161], // Orange
        luminosityClasses: {
          III: { frequency: 0.1, absoluteMag: 0.5 },
          IV: { frequency: 0.1, absoluteMag: 5.0 },
          V: { frequency: 0.8, absoluteMag: 7.0 },
        },
      },
      M: {
        frequency: 76.45, // 76.45% - Red dwarfs (most common)
        tempRange: [2400, 3700],
        colorIndex: { bv: 1.5, ub: 1.2 },
        baseColor: [255, 204, 111], // Red-orange
        luminosityClasses: {
          I: { frequency: 0.001, absoluteMag: -7.0 }, // Red supergiants
          III: { frequency: 0.009, absoluteMag: -1.0 },
          V: { frequency: 0.99, absoluteMag: 12.0 }, // Red dwarfs
        },
      },
    };

    // Create cumulative frequency distribution for efficient sampling
    this.spectralCumulative = [];
    let cumulative = 0;
    for (const [type, data] of Object.entries(this.spectralTypes)) {
      cumulative += data.frequency;
      this.spectralCumulative.push({ type, cumulative });
    }
  }

  /**
   * Initialize realistic magnitude distribution
   * Based on Gaia catalog statistics
   */
  initializeLuminosityDistribution() {
    // Magnitude distribution (apparent magnitude for distance ~100pc sample)
    this.magnitudeDistribution = new Map([
      [-1.5, 0.001], // Brightest stars (Sirius, etc.)
      [0.0, 0.005], // Bright stars
      [1.0, 0.01], // First magnitude
      [2.0, 0.02],
      [3.0, 0.05],
      [4.0, 0.1],
      [5.0, 0.2], // Naked eye limit
      [6.0, 0.35], // Binocular limit
      [7.0, 0.15],
      [8.0, 0.08],
      [9.0, 0.05],
      [10.0, 0.03],
      [11.0, 0.02],
      [12.0, 0.015],
      [13.0, 0.01],
      [14.0, 0.005],
      [15.0, 0.002], // Faintest stars
    ]);
  }

  /**
   * Generate a single star with scientific accuracy
   */
  generateStar(id, basePosition = null) {
    // Select spectral type based on frequency distribution
    const rand = Math.random() * 100; // Convert to percentage
    let selectedType = 'M'; // Default to most common

    for (const { type, cumulative } of this.spectralCumulative) {
      if (rand <= cumulative) {
        selectedType = type;
        break;
      }
    }

    const spectralData = this.spectralTypes[selectedType];

    // Select luminosity class
    const lumRand = Math.random();
    let luminosityClass = 'V'; // Default main sequence
    let lumCumulative = 0;

    for (const [cls, data] of Object.entries(spectralData.luminosityClasses)) {
      lumCumulative += data.frequency;
      if (lumRand <= lumCumulative) {
        luminosityClass = cls;
        break;
      }
    }

    const lumData = spectralData.luminosityClasses[luminosityClass];

    // Calculate stellar properties
    const temperature = this.interpolateTemperature(spectralData.tempRange);
    const absoluteMagnitude = this.calculateAbsoluteMagnitude(lumData.absoluteMag);
    const distance = this.generateRealisticDistance();
    const apparentMagnitude = absoluteMagnitude + 5 * Math.log10(distance) - 5;

    // Position generation
    let position;
    if (basePosition) {
      // Use provided position (for catalog stars)
      position = { ...basePosition };
    } else {
      // Generate random celestial coordinates
      const ra = Math.random() * 2 * Math.PI; // 0 to 2π radians
      const dec = Math.asin(2 * Math.random() - 1); // -π/2 to π/2 radians
      position = this.convertRADecToCartesian(ra, dec, distance);
    }

    // Color calculation using blackbody radiation
    const color = this.calculateStellarColor(temperature, spectralData.baseColor);

    // Variable star properties (some stars are variable)
    const variability = this.generateVariability(selectedType, luminosityClass);

    return {
      id,
      spectralType: selectedType,
      luminosityClass,
      temperature,
      absoluteMagnitude,
      apparentMagnitude,
      distance,
      position,
      color,
      variability,
      catalog: {
        designation: `HD ${100000 + id}`, // Mock catalog designation
        properMotion: this.generateProperMotion(),
        parallax: 1000 / distance, // milliarcseconds
        radialVelocity: (Math.random() - 0.5) * 100, // km/s
      },
    };
  }

  /**
   * Generate realistic distance distribution
   * Models local stellar neighborhood density
   */
  generateRealisticDistance() {
    // Exponential decrease in density with distance
    // Most stars within ~100 parsecs, with tail to ~1000 parsecs
    const u1 = Math.random();
    const u2 = Math.random();

    // Use mixture of two exponential distributions
    if (u1 < 0.8) {
      // Local stars (80% within 100pc)
      return 10 + -Math.log(u2) * 30;
    } else {
      // Distant stars (20% from 100-1000pc)
      return 100 + -Math.log(u2) * 300;
    }
  }

  /**
   * Convert RA/Dec coordinates to 3D Cartesian
   */
  convertRADecToCartesian(ra, dec, distance) {
    // Scale distance for visualization (1 unit = 0.1 parsec)
    const scaledDistance = distance * 0.1;

    return {
      x: scaledDistance * Math.cos(dec) * Math.cos(ra),
      y: scaledDistance * Math.cos(dec) * Math.sin(ra),
      z: scaledDistance * Math.sin(dec),
    };
  }

  /**
   * Calculate stellar color using temperature and spectral data
   */
  calculateStellarColor(temperature, baseColor) {
    // Mitchell Charity algorithm for blackbody color
    const t = temperature;
    let r, g, b;

    if (t >= 6600) {
      r = 255;
      g = Math.min(255, 99.4708025861 * Math.pow(t / 100 - 60, -0.1332047592));
      b = Math.min(255, 138.5177312231 * Math.pow(t / 100 - 60, -0.0755148492));
    } else if (t >= 3400) {
      r = Math.min(255, 329.698727446 * Math.pow(t / 100 - 60, -0.1332047592));
      g = Math.min(255, 288.1221695283 * Math.pow(t / 100 - 60, -0.0755148492));
      b = 255;
    } else {
      // Very cool stars - interpolate with base color
      const factor = (t - 2400) / 1000;
      r = baseColor[0] * (0.5 + 0.5 * factor);
      g = baseColor[1] * (0.3 + 0.7 * factor);
      b = baseColor[2] * (0.1 + 0.9 * factor);
    }

    // Blend with spectral base color for realism
    const blendFactor = 0.7;
    return {
      r: Math.round(r * blendFactor + baseColor[0] * (1 - blendFactor)),
      g: Math.round(g * blendFactor + baseColor[1] * (1 - blendFactor)),
      b: Math.round(b * blendFactor + baseColor[2] * (1 - blendFactor)),
    };
  }

  /**
   * Generate variability properties for certain star types
   */
  generateVariability(spectralType, luminosityClass) {
    const rand = Math.random();

    // Variable star probabilities by type
    if (spectralType === 'M' && luminosityClass === 'I' && rand < 0.8) {
      // Red supergiants - often semiregular variables
      return {
        type: 'semiregular',
        period: 100 + Math.random() * 400, // days
        amplitude: 0.5 + Math.random() * 1.5, // magnitudes
        phase: Math.random() * 2 * Math.PI,
      };
    } else if (spectralType === 'F' && luminosityClass === 'I' && rand < 0.3) {
      // Some F supergiants are Cepheid variables
      return {
        type: 'cepheid',
        period: 1 + Math.random() * 100, // days
        amplitude: 0.1 + Math.random() * 2.0,
        phase: Math.random() * 2 * Math.PI,
      };
    } else if (rand < 0.02) {
      // 2% of all stars show some irregular variability
      return {
        type: 'irregular',
        amplitude: 0.1 + Math.random() * 0.5,
        timescale: 0.1 + Math.random() * 10, // hours
      };
    }

    return null; // Not variable
  }

  /**
   * Helper methods
   */
  interpolateTemperature(range) {
    return range[1] + Math.random() * (range[0] - range[1]);
  }

  calculateAbsoluteMagnitude(baseMag) {
    // Add some scatter around typical values
    return baseMag + (Math.random() - 0.5) * 2;
  }

  generateProperMotion() {
    // Typical proper motions in milliarcseconds/year
    const magnitude = Math.random() * 100 + 5;
    const angle = Math.random() * 2 * Math.PI;

    return {
      ra: magnitude * Math.cos(angle),
      dec: magnitude * Math.sin(angle),
      total: magnitude,
    };
  }

  /**
   * Batch generate multiple stars efficiently
   */
  generateStarField(count, catalogStars = []) {
    console.log(`⭐ Generating ${count} stars with ${catalogStars.length} catalog entries...`);

    const stars = [];
    const batchSize = 100;
    let processed = 0;

    // First, add catalog stars with known positions
    for (let i = 0; i < catalogStars.length && i < count; i++) {
      const catalogStar = catalogStars[i];
      const star = this.generateStar(i, catalogStar.position);

      // Override with catalog data where available
      Object.assign(star, {
        ...catalogStar,
        id: i,
        catalog: {
          ...star.catalog,
          ...catalogStar.catalog,
        },
      });

      stars.push(star);
      processed++;
    }

    // Generate remaining stars procedurally
    for (let batch = 0; batch < Math.ceil((count - processed) / batchSize); batch++) {
      const batchStart = processed + batch * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, count);

      for (let i = batchStart; i < batchEnd; i++) {
        stars.push(this.generateStar(i));
      }

      // Yield control periodically for responsiveness
      if (batch % 10 === 0) {
        console.log(`Generated ${Math.min(batchEnd, count)} / ${count} stars`);
      }
    }

    return {
      stars,
      statistics: this.calculateStatistics(stars),
      generationTime: performance.now(),
    };
  }

  /**
   * Calculate statistics for generated star field
   */
  calculateStatistics(stars) {
    const stats = {
      total: stars.length,
      spectralTypes: {},
      luminosityClasses: {},
      variableStars: 0,
      averageDistance: 0,
      magnitudeRange: { min: Infinity, max: -Infinity },
    };

    let distanceSum = 0;

    for (const star of stars) {
      // Spectral type distribution
      stats.spectralTypes[star.spectralType] = (stats.spectralTypes[star.spectralType] || 0) + 1;

      // Luminosity class distribution
      stats.luminosityClasses[star.luminosityClass] =
        (stats.luminosityClasses[star.luminosityClass] || 0) + 1;

      // Variable stars
      if (star.variability) {
        stats.variableStars++;
      }

      // Distance and magnitude statistics
      distanceSum += star.distance;
      stats.magnitudeRange.min = Math.min(stats.magnitudeRange.min, star.apparentMagnitude);
      stats.magnitudeRange.max = Math.max(stats.magnitudeRange.max, star.apparentMagnitude);
    }

    stats.averageDistance = distanceSum / stars.length;

    return stats;
  }

  /**
   * Memory cleanup
   */
  cleanup() {
    this.starCache.clear();
    this.spectrumCache.clear();
  }
}

// Initialize worker instance
const stellarGenerator = new StellarGeneratorWorker();

// Message handler
self.addEventListener('message', function (e) {
  const { type, data, id } = e.data;

  try {
    let result;

    switch (type) {
      case 'ping':
        result = 'stellar-worker-ready';
        break;

      case 'generate-star':
        result = stellarGenerator.generateStar(data.id, data.position);
        break;

      case 'generate-star-field':
        result = stellarGenerator.generateStarField(data.count, data.catalogStars || []);
        break;

      case 'calculate-statistics':
        result = stellarGenerator.calculateStatistics(data.stars);
        break;

      case 'cleanup':
        stellarGenerator.cleanup();
        result = 'cleanup-complete';
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    self.postMessage({
      id,
      type: 'success',
      result,
      executionTime: performance.now(),
    });
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      error: error.message,
      stack: error.stack,
    });
  }
});

// Send ready signal
self.postMessage({ type: 'worker-ready' });
