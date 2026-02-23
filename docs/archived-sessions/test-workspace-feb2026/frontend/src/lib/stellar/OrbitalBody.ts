// Orbital mechanics constants
export const G = 6.6743e-11; // Gravitational constant (m³/kg/s²)
export const AU = 1.496e11; // Astronomical Unit (m)
export const SOLAR_MASS = 1.989e30; // Solar mass (kg)
export const JUPITER_MASS = 1.898e27; // Jupiter mass (kg)
export const LUNA_MASS = 7.342e22; // Moon mass (kg)

// Scale conversions for Three.js scene
export const DISTANCE_SCALE = 1 / (0.5 * AU); // 1 scene unit = 0.5 AU

export interface OrbitalBodyParams {
  name: string;
  type: string;
  mass: number;
  radius: number;
  visualRadius: number;
  semiMajorAxis: number;
  eccentricity: number;
  inclination: number;
  longitudeOfAscendingNode: number;
  argumentOfPeriapsis: number;
  meanAnomalyAtEpoch: number;
  centralMass: number;
  parentBody?: OrbitalBody | null;
  visualScale?: number;
  centralBodyPosition?: { x: number; y: number; z: number };
}

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface OrbitalPosition {
  x: number;
  y: number;
  r: number;
}

export interface PrecomputedValues {
  cosI: number;
  sinI: number;
  cosO: number;
  sinO: number;
  cosW: number;
  sinW: number;
}

export interface OrbitalInfo {
  name: string;
  type: string;
  period: number; // years
  semiMajorAxis: number; // AU
  eccentricity: number;
  inclination: number; // degrees
  currentAnomaly: number; // degrees
}

export class OrbitalBody {
  // Physical properties
  public readonly name: string;
  public readonly type: string;
  public readonly mass: number;
  public readonly radius: number;
  public readonly visualRadius: number;

  // Orbital elements
  public readonly semiMajorAxis: number;
  public readonly eccentricity: number;
  public readonly inclination: number;
  public readonly longitudeOfAscendingNode: number;
  public readonly argumentOfPeriapsis: number;
  public readonly meanAnomalyAtEpoch: number;

  // Central body properties
  public readonly centralMass: number;
  public readonly parentBody: OrbitalBody | null;

  // Calculated properties
  public readonly orbitalPeriod: number;
  public readonly meanMotion: number;

  // Current state
  public currentMeanAnomaly: number;
  public currentPosition: Position3D;

  // Pre-computed trigonometric values for performance
  public readonly precomputed: PrecomputedValues;

  // Visual scaling
  public readonly visualScale: number;
  public centralBodyPosition?: Position3D;

  constructor(params: OrbitalBodyParams) {
    // Physical properties
    this.name = params.name;
    this.type = params.type;
    this.mass = params.mass;
    this.radius = params.radius;
    this.visualRadius = params.visualRadius;

    // Orbital elements
    this.semiMajorAxis = params.semiMajorAxis;
    this.eccentricity = params.eccentricity;
    this.inclination = params.inclination;
    this.longitudeOfAscendingNode = params.longitudeOfAscendingNode;
    this.argumentOfPeriapsis = params.argumentOfPeriapsis;
    this.meanAnomalyAtEpoch = params.meanAnomalyAtEpoch;

    // Central body properties
    this.centralMass = params.centralMass;
    this.parentBody = params.parentBody || null;

    // Calculated properties
    this.orbitalPeriod = this.calculateOrbitalPeriod();
    this.meanMotion = (2 * Math.PI) / this.orbitalPeriod;

    // Current state
    this.currentMeanAnomaly = this.meanAnomalyAtEpoch;
    this.currentPosition = { x: 0, y: 0, z: 0 };

    // Pre-compute trigonometric values for performance
    this.precomputed = {
      cosI: Math.cos(this.inclination),
      sinI: Math.sin(this.inclination),
      cosO: Math.cos(this.longitudeOfAscendingNode),
      sinO: Math.sin(this.longitudeOfAscendingNode),
      cosW: Math.cos(this.argumentOfPeriapsis),
      sinW: Math.sin(this.argumentOfPeriapsis),
    };

    // Visual scaling
    this.visualScale = params.visualScale || 1;
    this.centralBodyPosition = params.centralBodyPosition;
  }

  calculateOrbitalPeriod(): number {
    // T² = (4π²/GM) * a³
    const coefficient = (4 * Math.PI * Math.PI) / (G * this.centralMass);
    return Math.sqrt(coefficient * Math.pow(this.semiMajorAxis, 3));
  }

