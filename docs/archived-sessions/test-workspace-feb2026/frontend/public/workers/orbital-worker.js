/**
 * Enhanced Orbital Mechanics Web Worker
 * Handles all orbital calculations, Kepler's equation solving, and celestial body positioning
 * Optimized for batch processing and memory efficiency
 */

class OrbitalCalculatorWorker {
  constructor() {
    this.positionCache = new Map();
    this.keplerCache = new Map();
    this.precomputedTrig = new Map();

    // Astronomical constants
    this.AU = 149597870.7; // km
    this.G = 6.6743e-11; // m³/kg⋅s²
    this.SOLAR_MASS = 1.9891e30; // kg

    // Performance optimization constants
    this.KEPLER_MAX_ITERATIONS = 10;
    this.KEPLER_TOLERANCE = 1e-12;

    console.log('🔧 OrbitalCalculatorWorker initialized');
  }

  /**
   * Optimized Kepler's equation solver using Newton-Raphson method
   * Cached for common orbital elements
   */
  solveKeplersEquation(M, e, cacheKey = null) {
    if (cacheKey && this.keplerCache.has(cacheKey)) {
      const cached = this.keplerCache.get(cacheKey);
      // Simple linear interpolation for nearby mean anomalies
      if (Math.abs(cached.M - M) < 0.01) {
        return cached.E + (M - cached.M) / (1 - e * Math.cos(cached.E));
      }
    }

    let E = M; // Initial guess

    for (let i = 0; i < this.KEPLER_MAX_ITERATIONS; i++) {
      const sinE = Math.sin(E);
      const cosE = Math.cos(E);
      const f = E - e * sinE - M;
      const df = 1 - e * cosE;

      const deltaE = f / df;
      E -= deltaE;

      if (Math.abs(deltaE) < this.KEPLER_TOLERANCE) {
        break;
      }
    }

    // Cache result for future use
    if (cacheKey) {
      this.keplerCache.set(cacheKey, { M, E, timestamp: Date.now() });

      // Limit cache size to prevent memory bloat
      if (this.keplerCache.size > 1000) {
        const oldest = Math.min(...Array.from(this.keplerCache.values()).map(v => v.timestamp));
        for (const [key, value] of this.keplerCache) {
          if (value.timestamp === oldest) {
            this.keplerCache.delete(key);
            break;
          }
        }
      }
    }

    return E;
  }

  /**
   * Calculate orbital position using optimized Keplerian elements
   * Returns position in 3D space with proper scaling
   */
  calculateOrbitalPosition(orbitalElements, currentTime) {
    const {
      semiMajorAxis,
      eccentricity,
      inclination,
      longitudeOfAscendingNode,
      argumentOfPeriapsis,
      meanAnomalyAtEpoch,
      orbitalPeriod,
      epoch,
    } = orbitalElements;

    // Calculate mean anomaly at current time
    const timeSinceEpoch = currentTime - epoch;
    const meanMotion = (2 * Math.PI) / orbitalPeriod;
    const meanAnomaly = meanAnomalyAtEpoch + meanMotion * timeSinceEpoch;

    // Solve Kepler's equation
    const cacheKey = `${semiMajorAxis}_${eccentricity}_${Math.floor(meanAnomaly * 100)}`;
    const eccentricAnomaly = this.solveKeplersEquation(meanAnomaly, eccentricity, cacheKey);

    // Calculate true anomaly
    const trueAnomaly =
      2 *
      Math.atan2(
        Math.sqrt(1 + eccentricity) * Math.sin(eccentricAnomaly / 2),
        Math.sqrt(1 - eccentricity) * Math.cos(eccentricAnomaly / 2)
      );

    // Calculate distance from focus
    const radius = semiMajorAxis * (1 - eccentricity * Math.cos(eccentricAnomaly));

    // Position in orbital plane
    const x_orb = radius * Math.cos(trueAnomaly);
    const y_orb = radius * Math.sin(trueAnomaly);
    const z_orb = 0;

    // Apply 3D rotations using cached trigonometry
    const rotKey = `${inclination}_${longitudeOfAscendingNode}_${argumentOfPeriapsis}`;
    let trigValues = this.precomputedTrig.get(rotKey);

    if (!trigValues) {
      const cosI = Math.cos(inclination);
      const sinI = Math.sin(inclination);
      const cosO = Math.cos(longitudeOfAscendingNode);
      const sinO = Math.sin(longitudeOfAscendingNode);
      const cosW = Math.cos(argumentOfPeriapsis);
      const sinW = Math.sin(argumentOfPeriapsis);

      trigValues = { cosI, sinI, cosO, sinO, cosW, sinW };
      this.precomputedTrig.set(rotKey, trigValues);
    }

    const { cosI, sinI, cosO, sinO, cosW, sinW } = trigValues;

    // Apply rotations: argument of periapsis, inclination, longitude of ascending node
    const x1 = x_orb * cosW - y_orb * sinW;
    const y1 = x_orb * sinW + y_orb * cosW;
    const z1 = z_orb;

    const x2 = x1;
    const y2 = y1 * cosI - z1 * sinI;
    const z2 = y1 * sinI + z1 * cosI;

    const x = x2 * cosO - y2 * sinO;
    const y = x2 * sinO + y2 * cosO;
    const z = z2;

    return {
      position: { x, y, z },
      velocity: this.calculateOrbitalVelocity(orbitalElements, eccentricAnomaly, radius),
      trueAnomaly,
      radius,
      eccentricAnomaly,
    };
  }