  solveKeplersEquation(meanAnomaly: number, tolerance: number = 1e-6): number {
    let E = meanAnomaly; // Initial guess for eccentric anomaly
    let deltaE = 1;
    let iterations = 0;
    const maxIterations = 20;

    // Newton-Raphson iteration
    while (Math.abs(deltaE) > tolerance && iterations < maxIterations) {
      const f = E - this.eccentricity * Math.sin(E) - meanAnomaly;
      const fPrime = 1 - this.eccentricity * Math.cos(E);
      deltaE = f / fPrime;
      E -= deltaE;
      iterations++;
    }

    return E; // Eccentric anomaly in radians
  }

  eccentricToTrueAnomaly(eccentricAnomaly: number): number {
    const E = eccentricAnomaly;
    const e = this.eccentricity;

    const trueAnomaly =
      2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));

    return trueAnomaly;
  }

  calculateOrbitalPosition(trueAnomaly: number): OrbitalPosition {
    // Distance from central body
    const r =
      (this.semiMajorAxis * (1 - this.eccentricity * this.eccentricity)) /
      (1 + this.eccentricity * Math.cos(trueAnomaly));

    // Position in orbital plane
    const xOrb = r * Math.cos(trueAnomaly);
    const yOrb = r * Math.sin(trueAnomaly);

    return { x: xOrb, y: yOrb, r };
  }

  orbitalTo3D(orbitalPos: OrbitalPosition): Position3D {
    const { x: xOrb, y: yOrb } = orbitalPos;
    const { cosI, sinI, cosO, sinO, cosW, sinW } = this.precomputed;

    // Transform from orbital plane to 3D coordinates
    const x3d =
      (cosO * cosW - sinO * sinW * cosI) * xOrb + (-cosO * sinW - sinO * cosW * cosI) * yOrb;

    const y3d =
      (sinO * cosW + cosO * sinW * cosI) * xOrb + (-sinO * sinW + cosO * cosW * cosI) * yOrb;

    const z3d = sinW * sinI * xOrb + cosW * sinI * yOrb;

    return { x: x3d, y: y3d, z: z3d };
  }

  astronomicalToScene(astronomicalDistance: number): number {
    return astronomicalDistance * DISTANCE_SCALE;
  }

  updatePosition(deltaTime: number, timeScale: number = 1): Position3D {
    // Update mean anomaly
    const scaledDelta = deltaTime * timeScale;
    this.currentMeanAnomaly += this.meanMotion * scaledDelta;
    this.currentMeanAnomaly = this.currentMeanAnomaly % (2 * Math.PI); // Wrap around

    // Calculate current position
    const eccentricAnomaly = this.solveKeplersEquation(this.currentMeanAnomaly);
    const trueAnomaly = this.eccentricToTrueAnomaly(eccentricAnomaly);
    const orbitalPos = this.calculateOrbitalPosition(trueAnomaly);
    const position3D = this.orbitalTo3D(orbitalPos);

    // Convert to scene coordinates
    this.currentPosition = {
      x: this.astronomicalToScene(position3D.x),
      y: this.astronomicalToScene(position3D.y),
      z: this.astronomicalToScene(position3D.z),
    };

    // If this body has a parent (hierarchical orbit), add parent's position
    if (this.parentBody) {
      this.currentPosition.x += this.parentBody.currentPosition.x;
      this.currentPosition.y += this.parentBody.currentPosition.y;
      this.currentPosition.z += this.parentBody.currentPosition.z;
    } else if (this.centralBodyPosition) {
      // If orbiting a fixed central body (like Gies), add its position
      this.currentPosition.x += this.centralBodyPosition.x;
      this.currentPosition.y += this.centralBodyPosition.y;
      this.currentPosition.z += this.centralBodyPosition.z;
    }

    return this.currentPosition;
  }

  getOrbitalInfo(): OrbitalInfo {
    return {
      name: this.name,
      type: this.type,
      period: this.orbitalPeriod / (365.25 * 24 * 3600), // years
      semiMajorAxis: this.semiMajorAxis / AU, // AU
      eccentricity: this.eccentricity,
      inclination: this.inclination * (180 / Math.PI), // degrees
      currentAnomaly: this.currentMeanAnomaly * (180 / Math.PI), // degrees
    };
  }
}