  /**
   * Calculate orbital velocity vector
   */
  calculateOrbitalVelocity(orbitalElements, eccentricAnomaly, radius) {
    const { semiMajorAxis, eccentricity } = orbitalElements;
    const mu = this.G * this.SOLAR_MASS;

    const v = Math.sqrt(mu * (2 / radius - 1 / semiMajorAxis));

    // Velocity direction (simplified - perpendicular to radius in orbital plane)
    const trueAnomaly =
      2 *
      Math.atan2(
        Math.sqrt(1 + eccentricity) * Math.sin(eccentricAnomaly / 2),
        Math.sqrt(1 - eccentricity) * Math.cos(eccentricAnomaly / 2)
      );

    return {
      magnitude: v,
      direction: trueAnomaly + Math.PI / 2, // Perpendicular to radius
    };
  }

  /**
   * Batch process multiple orbital calculations
   * Optimized for handling all celestial bodies at once
   */
  processOrbitalBatch(bodies, currentTime) {
    const results = [];

    for (const body of bodies) {
      const startTime = performance.now();

      const orbital = this.calculateOrbitalPosition(body.orbitalElements, currentTime);

      results.push({
        id: body.id,
        name: body.name,
        ...orbital,
        calculationTime: performance.now() - startTime,
      });
    }

    return {
      results,
      totalBodies: bodies.length,
      cacheHitRate: this.keplerCache.size / (bodies.length || 1),
      memoryUsage: {
        positionCache: this.positionCache.size,
        keplerCache: this.keplerCache.size,
        trigCache: this.precomputedTrig.size,
      },
    };
  }

  /**
   * Calculate orbital period using Kepler's third law
   */
  calculateOrbitalPeriod(semiMajorAxis, centralBodyMass = this.SOLAR_MASS) {
    const mu = this.G * centralBodyMass;
    return 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis * 1000, 3) / mu); // Convert AU to meters
  }

  /**
   * Cleanup caches to free memory
   */
  cleanup() {
    this.positionCache.clear();
    this.keplerCache.clear();
    this.precomputedTrig.clear();
  }
}

// Initialize worker instance
const orbitalCalculator = new OrbitalCalculatorWorker();

// Message handler
self.addEventListener('message', function (e) {
  const { type, data, id } = e.data;

  try {
    let result;

    switch (type) {
      case 'ping':
        result = 'orbital-worker-ready';
        break;

      case 'solve-kepler':
        result = orbitalCalculator.solveKeplersEquation(
          data.meanAnomaly,
          data.eccentricity,
          data.cacheKey
        );
        break;

      case 'calculate-position':
        result = orbitalCalculator.calculateOrbitalPosition(data.orbitalElements, data.currentTime);
        break;

      case 'batch-process':
        result = orbitalCalculator.processOrbitalBatch(data.bodies, data.currentTime);
        break;

      case 'calculate-period':
        result = orbitalCalculator.calculateOrbitalPeriod(data.semiMajorAxis, data.centralBodyMass);
        break;

      case 'cleanup':
        orbitalCalculator.cleanup();
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
