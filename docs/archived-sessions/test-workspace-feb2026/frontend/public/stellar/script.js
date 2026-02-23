// Import Three.js and dependencies using ES6 modules
import * as THREE from './three.js/three.module.js';
import { OrbitControls } from './three.js/examples/jsm/controls/OrbitControls.js';

// Orbital mechanics constants
const G = 6.6743e-11; // Gravitational constant (m³/kg/s²)
const AU = 1.496e11; // Astronomical Unit (m)
const SOLAR_MASS = 1.989e30; // Solar mass (kg)
const JUPITER_MASS = 1.898e27; // Jupiter mass (kg)
const LUNA_MASS = 7.342e22; // Moon mass (kg)

// Scale conversions for Three.js scene
const DISTANCE_SCALE = 1 / (0.5 * AU); // 1 scene unit = 0.5 AU

class OrbitalBody {
  constructor(params) {
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
  }

  calculateOrbitalPeriod() {
    // T² = (4π²/GM) * a³
    const coefficient = (4 * Math.PI * Math.PI) / (G * this.centralMass);
    return Math.sqrt(coefficient * Math.pow(this.semiMajorAxis, 3));
  }

  solveKeplersEquation(meanAnomaly, tolerance = 1e-6) {
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

  eccentricToTrueAnomaly(eccentricAnomaly) {
    const E = eccentricAnomaly;
    const e = this.eccentricity;

    const trueAnomaly =
      2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));

    return trueAnomaly;
  }

  calculateOrbitalPosition(trueAnomaly) {
    // Distance from central body
    const r =
      (this.semiMajorAxis * (1 - this.eccentricity * this.eccentricity)) /
      (1 + this.eccentricity * Math.cos(trueAnomaly));

    // Position in orbital plane
    const xOrb = r * Math.cos(trueAnomaly);
    const yOrb = r * Math.sin(trueAnomaly);

    return { x: xOrb, y: yOrb, r };
  }

  orbitalTo3D(orbitalPos) {
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

  astronomicalToScene(astronomicalDistance) {
    return astronomicalDistance * DISTANCE_SCALE;
  }

  updatePosition(deltaTime, timeScale = 1) {
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

  getOrbitalInfo() {
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

class StellarDodecahedronViewer {
  constructor(options = {}) {
    // Loading progress callbacks for better UX integration
    this.loadingCallbacks = {
      onStageProgress: options.onStageProgress || (() => {}),
      onLoadComplete: options.onLoadComplete || (() => {}),
    };

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.dodecahedron = null;
    this.starField = null;

    this.rotationSpeed = 0.02;
    this.keyStates = {};

    // Animation properties
    this.animations = {
      camera: null,
      rotation: null,
      target: null,
      zoom: null,
    };

    // Track user interaction state
    this.isUserInteracting = false;
    this.pendingAnimation = null;

    // Animation pause/resume state
    this.isPaused = false;

    // Camera tracking system
    this.trackedObject = null; // Which object to follow
    this.trackingOffset = new THREE.Vector3(); // Relative position offset from tracked object
    this.initialCameraDirection = new THREE.Vector3(); // Camera's initial look direction (inertial frame)

    // Web Workers for performance optimization
    this.workers = {
      orbital: null,
      stellar: null,
      initialized: false,
      fallbackMode: false,
    };

    // Advanced LOD System
    this.advancedLOD = null;
    this.workerTaskQueue = [];
    this.currentTaskId = 0;

    // Smooth zoom properties
    this.targetZoomDistance = 5;
    this.currentZoomDistance = 5;

    // Stellar evolution tracking
    this.stellarTime = 0; // Time in years (accelerated)
    this.timeAcceleration = 1000; // 1000 years per second
    this.starProperties = []; // Store detailed star properties

    // LOD System for stellar rendering
    this.lodSystem = {
      levels: [
        {
          distance: 100,
          maxStars: 50,
          minSize: 3.0,
          enableVariability: true,
          enableParallax: true,
        }, // Closest view
        {
          distance: 500,
          maxStars: 200,
          minSize: 2.0,
          enableVariability: true,
          enableParallax: false,
        }, // Medium view
        {
          distance: 2000,
          maxStars: 1000,
          minSize: 1.5,
          enableVariability: false,
          enableParallax: false,
        }, // Distant view
        {
          distance: Infinity,
          maxStars: 3000,
          minSize: 1.0,
          enableVariability: false,
          enableParallax: false,
        }, // Maximum view
      ],
      currentLevel: 0,
      lastUpdateDistance: 0,
      updateThreshold: 50, // Only update LOD when camera moves significantly
    };

    // UI elements
    this.whiteDwarfUI = null;
    this.chioneUI = null;
    this.grandVossUI = null;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Points.threshold = 0.3; // Increase threshold for easier hover detection
    this.mouse = new THREE.Vector2();
    this.isHoveringWhiteDwarf = false;
    this.isHoveringChione = false;
    this.isHoveringGrandVoss = false;
    this.isHoveringDodecahedron = false;

    // Tutorial system state
    this.tutorialState = {
      discoveredFeatures: new Set(),
      currentTip: 'navigation',
      advancedUnlocked: false,
    };

    // Orbital mechanics
    this.timeScale = 1000; // Increased time acceleration for visible motion
    this.orbitalBodies = [];
    this.chione = null;
    this.grandVoss = null;

    // Initialize core immediately, but handle DOM gracefully
    try {
      this.init();
      this.initializeMemoryOptimizations();
      this.initTutorialSystem();
      this.setupEventListeners();
      this.animate();

      // Load stars asynchronously with progress feedback
      this.initializeAsync();
    } catch (error) {
      console.error('StellarDodecahedronViewer initialization failed:', error);
      // Store the error to be handled by the React component
      this.initializationError = error;
      throw error; // Re-throw so the React component can catch it
    }
  }

  async initializeAsync() {
    try {
      // Allow scene to render first with a proper promise-based delay
      await new Promise(resolve => setTimeout(resolve, 10));

      // Load heavy features after initial render
      await this.loadStarDataProgressive();
      this.createOrbitalSystem();

      // Notify completion
      this.loadingCallbacks.onLoadComplete();
    } catch (error) {
      console.error('Async initialization failed:', error);
      // Still call completion callback on error so UI doesn't hang
      this.loadingCallbacks.onLoadComplete();
    }
  }

  init() {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      10000
    );
    this.camera.position.set(0, 0, 5);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const container = document.getElementById('canvas-container');
    if (!container) {
      throw new Error(
        'Could not find canvas-container element. Make sure the DOM element exists before initializing StellarDodecahedronViewer.'
      );
    }
    container.appendChild(this.renderer.domElement);

    // OrbitControls setup
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enableZoom = false; // Disable default zoom to implement smooth zoom
    this.controls.mouseButtons = {
      LEFT: null,
      MIDDLE: null, // Also disable middle mouse zoom
      RIGHT: THREE.MOUSE.ROTATE,
    };
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    // Lighting setup

    // DA White Dwarf light - realistic point source with sharp shadows like planetary lighting
    // Configured to create dramatic terminator lines similar to Earth's day/night boundary
    const whiteDwarfLight = new THREE.PointLight(0xb4ccff, 3.5, 0, 2); // Increased intensity, no distance limit for sharp shadows
    whiteDwarfLight.position.set(-15, 8, -10); // Same position as the white dwarf mesh
    whiteDwarfLight.castShadow = true;
    whiteDwarfLight.shadow.mapSize.width = 4096; // Higher resolution for sharper shadow edges
    whiteDwarfLight.shadow.mapSize.height = 4096;
    whiteDwarfLight.shadow.camera.near = 0.1;
    whiteDwarfLight.shadow.camera.far = 100; // Extended range
    whiteDwarfLight.shadow.bias = -0.0001; // Reduce shadow acne
    whiteDwarfLight.shadow.normalBias = 0.02; // Better shadow quality
    this.scene.add(whiteDwarfLight);

    // Create visible white dwarf representation
    const whiteDwarfGeometry = new THREE.SphereGeometry(0.15, 32, 32); // Increased polycount to match Chione
    const whiteDwarfMaterial = new THREE.MeshPhongMaterial({
      color: 0xb4ccff,
      emissive: 0x334466, // Reduced emissive glow to prevent extra rings
      transparent: true,
      opacity: 0.9,
    });
    this.whiteDwarf = new THREE.Mesh(whiteDwarfGeometry, whiteDwarfMaterial);
    this.whiteDwarf.position.copy(whiteDwarfLight.position);
    this.scene.add(this.whiteDwarf);

    this.createDodecahedron();
    this.initUI();
  }

  createDodecahedron() {
    const geometry = new THREE.DodecahedronGeometry(1, 0);

    // Create a custom shader material for stylized lighting that keeps faces visible
    const material = new THREE.ShaderMaterial({
      uniforms: {
        lightPosition: { value: new THREE.Vector3(-15, 8, -10) }, // White dwarf position
        baseColor: { value: new THREE.Color(0x1e5a8a) }, // Deeper blue
        rimColor: { value: new THREE.Color(0x2e86ab) }, // Previous base color as rim
        rimPower: { value: 1.5 }, // Reduced for softer rim
        minBrightness: { value: 0.4 }, // Increased minimum brightness
      },
      vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                varying vec3 vWorldPosition;
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = position;
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
      fragmentShader: `
                uniform vec3 lightPosition;
                uniform vec3 baseColor;
                uniform vec3 rimColor;
                uniform float rimPower;
                uniform float minBrightness;
                
                varying vec3 vNormal;
                varying vec3 vPosition;
                varying vec3 vWorldPosition;
                
                void main() {
                    // Calculate light direction from white dwarf
                    vec3 lightDir = normalize(lightPosition - vWorldPosition);
                    
                    // Softer diffuse lighting with smoother falloff
                    float NdotL = dot(vNormal, lightDir);
                    float diffuse = max(0.0, NdotL * 0.5 + 0.5); // Wrapped lighting for softer shadows
                    
                    // Gentler rim lighting effect with smoothstep for gradual transitions
                    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
                    float rimFactor = 1.0 - max(0.0, dot(viewDir, vNormal));
                    float rim = smoothstep(0.0, 1.0, pow(rimFactor, rimPower));
                    
                    // Smoother lighting combination with reduced rim intensity
                    float lighting = mix(minBrightness, diffuse, 0.8) + rim * 0.2;
                    
                    // Subtle color variation with reduced rim color mixing
                    vec3 finalColor = mix(baseColor, rimColor, rim * 0.15);
                    
                    gl_FragColor = vec4(finalColor * lighting, 1.0);
                }
            `,
      side: THREE.DoubleSide,
    });

    this.dodecahedron = new THREE.Mesh(geometry, material);
    this.dodecahedron.castShadow = true;
    this.dodecahedron.receiveShadow = true;
    this.scene.add(this.dodecahedron);
  }

  initUI() {
    this.whiteDwarfUI = document.getElementById('white-dwarf-ui');
    this.chioneUI = document.getElementById('chione-ui');
    this.grandVossUI = document.getElementById('grand-voss-ui');
  }

  createOrbitalSystem() {
    // White dwarf Gies mass
    const giesMass = 0.6 * SOLAR_MASS;

    // Create planet Chione
    this.chione = new OrbitalBody({
      name: 'Chione',
      type: 'Super-Earth',
      mass: 5.0 * 5.972e24, // 5 Earth masses (super-earth)
      radius: 1.8 * 6371000, // 1.8 Earth radii (meters)
      visualRadius: 0.4,

      // Orbital elements
      semiMajorAxis: 2.5 * AU,
      eccentricity: 0.15,
      inclination: (12 * Math.PI) / 180,
      longitudeOfAscendingNode: (45 * Math.PI) / 180,
      argumentOfPeriapsis: (30 * Math.PI) / 180,
      meanAnomalyAtEpoch: 0,

      centralMass: giesMass,
      visualScale: 8,
    });

    // Set Gies position as the orbital center for Chione
    this.chione.centralBodyPosition = { x: -15, y: 8, z: -10 };

    // Create moon Grand Voss (orbiting Chione)
    // Using a more visible orbital distance - roughly like Earth-Moon system scaled to scene
    this.grandVoss = new OrbitalBody({
      name: 'Grand Voss',
      type: 'Moon',
      mass: 1.2 * LUNA_MASS,
      radius: 1.1 * 1737400, // meters
      visualRadius: 0.08,

      // Orbital elements (relative to Chione) - scaled for visibility
      semiMajorAxis: 0.02 * AU, // Increased from 0.003 to 0.02 AU (~3 million km for visibility)
      eccentricity: 0.05,
      inclination: (5 * Math.PI) / 180,
      longitudeOfAscendingNode: (90 * Math.PI) / 180,
      argumentOfPeriapsis: 0,
      meanAnomalyAtEpoch: (90 * Math.PI) / 180,

      centralMass: this.chione.mass,
      parentBody: this.chione, // Hierarchical orbit
      visualScale: 1, // Reset to normal scale
    });

    this.orbitalBodies = [this.chione, this.grandVoss];

    // Create visual representations
    this.createChioneVisual();
    this.createGrandVossVisual();

    console.log(`Chione orbital period: ${this.chione.getOrbitalInfo().period.toFixed(2)} years`);
    console.log(
      `Grand Voss orbital period: ${(this.grandVoss.orbitalPeriod / (24 * 3600)).toFixed(1)} days`
    );
    console.log(`Grand Voss orbital radius: ${(this.grandVoss.semiMajorAxis / AU).toFixed(3)} AU`);
    console.log(
      `Grand Voss orbital radius (scene units): ${this.grandVoss.astronomicalToScene(this.grandVoss.semiMajorAxis).toFixed(3)}`
    );
  }

  createChioneVisual() {
    // Create Chione as a blue-green super-earth with realistic planetary lighting
    const chioneGeometry = new THREE.SphereGeometry(this.chione.visualRadius, 32, 32);
    const chioneMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a9edb, // Blue-green super-earth (like a large Earth)
      roughness: 0.8, // Planetary surface roughness
      metalness: 0.0, // Non-metallic surface
      transparent: false,
    });

    this.chioneMesh = new THREE.Mesh(chioneGeometry, chioneMaterial);
    this.chioneMesh.castShadow = true;
    this.chioneMesh.receiveShadow = true;
    this.scene.add(this.chioneMesh);

    // Position initially
    const initialPos = this.chione.updatePosition(0, this.timeScale);
    this.chioneMesh.position.set(initialPos.x, initialPos.y, initialPos.z);

    console.log(`Chione initial position:`, initialPos);
    console.log(`Gies position: (-15, 8, -10)`);
    console.log(
      `Distance from Gies:`,
      Math.sqrt(
        Math.pow(initialPos.x + 15, 2) +
          Math.pow(initialPos.y - 8, 2) +
          Math.pow(initialPos.z + 10, 2)
      )
    );
  }

  createGrandVossVisual() {
    // Create Grand Voss as a realistic gray moon with high polycount
    const grandVossGeometry = new THREE.SphereGeometry(0.08, 32, 32); // Smaller moon size
    const grandVossMaterial = new THREE.MeshStandardMaterial({
      color: 0xc0c0c0, // Silver/gray lunar color
      roughness: 0.9, // Very rough lunar surface
      metalness: 0.0, // Non-metallic surface
      transparent: false,
    });

    this.grandVossMesh = new THREE.Mesh(grandVossGeometry, grandVossMaterial);
    this.grandVossMesh.castShadow = true;
    this.grandVossMesh.receiveShadow = true;
    this.scene.add(this.grandVossMesh);

    // Position initially
    const initialPos = this.grandVoss.updatePosition(0, this.timeScale);
    this.grandVossMesh.position.set(initialPos.x, initialPos.y, initialPos.z);

    console.log(`Grand Voss initial position (should be near Chione):`, initialPos);
    console.log(`Grand Voss mesh in scene:`, this.grandVossMesh.position);
    console.log(`Grand Voss visual radius:`, this.grandVoss.visualRadius);

    // Make Grand Voss visible
    this.grandVossMesh.frustumCulled = false; // Prevent disappearing

    // Hierarchical orbital parameters: Chione orbits Gies, Grand Voss orbits Chione
    this.orbitalParams = {
      chione: {
        radius: 5.0, // Distance from white dwarf (scene units)
        speed: 0.00002, // Very slow, realistic orbital speed around Gies
        time: 0,
      },
      grandVoss: {
        radius: 1.3, // Distance from Chione (scene units) - moon orbits the planet
        speed: 0.0001, // Very slow moon orbit - easy to track with mouse
        time: 0, // Start at same side as Chione for reference
      },
    };
  }

  // Enhanced star catalog with comprehensive stellar properties
  getStarCatalogData() {
    return [
      // Format: [RA, DEC, mag, spectral, luminosity, distance_pc, metallicity, variable_type, binary, proper_motion_mas]
      [0.66, 29.58, -0.05, 'A0', 'V', 97, 0.0, null, false, 137], // Alpheratz
      [2.07, 23.46, 2.07, 'B8', 'III', 202, -0.1, null, false, 175], // Mirach
      [0.66, 56.54, 2.28, 'K0', 'III', 71, 0.1, 'irregular', false, 50], // Schedar - Variable
      [1.73, 35.62, 2.83, 'B2', 'IV', 121, -0.2, null, true, 43], // Almach - Binary
      [5.92, 7.41, 0.45, 'M2', 'I', 168, 0.05, 'semiregular', false, 27], // Betelgeuse - Variable!
      [5.6, -1.2, 1.64, 'B0', 'III', 245, -0.25, null, false, 20], // Bellatrix
      [5.68, -1.94, 2.25, 'B2', 'III', 365, -0.2, null, true, 2], // Mintaka - Binary
      [5.58, -0.3, 1.7, 'O9', 'I', 412, -0.3, null, false, 2], // Alnilam
      [5.53, -2.4, 1.74, 'B0', 'I', 250, -0.2, null, true, 3], // Alnitak - Binary
      [6.75, 16.51, 0.08, 'G6', 'III', 12.9, 0.3, null, true, 76], // Capella - Binary
      [4.84, 6.35, 0.85, 'K5', 'III', 20.4, -0.3, 'irregular', false, 63], // Aldebaran - Variable
      [3.41, 49.86, 1.79, 'F5', 'I', 168, 0.0, null, false, 24], // Mirfak
      [7.58, 5.22, 0.4, 'F5', 'IV', 3.5, 0.0, null, true, 1260], // Procyon - Binary
      [10.9, 11.97, 1.36, 'B7', 'V', 24.3, -0.13, null, false, 249], // Regulus
      [14.85, 74.16, 1.86, 'F7', 'I', 133, 0.0, 'cepheid', false, 7], // Polaris - Cepheid!
      [14.26, 19.18, -0.05, 'K1', 'III', 11.3, 0.1, null, false, 1223], // Arcturus
      [16.49, -26.3, 0.91, 'B1', 'V', 135, -0.1, null, true, 8], // Shaula - Binary
      [17.1, 12.56, 0.03, 'A0', 'V', 7.7, -0.5, null, false, 287], // Vega
      [19.51, 8.87, 0.76, 'A7', 'V', 5.1, 0.2, null, false, 536], // Altair
      [20.69, 45.28, 1.25, 'A2', 'I', 802, 0.1, null, false, 2], // Deneb
      [22.96, -29.62, 1.17, 'A3', 'V', 7.7, 0.4, null, false, 329], // Fomalhaut
      [6.95, -17.96, -1.44, 'A1', 'V', 2.6, 0.5, null, true, 1339], // Sirius - Binary
      [7.65, 28.03, 1.58, 'A1', 'V', 15.8, 0.0, null, true, 197], // Castor - Multiple
      [7.73, 28.22, 1.16, 'K0', 'III', 10.3, 0.15, null, false, 627], // Pollux
      [14.66, -60.84, -0.62, 'B1', 'III', 130, -0.1, null, true, 6], // Agena - Binary
      [14.26, -60.37, -0.28, 'G2', 'V', 1.34, 0.2, null, true, 3678], // Alpha Centauri - Binary
      [12.47, -63.1, 0.61, 'M3', 'III', 27, 0.0, 'irregular', false, 5], // Gacrux - Variable
      [16.01, -11.17, 0.95, 'M1', 'I', 170, 0.1, 'semiregular', false, 12], // Antares - Variable!
      [5.24, -8.2, 0.18, 'B8', 'I', 264, -0.3, null, false, 1], // Rigel
      [20.41, 40.26, 2.23, 'F8', 'I', 550, 0.05, null, false, 3], // Sadr
    ];
  }

  // Variable star types and their characteristics
  getVariableStarTypes() {
    return {
      cepheid: {
        period_days: [1, 50],
        amplitude_mag: [0.1, 2.0],
        type: 'pulsating',
      },
      rr_lyrae: {
        period_days: [0.2, 1.2],
        amplitude_mag: [0.3, 2.0],
        type: 'pulsating',
      },
      semiregular: {
        period_days: [30, 1000],
        amplitude_mag: [0.1, 2.5],
        type: 'pulsating',
      },
      irregular: {
        period_days: [0, 0], // No regular period
        amplitude_mag: [0.1, 1.0],
        type: 'irregular',
      },
      eclipsing: {
        period_days: [0.2, 27],
        amplitude_mag: [0.1, 3.0],
        type: 'geometric',
      },
    };
  }

  // Generate realistic star distribution
  generateRealisticStarField() {
    const stars = [];

    // Naked-eye star distribution (biased toward bright stars)
    const nakedEyeDistribution = {
      O: 0.001, // Very rare
      B: 0.05, // 5% - Blue giants/supergiants visible from far
      A: 0.15, // 15% - Bright white stars
      F: 0.1, // 10% - Yellow-white
      G: 0.15, // 15% - Sun-like
      K: 0.35, // 35% - Orange stars
      M: 0.199, // 20% - Red (many M dwarfs too faint)
    };

    // Luminosity class distribution for visible stars
    const luminosityDistribution = {
      I: 0.02, // 2% Supergiants (rare but very visible)
      II: 0.03, // 3% Bright giants
      III: 0.15, // 15% Giants
      IV: 0.1, // 10% Subgiants
      V: 0.7, // 70% Main sequence
    };

    return { nakedEyeDistribution, luminosityDistribution };
  }

  // Progressive Loading System (renamed for async compatibility)
  async loadStarDataProgressive() {
    this.updateLoadingProgress('Initializing stellar database...', 0);

    const starData = this.getStarCatalogData();
    const variableTypes = this.getVariableStarTypes();
    const distributions = this.generateRealisticStarField();

    const starPositions = [];
    const starColors = [];
    const starSizes = [];
    const starBrightness = [];
    const starProperties = [];
    const sphereRadius = 1000;

    // Phase 1: Load catalog stars (high priority)
    await this.loadCatalogStars(
      starData,
      variableTypes,
      starPositions,
      starColors,
      starSizes,
      starBrightness,
      starProperties,
      sphereRadius
    );

    // Phase 2: Generate background stars (lower priority)
    await this.loadBackgroundStars(
      distributions,
      starPositions,
      starColors,
      starSizes,
      starBrightness,
      starProperties,
      sphereRadius
    );

    // Phase 3: Create final star field
    this.updateLoadingProgress('Rendering stellar field...', 90);
    this.starProperties = starProperties;
    this.createAdvancedStarField(starPositions, starColors, starSizes, starBrightness);

    // Phase 4: Apply initial LOD
    this.updateLODSystem();
    this.updateLoadingProgress('Complete!', 100);

    // Hide loading after brief delay
    setTimeout(() => {
      const loadingElement = document.getElementById('loading');
      if (loadingElement) loadingElement.style.display = 'none';
    }, 500);
  }

  async loadCatalogStars(
    starData,
    variableTypes,
    positions,
    colors,
    sizes,
    brightness,
    properties,
    radius
  ) {
    this.updateLoadingProgress('Loading catalog stars...', 10);

    const batchSize = 5; // Process stars in small batches
    const totalStars = starData.length;

    for (let i = 0; i < totalStars; i += batchSize) {
      const batch = starData.slice(i, i + batchSize);

      batch.forEach(
        (
          [
            ra_hours,
            dec_degrees,
            magnitude,
            spectral_class,
            luminosity_class,
            distance_pc,
            metallicity,
            variable_type,
            is_binary,
            proper_motion_mas,
          ],
          index
        ) => {
          // Convert celestial coordinates
          const ra_radians = ra_hours * (Math.PI / 12);
          const dec_radians = dec_degrees * (Math.PI / 180);

          // Apply parallax effect
          const parallax_mas = 1000 / distance_pc;
          const parallax_factor = 1.0 + parallax_mas * 0.000001;

          const x = radius * Math.cos(dec_radians) * Math.cos(ra_radians) * parallax_factor;
          const y = radius * Math.sin(dec_radians) * parallax_factor;
          const z = radius * Math.cos(dec_radians) * Math.sin(ra_radians) * parallax_factor;

          positions.push(x, y, z);

          // Enhanced color calculation using new system
          const stellarProps = this.calculateStellarProperties(spectral_class, luminosity_class);
          const metallicityColor = this.applyMetallicityEffect(stellarProps.color, metallicity);
          colors.push(metallicityColor.r, metallicityColor.g, metallicityColor.b);

          // Size with scientific accuracy
          let size =
            this.magnitudeToSize(magnitude) * this.getLuminosityMultiplier(luminosity_class);
          if (is_binary) size *= 1.2;
          sizes.push(size);

          brightness.push(Math.pow(2.512, -magnitude));

          // Comprehensive stellar properties
          const starProps = {
            index: i + index,
            ra_hours,
            dec_degrees,
            distance_pc,
            metallicity,
            proper_motion_mas,
            is_binary,
            original_magnitude: magnitude,
            current_magnitude: magnitude,
            spectral_class,
            luminosity_class,
            variable_type,
            position: { x, y, z },
            baseColor: metallicityColor,
            stellarProperties: stellarProps,
            rotation_period: Math.random() * 30 + 1,
            magnetic_field: Math.random() * 1000,
          };

          // Variable star initialization
          if (variable_type && variableTypes[variable_type]) {
            const varType = variableTypes[variable_type];
            starProps.variable_period = this.randomInRange(varType.period_days);
            starProps.variable_amplitude = this.randomInRange(varType.amplitude_mag);
            starProps.variable_phase = Math.random() * 2 * Math.PI;
          }

          // Binary system properties
          if (is_binary) {
            starProps.orbital_period = Math.random() * 100 + 1;
            starProps.orbital_phase = Math.random() * 2 * Math.PI;
            starProps.orbital_separation = Math.random() * 0.1 + 0.05;
          }

          properties.push(starProps);
        }
      );

      // Update progress and yield control
      const progress = 10 + (i / totalStars) * 30;
      this.updateLoadingProgress(
        `Processing catalog stars... ${i + batch.length}/${totalStars}`,
        progress
      );

      // Yield control to prevent blocking
      if (i % 10 === 0) await this.yieldControl();
    }
  }

  async loadBackgroundStars(
    distributions,
    positions,
    colors,
    sizes,
    brightness,
    properties,
    radius
  ) {
    this.updateLoadingProgress('Generating background stars...', 40);

    const { nakedEyeDistribution, luminosityDistribution } = distributions;
    const backgroundStarCount = 3000;
    const batchSize = 100;

    for (let i = 0; i < backgroundStarCount; i += batchSize) {
      const currentBatch = Math.min(batchSize, backgroundStarCount - i);

      for (let j = 0; j < currentBatch; j++) {
        // Random position on sphere
        const phi = Math.acos(2 * Math.random() - 1);
        const theta = 2 * Math.PI * Math.random();

        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);
        positions.push(x, y, z);

        // Realistic stellar classification
        const spectralClass = this.selectSpectralClass(nakedEyeDistribution);
        const subclass = Math.floor(Math.random() * 10);
        const fullClass = spectralClass + subclass;
        const luminosityClass = this.selectLuminosityClass(luminosityDistribution);

        // Calculate properties using new system
        const stellarProps = this.calculateStellarProperties(
          spectralClass,
          luminosityClass,
          subclass
        );
        colors.push(stellarProps.color.r, stellarProps.color.g, stellarProps.color.b);

        // Background star magnitude and size
        const magnitude = 3.5 + Math.random() * 3;
        const size =
          this.magnitudeToSize(magnitude) * this.getLuminosityMultiplier(luminosityClass) * 0.8;
        sizes.push(size);

        brightness.push(Math.pow(2.512, -magnitude));

        // Simplified properties for background stars
        properties.push({
          index: properties.length,
          original_magnitude: magnitude,
          current_magnitude: magnitude,
          spectral_class: spectralClass,
          luminosity_class: luminosityClass,
          position: { x, y, z },
          baseColor: stellarProps.color,
          stellarProperties: stellarProps,
          isBackground: true,
        });
      }

      // Update progress
      const progress = 40 + ((i + currentBatch) / backgroundStarCount) * 40;
      this.updateLoadingProgress(
        `Generating stars... ${i + currentBatch}/${backgroundStarCount}`,
        progress
      );

      // Yield control periodically
      if (i % 300 === 0) await this.yieldControl();
    }
  }

  updateLoadingProgress(message, percentage) {
    // Use the enhanced loading callback system
    this.loadingCallbacks.onStageProgress('stellar', percentage, message);

    // Legacy fallback for direct DOM manipulation
    const loadingElement = document.getElementById('loading');
    if (loadingElement && !this.loadingCallbacks.onStageProgress) {
      loadingElement.innerHTML = `
                <div style="text-align: center;">
                    <div style="margin-bottom: 10px;">${message}</div>
                    <div style="width: 200px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; margin: 0 auto;">
                        <div style="width: ${percentage}%; height: 100%; background: #4a9eff; border-radius: 2px; transition: width 0.3s ease;"></div>
                    </div>
                    <div style="margin-top: 8px; font-size: 12px; opacity: 0.8;">${Math.round(percentage)}%</div>
                </div>
            `;
    }
  }

  yieldControl() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  randomInRange(range) {
    const [min, max] = range;
    return min + Math.random() * (max - min);
  }

  applyMetallicityEffect(baseColor, metallicity) {
    // Metallicity affects color slightly
    // Higher metallicity (metal-rich) = slightly redder
    // Lower metallicity (metal-poor) = slightly bluer
    const metalEffect = metallicity * 0.1;
    return new THREE.Color(
      Math.max(0, Math.min(1, baseColor.r + metalEffect)),
      Math.max(0, Math.min(1, baseColor.g + metalEffect * 0.5)),
      Math.max(0, Math.min(1, baseColor.b - metalEffect * 0.3))
    );
  }

  addAdvancedBackgroundStars(
    positions,
    colors,
    sizes,
    brightness,
    properties,
    distributions,
    radius
  ) {
    const { nakedEyeDistribution, luminosityDistribution } = distributions;

    // Generate 3500 background stars with realistic distribution
    for (let i = 0; i < 3500; i++) {
      // Random position on sphere
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = 2 * Math.PI * Math.random();

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      positions.push(x, y, z);

      // Select spectral class based on distribution
      const spectralClass = this.selectSpectralClass(nakedEyeDistribution);
      const subclass = Math.floor(Math.random() * 10); // 0-9 subdivision
      const fullClass = spectralClass + subclass;

      // Select luminosity class
      const luminosityClass = this.selectLuminosityClass(luminosityDistribution);

      // Get color for this star
      const color = this.getDetailedSpectralColor(fullClass);
      colors.push(color.r, color.g, color.b);

      // Generate magnitude (fainter background stars, 3.5 to 6.5)
      const magnitude = 3.5 + Math.random() * 3;
      const baseSize = this.magnitudeToSize(magnitude);
      const lumMultiplier = this.getLuminosityMultiplier(luminosityClass);
      sizes.push(baseSize * lumMultiplier * 0.8); // Balanced background star sizing

      // Brightness
      const bright = Math.pow(2.512, -magnitude);
      brightness.push(bright);
    }
  }

  selectSpectralClass(distribution) {
    const rand = Math.random();
    let cumulative = 0;
    for (const [cls, prob] of Object.entries(distribution)) {
      cumulative += prob;
      if (rand < cumulative) return cls;
    }
    return 'G'; // Default to Sun-like
  }

  selectLuminosityClass(distribution) {
    const rand = Math.random();
    let cumulative = 0;
    for (const [cls, prob] of Object.entries(distribution)) {
      cumulative += prob;
      if (rand < cumulative) return cls;
    }
    return 'V'; // Default to main sequence
  }

  magnitudeToSize(magnitude) {
    // Convert stellar magnitude to visual size (moderately enhanced)
    // Brighter stars (lower magnitude) appear larger
    // Range: -1.5 (Sirius) to 6.5 (faint naked-eye)
    const normalizedMag = (6.5 - magnitude) / 8; // Normalize to 0-1
    return 1.0 + normalizedMag * 5.5; // Moderate size range 1.0 to 6.5
  }

  getLuminosityMultiplier(luminosityClass) {
    // Luminosity class affects apparent size (balanced multipliers)
    const multipliers = {
      I: 2.8, // Supergiants appear much larger
      II: 2.0, // Bright giants
      III: 1.6, // Giants
      IV: 1.3, // Subgiants
      V: 1.1, // Main sequence (slight boost)
    };
    return multipliers[luminosityClass] || 1.1;
  }

  getDetailedSpectralColor(spectralClass) {
    // Extract main class and subclass
    const mainClass = spectralClass.charAt(0);
    const subclass = parseInt(spectralClass.substring(1)) || 5;

    // Temperature ranges for each spectral class (in Kelvin)
    const tempRanges = {
      O: [30000, 50000],
      B: [10000, 30000],
      A: [7500, 10000],
      F: [6000, 7500],
      G: [5200, 6000],
      K: [3700, 5200],
      M: [2400, 3700],
    };

    // Get temperature range
    const range = tempRanges[mainClass] || tempRanges['G'];
    const [minTemp, maxTemp] = range;

    // Interpolate temperature based on subclass (0=hottest, 9=coolest)
    const temp = maxTemp - (subclass / 9) * (maxTemp - minTemp);

    // Convert temperature to RGB color
    return this.temperatureToColor(temp);
  }

  temperatureToColor(kelvin) {
    // Enhanced Planckian blackbody radiation color temperature conversion
    // Using improved Mitchell Charity algorithm with astronomical corrections
    const temp = Math.max(1000, Math.min(40000, kelvin)); // Clamp to realistic stellar range
    let r, g, b;

    if (temp < 6600) {
      // Cool stars (M, K, early G)
      r = 255;
      g = temp < 1000 ? 0 : 99.4708025861 * Math.log(temp / 100) - 161.1195681661;
      b = temp < 2000 ? 0 : 138.5177312231 * Math.log(temp / 100 - 10) - 305.0447927307;
    } else {
      // Hot stars (late G, F, A, B, O)
      r = 329.698727446 * Math.pow(temp / 100 - 60, -0.1332047592);
      g = 288.1221695283 * Math.pow(temp / 100 - 60, -0.0755148492);
      b = 255;
    }

    // Clamp and normalize
    r = Math.max(0, Math.min(255, r)) / 255;
    g = Math.max(0, Math.min(255, g)) / 255;
    b = Math.max(0, Math.min(255, b)) / 255;

    // Apply astronomical color corrections for visual accuracy
    const color = new THREE.Color(r, g, b);

    // Enhance color saturation for visual distinction
    const saturationBoost = 1.2;
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    color.setHSL(hsl.h, Math.min(1, hsl.s * saturationBoost), hsl.l);

    return color;
  }

  // Comprehensive Morgan-Keenan stellar classification system
  getSpectralClassificationData() {
    return {
      // Temperature ranges and properties for each spectral class
      O: {
        tempRange: [30000, 50000],
        color: '#9bb0ff',
        abundance: 0.00003,
        avgMass: 20,
        avgRadius: 10,
      },
      B: {
        tempRange: [10000, 30000],
        color: '#aabfff',
        abundance: 0.13,
        avgMass: 8,
        avgRadius: 4,
      },
      A: {
        tempRange: [7500, 10000],
        color: '#cad7ff',
        abundance: 0.6,
        avgMass: 2.5,
        avgRadius: 2,
      },
      F: {
        tempRange: [6000, 7500],
        color: '#f8f7ff',
        abundance: 3.0,
        avgMass: 1.4,
        avgRadius: 1.3,
      },
      G: {
        tempRange: [5200, 6000],
        color: '#fff4ea',
        abundance: 7.6,
        avgMass: 1.0,
        avgRadius: 1.0,
      },
      K: {
        tempRange: [3700, 5200],
        color: '#ffd2a1',
        abundance: 12.1,
        avgMass: 0.7,
        avgRadius: 0.8,
      },
      M: {
        tempRange: [2400, 3700],
        color: '#ffad51',
        abundance: 76.45,
        avgMass: 0.4,
        avgRadius: 0.5,
      },
    };
  }

  // Luminosity class characteristics
  getLuminosityClassData() {
    return {
      I: {
        name: 'Supergiant',
        radiusMultiplier: 100,
        massMultiplier: 15,
        abundance: 0.001,
      },
      II: {
        name: 'Bright Giant',
        radiusMultiplier: 20,
        massMultiplier: 8,
        abundance: 0.01,
      },
      III: {
        name: 'Giant',
        radiusMultiplier: 10,
        massMultiplier: 3,
        abundance: 0.5,
      },
      IV: {
        name: 'Subgiant',
        radiusMultiplier: 3,
        massMultiplier: 1.5,
        abundance: 2.0,
      },
      V: {
        name: 'Main Sequence',
        radiusMultiplier: 1,
        massMultiplier: 1,
        abundance: 97.5,
      },
    };
  }

  // Calculate precise stellar properties from classification
  calculateStellarProperties(spectralClass, luminosityClass, subtype = 5) {
    const spectralData = this.getSpectralClassificationData();
    const luminosityData = this.getLuminosityClassData();

    const mainClass = spectralClass.charAt(0).toUpperCase();
    const specData = spectralData[mainClass] || spectralData['G'];
    const lumData = luminosityData[luminosityClass] || luminosityData['V'];

    // Calculate temperature with subtype interpolation
    const [minTemp, maxTemp] = specData.tempRange;
    const temperature = maxTemp - (subtype / 9) * (maxTemp - minTemp);

    // Calculate mass and radius with luminosity class corrections
    const mass = specData.avgMass * lumData.massMultiplier;
    const radius = specData.avgRadius * lumData.radiusMultiplier;

    // Calculate luminosity (L/L_sun) using mass-luminosity relation
    let luminosity;
    if (mass < 0.43) {
      luminosity = 0.23 * Math.pow(mass, 2.3); // Low mass stars
    } else if (mass < 2) {
      luminosity = Math.pow(mass, 4); // Main sequence
    } else if (mass < 55) {
      luminosity = 1.4 * Math.pow(mass, 3.5); // High mass stars
    } else {
      luminosity = 32000 * mass; // Very massive stars
    }

    // Luminosity class adjustments
    if (luminosityClass === 'I') luminosity *= 10000;
    else if (luminosityClass === 'II') luminosity *= 1000;
    else if (luminosityClass === 'III') luminosity *= 100;
    else if (luminosityClass === 'IV') luminosity *= 10;

    return {
      temperature,
      mass,
      radius,
      luminosity,
      color: this.temperatureToColor(temperature),
      spectralClass: mainClass + subtype,
      luminosityClass,
      fullClassification: mainClass + subtype + luminosityClass,
    };
  }

  // LOD System Implementation
  updateLODSystem() {
    if (!this.camera || !this.starField) return;

    // Calculate current camera distance from scene center
    const cameraDistance = this.camera.position.length();

    // Check if we need to update LOD (avoid constant updates)
    if (
      Math.abs(cameraDistance - this.lodSystem.lastUpdateDistance) < this.lodSystem.updateThreshold
    ) {
      return;
    }

    this.lodSystem.lastUpdateDistance = cameraDistance;

    // Determine appropriate LOD level
    let newLevel = 0;
    for (let i = 0; i < this.lodSystem.levels.length; i++) {
      if (cameraDistance <= this.lodSystem.levels[i].distance) {
        newLevel = i;
        break;
      }
    }

    // Update LOD if changed
    if (newLevel !== this.lodSystem.currentLevel) {
      this.lodSystem.currentLevel = newLevel;
      this.applyLODLevel(newLevel);
      console.log(`🎯 LOD Level changed to ${newLevel} (distance: ${cameraDistance.toFixed(1)})`);
    }
  }

  applyLODLevel(level) {
    const lodConfig = this.lodSystem.levels[level];
    const geometry = this.starField.geometry;
    const positions = geometry.attributes.position;
    const colors = geometry.attributes.color;
    const sizes = geometry.attributes.size;

    // Create arrays for visible stars based on LOD level
    const visiblePositions = [];
    const visibleColors = [];
    const visibleSizes = [];
    const totalStars = Math.min(this.starProperties.length, lodConfig.maxStars);

    // Sort stars by brightness/importance for this LOD level
    const sortedStars = this.starProperties.slice(0, totalStars).sort((a, b) => {
      // Priority: catalog stars > bright stars > variable stars
      if (a.index < 30 && b.index >= 30) return -1; // Catalog stars first
      if (b.index < 30 && a.index >= 30) return 1;
      if (a.variable_type && !b.variable_type) return -1; // Variable stars next
      if (b.variable_type && !a.variable_type) return 1;
      return a.original_magnitude - b.original_magnitude; // Then by brightness
    });

    // Apply stars to geometry based on LOD configuration
    sortedStars.forEach((star, index) => {
      if (index >= lodConfig.maxStars) return;

      // Position
      visiblePositions.push(star.position.x, star.position.y, star.position.z);

      // Color (potentially simplified for distant LODs)
      visibleColors.push(star.baseColor.r, star.baseColor.g, star.baseColor.b);

      // Size with LOD scaling
      let size = this.magnitudeToSize(star.current_magnitude);
      size *= this.getLuminosityMultiplier(star.luminosity_class);
      size = Math.max(lodConfig.minSize, size);

      // Apply distance-based scaling
      if (level >= 2) size *= 0.8; // Reduce size for distant views
      if (level >= 3) size *= 0.6; // Further reduce for maximum distance

      visibleSizes.push(size);
    });

    // Update geometry attributes
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(visiblePositions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(visibleColors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(visibleSizes, 1));

    // Update geometry
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;

    console.log(`✨ Applied LOD Level ${level}: ${visiblePositions.length / 3} stars visible`);
  }

  // Check if current LOD level supports advanced features
  isFeatureEnabledAtCurrentLOD(feature) {
    const currentConfig = this.lodSystem.levels[this.lodSystem.currentLevel];
    return currentConfig[feature] || false;
  }

  getSpectralColor(spectral_class) {
    const spectralColors = {
      O: new THREE.Color(0x9bb0ff), // Blue
      B: new THREE.Color(0xaabfff), // Blue-white
      A: new THREE.Color(0xcad7ff), // White
      F: new THREE.Color(0xf8f7ff), // Yellow-white
      G: new THREE.Color(0xfff4ea), // Yellow (like Sun)
      K: new THREE.Color(0xffd2a1), // Orange
      M: new THREE.Color(0xffad51), // Red
    };

    const mainClass = spectral_class.charAt(0);
    return spectralColors[mainClass] || spectralColors['G'];
  }

  createAdvancedStarField(positions, colors, sizes, brightness) {
    const starGeometry = new THREE.BufferGeometry();

    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    starGeometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

    // Store brightness for potential future use (e.g., twinkling)
    starGeometry.setAttribute('brightness', new THREE.Float32BufferAttribute(brightness, 1));

    // Custom shader material that properly handles individual star sizes
    const starMaterial = new THREE.ShaderMaterial({
      uniforms: {
        pointTexture: { value: this.createStarTexture() },
      },
      vertexShader: `
                attribute float size;
                varying vec3 vColor;
                
                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
      fragmentShader: `
                uniform sampler2D pointTexture;
                varying vec3 vColor;
                
                void main() {
                    gl_FragColor = vec4(vColor, 1.0);
                    gl_FragColor = gl_FragColor * texture2D(pointTexture, gl_PointCoord);
                }
            `,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });

    this.starField = new THREE.Points(starGeometry, starMaterial);
    this.starMaterial = starMaterial;
    this.scene.add(this.starField);

    // Hide loading indicator
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
  }

  createStarTexture() {
    // Create a circular star texture to avoid square artifacts
    const canvas = document.createElement('canvas');
    const size = 64;
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');
    const center = size / 2;
    const radius = size / 2;

    // Create radial gradient for smooth circular star
    const gradient = context.createRadialGradient(center, center, 0, center, center, radius);
    gradient.addColorStop(0, 'rgba(255,255,255,1.0)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.4)');
    gradient.addColorStop(0.7, 'rgba(255,255,255,0.1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0.0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    return texture;
  }

  setupEventListeners() {
    // Track mouse interaction with OrbitControls
    this.renderer.domElement.addEventListener('mousedown', event => {
      // Right mouse button (OrbitControls rotate)
      if (event.button === 2) {
        this.isUserInteracting = true;
        // Cancel any ongoing animations when user starts interacting
        this.cancelAnimations();

        // Only stop tracking if user clicks on a DIFFERENT celestial body
        if (this.trackedObject) {
          this.updateMousePosition(event);
          this.raycaster.setFromCamera(this.mouse, this.camera);

          // Check all celestial bodies and dodecahedron
          const celestialBodies = [];
          if (this.whiteDwarf) celestialBodies.push({ mesh: this.whiteDwarf, type: 'gies' });
          if (this.chioneMesh) celestialBodies.push({ mesh: this.chioneMesh, type: 'chione' });
          if (this.grandVossMesh)
            celestialBodies.push({
              mesh: this.grandVossMesh,
              type: 'grandvoss',
            });
          if (this.dodecahedron)
            celestialBodies.push({
              mesh: this.dodecahedron,
              type: 'dodecahedron',
            });

          const intersects = this.raycaster.intersectObjects(celestialBodies.map(b => b.mesh));

          if (intersects.length > 0) {
            // Clicked on a celestial body - check if it's different from current
            const hitObject = intersects[0].object;
            if (hitObject !== this.trackedObject.mesh) {
              // Clicked on different celestial body, stop tracking
              this.trackedObject = null;
              console.log('Camera tracking disabled - user clicked on different celestial body');
            } else {
              // Clicked on same tracked object, keep tracking
              console.log('Camera tracking maintained - user interacting with tracked object');
            }
          } else {
            // Clicked on empty space, keep tracking
            console.log('Camera tracking maintained - user clicked neutral space');
          }
        } else {
          // No tracking active, normal behavior
          console.log('User interaction detected - no tracking active');
        }
      }
    });

    this.renderer.domElement.addEventListener('mouseup', event => {
      if (event.button === 2) {
        this.isUserInteracting = false;
      }
    });

    // Also track if mouse leaves the canvas while dragging
    this.renderer.domElement.addEventListener('mouseleave', () => {
      if (this.isUserInteracting) {
        this.isUserInteracting = false;
      }
      // Hide all celestial body UIs when mouse leaves canvas
      this.hideAllCelestialUIs();
    });

    // Touch support - track pointer events for touch interactions
    this.renderer.domElement.addEventListener('pointerdown', event => {
      // Track touch interaction (single finger or two fingers)
      if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        this.isUserInteracting = true;
        this.cancelAnimations();
      }
    });

    this.renderer.domElement.addEventListener('pointerup', event => {
      if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        this.isUserInteracting = false;
      }
    });

    this.renderer.domElement.addEventListener('pointercancel', event => {
      if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        this.isUserInteracting = false;
      }
    });

    // Touch move for hover detection (similar to mousemove for touch devices)
    this.renderer.domElement.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        this.updateMousePosition(event);
        this.checkCelestialBodyHovers();
      }
    });

    // Mouse move for hover detection
    this.renderer.domElement.addEventListener('mousemove', event => {
      this.updateMousePosition(event);
      this.checkCelestialBodyHovers();
    });

    // Double-click to center camera on celestial bodies
    this.renderer.domElement.addEventListener('dblclick', event => {
      this.handleDoubleClick(event);
    });

    // Smooth zoom with mouse wheel
    this.renderer.domElement.addEventListener('wheel', event => {
      event.preventDefault();

      // Don't stop tracking when zooming - just adjust the zoom
      // The tracking system will adapt to the new zoom level

      // Calculate zoom factor
      const zoomSpeed = 0.1;
      const delta = event.deltaY > 0 ? 1 + zoomSpeed : 1 - zoomSpeed;

      // Update target zoom distance
      this.targetZoomDistance *= delta;

      // Clamp zoom distance to reasonable bounds
      this.targetZoomDistance = Math.max(2, Math.min(50, this.targetZoomDistance));

      if (this.trackedObject) {
        console.log('Zoom adjusted while tracking - maintaining camera follow');
      }
    });

    // Keyboard controls
    document.addEventListener('keydown', event => {
      this.keyStates[event.code] = true;

      // Handle special keys
      switch (event.code) {
        case 'KeyF':
        case 'Space':
          event.preventDefault();
          this.handleFitToScreen();
          break;
        case 'KeyR':
          event.preventDefault();
          this.handleResetView();
          break;
      }
    });

    document.addEventListener('keyup', event => {
      this.keyStates[event.code] = false;
    });

    // Window resize
    window.addEventListener('resize', () => {
      this.onWindowResize();
    });

    // Listen for pause/resume messages from parent (e.g., when Godot overlay opens)
    window.addEventListener('message', event => {
      if (event.data.action === 'pause') {
        this.isPaused = true;
      } else if (event.data.action === 'resume') {
        this.isPaused = false;
      }
    });
  }

  handleFitToScreen() {
    if (this.isUserInteracting) {
      // Cancel any pending animation - don't buffer commands
      this.pendingAnimation = null;
      return;
    } else {
      // Execute immediately if user is not interacting
      this.fitToScreen();
    }
  }

  handleResetView() {
    if (this.isUserInteracting) {
      // Cancel any pending animation - don't buffer commands
      this.pendingAnimation = null;
      return;
    } else {
      // Execute immediately if user is not interacting
      this.resetView();
    }
  }

  handleKeyboardRotation() {
    if (!this.dodecahedron) return;

    const speed = this.rotationSpeed;

    // WASD + QE controls for dodecahedron rotation
    const isRotating = this.isRotatingDodecahedron();

    if (this.keyStates['KeyW']) {
      this.dodecahedron.rotation.x -= speed;
    }
    if (this.keyStates['KeyS']) {
      this.dodecahedron.rotation.x += speed;
    }
    if (this.keyStates['KeyA']) {
      this.dodecahedron.rotation.y -= speed;
    }
    if (this.keyStates['KeyD']) {
      this.dodecahedron.rotation.y += speed;
    }
    if (this.keyStates['KeyQ']) {
      this.dodecahedron.rotation.z -= speed;
    }
    if (this.keyStates['KeyE']) {
      this.dodecahedron.rotation.z += speed;
    }

    // Hide highlight immediately when starting to rotate
    if (isRotating) {
      this.hideDodecahedronHighlight();
      this.onDodecahedronRotation(); // Tutorial system integration
    }
  }

  fitToScreen() {
    if (!this.dodecahedron || !this.camera || !this.controls) return;

    // Cancel any existing animations
    this.cancelAnimations();

    // Calculate bounding sphere of dodecahedron
    const box = new THREE.Box3().setFromObject(this.dodecahedron);
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);

    // Calculate target camera position
    const distance = sphere.radius * 3;
    const direction = new THREE.Vector3();
    direction.subVectors(this.camera.position, this.controls.target).normalize();

    const targetPosition = new THREE.Vector3()
      .copy(this.controls.target)
      .add(direction.multiplyScalar(distance));

    // Update zoom distance for the new position
    this.targetZoomDistance = distance;
    this.currentZoomDistance = distance;

    // Animate camera position smoothly
    this.animateCameraTo(targetPosition, this.controls.target);
  }

  resetView() {
    // Cancel any existing animations
    this.cancelAnimations();

    // Clear any tracking state - this is key for R key to work after selecting objects
    this.trackedObject = null;
    console.log('Camera tracking disabled during reset - returned to free camera mode');

    // Target values for reset
    const targetCameraPosition = new THREE.Vector3(0, 0, 5);
    const targetControlsTarget = new THREE.Vector3(0, 0, 0);
    const targetRotation = new THREE.Euler(0, 0, 0);

    // Reset zoom distance
    this.targetZoomDistance = 5;
    this.currentZoomDistance = 5;

    // Animate camera and controls
    this.animateCameraTo(targetCameraPosition, targetControlsTarget);

    // Animate dodecahedron rotation
    if (this.dodecahedron) {
      this.animateRotationTo(targetRotation);
    }
  }

  animateCameraTo(targetPosition, targetLookAt) {
    const startPosition = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const duration = 1000; // 1 second
    const startTime = Date.now();

    this.animations.camera = {
      startPosition,
      targetPosition,
      startTarget,
      targetLookAt,
      startTime,
      duration,
    };
  }

  animateRotationTo(targetRotation) {
    if (!this.dodecahedron) return;

    const startRotation = this.dodecahedron.rotation.clone();
    const duration = 1000; // 1 second
    const startTime = Date.now();

    this.animations.rotation = {
      startRotation,
      targetRotation,
      startTime,
      duration,
    };
  }

  cancelAnimations() {
    this.animations.camera = null;
    this.animations.rotation = null;
    this.pendingAnimation = null;
    // Don't automatically stop tracking when animations are cancelled
    // Let the specific interaction decide if tracking should stop
  }

  updateAnimations() {
    // Update camera animation
    if (this.animations.camera) {
      const { startPosition, targetPosition, startTarget, targetLookAt, startTime, duration } =
        this.animations.camera;
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Use easing function for smooth animation
      const eased = this.easeInOutCubic(progress);

      // Interpolate camera position
      this.camera.position.lerpVectors(startPosition, targetPosition, eased);

      // Interpolate controls target
      this.controls.target.lerpVectors(startTarget, targetLookAt, eased);
      this.controls.update();

      // Animation complete
      if (progress >= 1) {
        this.animations.camera = null;
      }
    }

    // Update rotation animation
    if (this.animations.rotation && this.dodecahedron) {
      const { startRotation, targetRotation, startTime, duration } = this.animations.rotation;
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Use easing function for smooth animation
      const eased = this.easeInOutCubic(progress);

      // Interpolate rotation
      this.dodecahedron.rotation.x = startRotation.x + (targetRotation.x - startRotation.x) * eased;
      this.dodecahedron.rotation.y = startRotation.y + (targetRotation.y - startRotation.y) * eased;
      this.dodecahedron.rotation.z = startRotation.z + (targetRotation.z - startRotation.z) * eased;

      // Animation complete
      if (progress >= 1) {
        this.animations.rotation = null;
      }
    }
  }

  updateSmoothZoom() {
    // Don't update zoom if camera animation is running
    if (this.animations.camera) return;

    // Smoothly interpolate zoom distance
    const zoomDamping = 0.1;
    this.currentZoomDistance += (this.targetZoomDistance - this.currentZoomDistance) * zoomDamping;

    // Only update if there's a significant difference
    if (Math.abs(this.targetZoomDistance - this.currentZoomDistance) > 0.01) {
      // Get current camera direction
      const direction = new THREE.Vector3();
      direction.subVectors(this.camera.position, this.controls.target).normalize();

      // Update camera position based on zoom distance
      this.camera.position
        .copy(this.controls.target)
        .add(direction.multiplyScalar(this.currentZoomDistance));
      this.controls.update();
    }
  }

  updateCameraTracking() {
    // Don't track if there's an animation running or no tracked object
    if (this.animations.camera || !this.trackedObject || !this.trackedObject.mesh) {
      return;
    }

    const targetPosition = this.trackedObject.mesh.position;

    // ONLY update the OrbitControls target, don't force camera position
    // This allows user to freely choose distance and orientation while keeping the object as center of rotation
    this.controls.target.copy(targetPosition);

    // Let OrbitControls handle everything else - no forced camera positioning
    this.controls.update();
  }

  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  handleDoubleClick(event) {
    // Update mouse position for raycasting
    this.updateMousePosition(event);

    // Set up raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check all celestial bodies AND the dodecahedron
    const celestialBodies = [];

    if (this.whiteDwarf)
      celestialBodies.push({
        mesh: this.whiteDwarf,
        type: 'gies',
        position: this.whiteDwarf.position,
      });
    if (this.chioneMesh)
      celestialBodies.push({
        mesh: this.chioneMesh,
        type: 'chione',
        position: this.chioneMesh.position,
      });
    if (this.grandVossMesh)
      celestialBodies.push({
        mesh: this.grandVossMesh,
        type: 'grandvoss',
        position: this.grandVossMesh.position,
      });
    if (this.dodecahedron)
      celestialBodies.push({
        mesh: this.dodecahedron,
        type: 'dodecahedron',
        position: this.dodecahedron.position,
      });

    const intersects = this.raycaster.intersectObjects(celestialBodies.map(b => b.mesh));

    if (intersects.length > 0) {
      const hitObject = intersects[0].object;

      // Find which body was double-clicked
      for (const body of celestialBodies) {
        if (body.mesh === hitObject) {
          this.centerCameraOnObject(body.position, body.type);
          break;
        }
      }
    }
  }

  centerCameraOnObject(targetPosition, objectType) {
    // Cancel any existing animations
    this.cancelAnimations();

    if (objectType === 'dodecahedron') {
      // Double-clicked dodecahedron - smoothly return to free camera mode
      this.trackedObject = null;

      // Smoothly animate back to a good viewing position for the dodecahedron
      const targetCameraPosition = new THREE.Vector3(0, 0, 5);
      const targetControlsTarget = new THREE.Vector3(0, 0, 0);

      // Reset zoom distance for smooth zoom behavior
      this.targetZoomDistance = 5;
      this.currentZoomDistance = 5;

      // Animate smoothly back to dodecahedron view
      this.animateCameraToTarget(targetCameraPosition, targetControlsTarget);

      console.log('Camera tracking disabled - smoothly returning to dodecahedron/free camera mode');
      this.onReturnToDodecahedron(); // Tutorial system integration
      return;
    }

    // Calculate appropriate distance based on object type
    let distance;
    switch (objectType) {
      case 'gies':
        distance = 3; // Close to white dwarf
        this.trackedObject = { type: 'gies', mesh: this.whiteDwarf };
        break;
      case 'chione':
        distance = 2; // Close to planet
        this.trackedObject = { type: 'chione', mesh: this.chioneMesh };
        break;
      case 'grandvoss':
        distance = 1; // Very close to moon
        this.trackedObject = { type: 'grandvoss', mesh: this.grandVossMesh };
        break;
      default:
        distance = 3;
        this.trackedObject = null;
    }

    // Calculate camera position - move camera to look at the target
    const direction = new THREE.Vector3();
    direction.subVectors(this.camera.position, targetPosition).normalize();

    const newCameraPosition = new THREE.Vector3()
      .copy(targetPosition)
      .add(direction.multiplyScalar(distance));

    // Update zoom distance for smooth zoom
    this.targetZoomDistance = distance;
    this.currentZoomDistance = distance;

    // Animate camera to new position and look at target
    this.animateCameraToTarget(newCameraPosition, targetPosition);

    console.log(
      `Centering camera on ${objectType} and enabling flexible tracking at position:`,
      targetPosition
    );
    this.onCelestialTracking(); // Tutorial system integration
  }

  animateCameraToTarget(targetCameraPosition, targetLookAt) {
    const startPosition = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const duration = 1500; // 1.5 seconds for smooth movement
    const startTime = Date.now();

    this.animations.camera = {
      startPosition,
      targetPosition: targetCameraPosition,
      startTarget,
      targetLookAt,
      startTime,
      duration,
    };
  }

  updateMousePosition(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  checkCelestialBodyHovers() {
    if (!this.raycaster) return;

    // Set up raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check all celestial bodies and dodecahedron
    const celestialBodies = [];

    if (this.whiteDwarf) celestialBodies.push({ mesh: this.whiteDwarf, type: 'gies' });
    if (this.chioneMesh) celestialBodies.push({ mesh: this.chioneMesh, type: 'chione' });
    if (this.grandVossMesh) celestialBodies.push({ mesh: this.grandVossMesh, type: 'grandvoss' });
    if (this.dodecahedron) celestialBodies.push({ mesh: this.dodecahedron, type: 'dodecahedron' });

    const intersects = this.raycaster.intersectObjects(celestialBodies.map(b => b.mesh));

    // Reset all hover states first
    let newWhiteDwarfHover = false;
    let newChioneHover = false;
    let newGrandVossHover = false;
    let newDodecahedronHover = false;

    // Check what we're hovering over
    if (intersects.length > 0) {
      const hitObject = intersects[0].object;

      // Find which body was hit
      for (const body of celestialBodies) {
        if (body.mesh === hitObject) {
          if (body.type === 'gies') newWhiteDwarfHover = true;
          else if (body.type === 'chione') newChioneHover = true;
          else if (body.type === 'grandvoss') newGrandVossHover = true;
          else if (body.type === 'dodecahedron') newDodecahedronHover = true;
          break;
        }
      }
    }

    // Update white dwarf hover state
    if (newWhiteDwarfHover !== this.isHoveringWhiteDwarf) {
      this.isHoveringWhiteDwarf = newWhiteDwarfHover;
      if (newWhiteDwarfHover) {
        this.showWhiteDwarfUI();
        this.onCelestialHover(); // Tutorial system integration
      } else {
        this.hideWhiteDwarfUI();
      }
    }

    // Update Chione hover state
    if (newChioneHover !== this.isHoveringChione) {
      this.isHoveringChione = newChioneHover;
      if (newChioneHover) {
        this.showChioneUI();
        this.onCelestialHover(); // Tutorial system integration
      } else {
        this.hideChioneUI();
      }
    }

    // Update Grand Voss hover state
    if (newGrandVossHover !== this.isHoveringGrandVoss) {
      this.isHoveringGrandVoss = newGrandVossHover;
      if (newGrandVossHover) {
        this.showGrandVossUI();
        this.onCelestialHover(); // Tutorial system integration
      } else {
        this.hideGrandVossUI();
      }
    }

    // Update dodecahedron hover state
    if (newDodecahedronHover !== this.isHoveringDodecahedron) {
      this.isHoveringDodecahedron = newDodecahedronHover;
      // Only show dodecahedron highlight if:
      // 1. We're hovering the dodecahedron
      // 2. We're currently tracking another object (viewing from distance)
      // 3. We're not actively rotating the dodecahedron (no keys pressed)
      if (newDodecahedronHover && this.trackedObject && !this.isRotatingDodecahedron()) {
        this.showDodecahedronHighlight();
        this.onDistanceHighlight(); // Tutorial system integration
      } else {
        this.hideDodecahedronHighlight();
      }
    }
  }

  showWhiteDwarfUI() {
    if (this.whiteDwarfUI) {
      // Set position BEFORE making visible to prevent sliding
      this.updateWhiteDwarfUIPosition();
      // Small delay to ensure position is set before transition starts
      requestAnimationFrame(() => {
        this.whiteDwarfUI.classList.add('visible');
      });
    }
  }

  hideWhiteDwarfUI() {
    if (this.whiteDwarfUI) {
      this.whiteDwarfUI.classList.remove('visible');
    }
  }

  updateWhiteDwarfUIPosition() {
    if (!this.whiteDwarf || !this.whiteDwarfUI) return;

    // Get 2D screen position of white dwarf
    const vector = this.whiteDwarf.position.clone();
    vector.project(this.camera);

    // Convert to screen coordinates
    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (vector.y * -0.5 + 0.5) * window.innerHeight;

    // Calculate object's screen-space size for proportional UI scaling
    const objectWorldRadius = 0.15; // Gies visual radius in world units
    const tempVector = new THREE.Vector3();

    // Project object edge to screen space to get apparent size
    tempVector.copy(this.whiteDwarf.position);
    tempVector.x += objectWorldRadius;
    tempVector.project(this.camera);

    const edgeX = (tempVector.x * 0.5 + 0.5) * window.innerWidth;
    const objectScreenRadius = Math.abs(edgeX - x);

    // Scale UI circle with proper spacing around the object
    const spacingMultiplier = 4.0; // More space around the object
    const scaledSize = Math.max(60, Math.min(140, objectScreenRadius * spacingMultiplier));
    const halfSize = scaledSize / 2;

    // Apply scaling to the circle
    const circle = this.whiteDwarfUI.querySelector('.star-circle');
    if (circle) {
      circle.style.width = scaledSize + 'px';
      circle.style.height = scaledSize + 'px';

      // Scale only the ::before pseudo-element for a subtle outer ring
      const beforeSize = scaledSize + 20; // +10px on each side for subtle outer ring
      circle.style.setProperty('--before-size', beforeSize + 'px');
    }

    // Adjust info panel position to scale with circle
    const info = this.whiteDwarfUI.querySelector('.star-info');
    if (info) {
      info.style.top = halfSize + 10 + 'px';
    }

    // Position UI element (center based on scaled size)
    this.whiteDwarfUI.style.left = x - halfSize + 'px';
    this.whiteDwarfUI.style.top = y - halfSize + 'px';
  }

  // Chione UI methods
  showChioneUI() {
    if (this.chioneUI) {
      // Set position BEFORE making visible to prevent sliding
      this.updateChioneUIPosition();
      // Small delay to ensure position is set before transition starts
      requestAnimationFrame(() => {
        this.chioneUI.classList.add('visible');
      });
    }
  }

  hideChioneUI() {
    if (this.chioneUI) {
      this.chioneUI.classList.remove('visible');
    }
  }

  updateChioneUIPosition() {
    if (!this.chioneMesh || !this.chioneUI) return;

    // Get 2D screen position of Chione
    const vector = this.chioneMesh.position.clone();
    vector.project(this.camera);

    // Convert to screen coordinates
    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (vector.y * -0.5 + 0.5) * window.innerHeight;

    // Calculate object's screen-space size for proportional UI scaling
    const objectWorldRadius = 0.4; // Chione visual radius in world units
    const tempVector = new THREE.Vector3();

    // Project object edge to screen space to get apparent size
    tempVector.copy(this.chioneMesh.position);
    tempVector.x += objectWorldRadius;
    tempVector.project(this.camera);

    const edgeX = (tempVector.x * 0.5 + 0.5) * window.innerWidth;
    const objectScreenRadius = Math.abs(edgeX - x);

    // Scale UI circle with proper spacing around the object
    const spacingMultiplier = 3.5; // More space around the object
    const scaledSize = Math.max(70, Math.min(180, objectScreenRadius * spacingMultiplier));
    const halfSize = scaledSize / 2;

    // Apply scaling to the circle
    const circle = this.chioneUI.querySelector('.planet-circle');
    if (circle) {
      circle.style.width = scaledSize + 'px';
      circle.style.height = scaledSize + 'px';

      // Scale the ::before pseudo-element with better spacing
      const beforeSize = scaledSize + 20; // +10px on each side for better visibility
      circle.style.setProperty('--before-size', beforeSize + 'px');
    }

    // Adjust info panel position to scale with circle
    const info = this.chioneUI.querySelector('.star-info');
    if (info) {
      info.style.top = halfSize + 10 + 'px';
    }

    // Position UI element (center based on scaled size)
    this.chioneUI.style.left = x - halfSize + 'px';
    this.chioneUI.style.top = y - halfSize + 'px';
  }

  // Grand Voss UI methods
  showGrandVossUI() {
    if (this.grandVossUI) {
      // Set position BEFORE making visible to prevent sliding
      this.updateGrandVossUIPosition();
      // Small delay to ensure position is set before transition starts
      requestAnimationFrame(() => {
        this.grandVossUI.classList.add('visible');
      });
    }
  }

  hideGrandVossUI() {
    if (this.grandVossUI) {
      this.grandVossUI.classList.remove('visible');
    }
  }

  updateGrandVossUIPosition() {
    if (!this.grandVossMesh || !this.grandVossUI) return;

    // Get 2D screen position of Grand Voss
    const vector = this.grandVossMesh.position.clone();
    vector.project(this.camera);

    // Convert to screen coordinates
    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (vector.y * -0.5 + 0.5) * window.innerHeight;

    // Calculate object's screen-space size for proportional UI scaling
    const objectWorldRadius = 0.08; // Grand Voss visual radius in world units
    const tempVector = new THREE.Vector3();

    // Project object edge to screen space to get apparent size
    tempVector.copy(this.grandVossMesh.position);
    tempVector.x += objectWorldRadius;
    tempVector.project(this.camera);

    const edgeX = (tempVector.x * 0.5 + 0.5) * window.innerWidth;
    const objectScreenRadius = Math.abs(edgeX - x);

    // Scale UI circle with proper spacing around the object
    const spacingMultiplier = 5.0; // More space around the small moon
    const scaledSize = Math.max(50, Math.min(120, objectScreenRadius * spacingMultiplier));
    const halfSize = scaledSize / 2;

    // Apply scaling to the circle
    const circle = this.grandVossUI.querySelector('.moon-circle');
    if (circle) {
      circle.style.width = scaledSize + 'px';
      circle.style.height = scaledSize + 'px';

      // Scale the ::before pseudo-element with better spacing
      const beforeSize = scaledSize + 12; // +6px on each side for better visibility
      circle.style.setProperty('--before-size', beforeSize + 'px');
    }

    // Adjust info panel position to scale with circle
    const info = this.grandVossUI.querySelector('.star-info');
    if (info) {
      info.style.top = halfSize + 10 + 'px';
    }

    // Position UI element (center based on scaled size)
    this.grandVossUI.style.left = x - halfSize + 'px';
    this.grandVossUI.style.top = y - halfSize + 'px';
  }

  // Check if user is actively rotating the dodecahedron
  isRotatingDodecahedron() {
    return (
      this.keyStates['KeyW'] ||
      this.keyStates['KeyS'] ||
      this.keyStates['KeyA'] ||
      this.keyStates['KeyD'] ||
      this.keyStates['KeyQ'] ||
      this.keyStates['KeyE']
    );
  }

  // Dodecahedron highlight methods
  showDodecahedronHighlight() {
    if (!this.dodecahedron) return;

    // Create edge-only highlight if it doesn't exist
    if (!this.dodecahedronHighlight) {
      // Create base geometry first
      const baseGeometry = new THREE.DodecahedronGeometry(1.2); // Larger than original for distance visibility

      // Use EdgesGeometry to extract only the face edges (no internal lines)
      const edgesGeometry = new THREE.EdgesGeometry(baseGeometry);
      const edgesMaterial = new THREE.LineBasicMaterial({
        color: 0x00ffff, // Bright cyan for better visibility
        transparent: true,
        opacity: 0.8, // More opaque for distance viewing
        linewidth: 2, // Good visibility without being too thick
      });

      this.dodecahedronHighlight = new THREE.LineSegments(edgesGeometry, edgesMaterial);

      // Position and rotate to match the original dodecahedron
      this.dodecahedronHighlight.position.copy(this.dodecahedron.position);
      this.dodecahedronHighlight.rotation.copy(this.dodecahedron.rotation);

      // Add to scene
      this.scene.add(this.dodecahedronHighlight);
    }

    // Make the highlight visible
    this.dodecahedronHighlight.visible = true;

    // Animate the highlight - more pronounced pulsing for distance visibility
    const time = Date.now() * 0.004;
    const scale = 1.0 + Math.sin(time) * 0.15; // More pronounced pulsing for distance
    const opacity = 0.6 + Math.sin(time * 1.5) * 0.3; // Opacity pulsing too
    this.dodecahedronHighlight.scale.setScalar(scale);
    this.dodecahedronHighlight.material.opacity = opacity;

    // Update rotation and position to match the main dodecahedron
    this.dodecahedronHighlight.position.copy(this.dodecahedron.position);
    this.dodecahedronHighlight.rotation.copy(this.dodecahedron.rotation);

    console.log('Showing dodecahedron geometric wireframe highlight');
  }

  hideDodecahedronHighlight() {
    if (this.dodecahedronHighlight) {
      this.dodecahedronHighlight.visible = false;
    }
  }

  // Update dodecahedron highlight animation in render loop
  updateDodecahedronHighlight() {
    if (
      this.dodecahedronHighlight &&
      this.dodecahedronHighlight.visible &&
      this.isHoveringDodecahedron &&
      this.trackedObject &&
      !this.isRotatingDodecahedron()
    ) {
      // Animate the highlight - more pronounced pulsing for distance visibility
      const time = Date.now() * 0.004;
      const scale = 1.0 + Math.sin(time) * 0.15; // More pronounced pulsing for distance
      const opacity = 0.6 + Math.sin(time * 1.5) * 0.3; // Opacity pulsing too
      this.dodecahedronHighlight.scale.setScalar(scale);
      this.dodecahedronHighlight.material.opacity = opacity;

      // Update rotation and position to match the main dodecahedron
      this.dodecahedronHighlight.position.copy(this.dodecahedron.position);
      this.dodecahedronHighlight.rotation.copy(this.dodecahedron.rotation);
    }
  }

  // Hide all celestial body UIs
  hideAllCelestialUIs() {
    this.hideWhiteDwarfUI();
    this.hideChioneUI();
    this.hideGrandVossUI();
    this.hideDodecahedronHighlight();
  }

  // Tutorial System Methods
  initTutorialSystem() {
    try {
      // Set up progressive discovery
      this.setupProgressiveDiscovery();

      console.log('📚 Tutorial system initialized');
    } catch (error) {
      console.warn(
        '📚 Tutorial system failed to initialize (DOM elements missing):',
        error.message
      );
      // Continue without tutorial system
    }
  }

  // Helper method to bring a panel to front when expanded
  bringPanelToFront(activePanel) {
    // Reset all panels to base z-index
    const allPanels = document.querySelectorAll('.tutorial-panel');
    allPanels.forEach(panel => {
      panel.style.zIndex = '100';
    });

    // Bring the active panel to front
    activePanel.style.zIndex = '101';
  }

  setupProgressiveDiscovery() {
    // Discovery triggers for different features
    this.discoveryTriggers = {
      celestialHover: false,
      celestialTracking: false,
      dodecahedronRotation: false,
      returnToDodecahedron: false,
      distanceHighlight: false,
    };
  }

  triggerDiscovery(featureKey) {
    if (this.discoveryTriggers[featureKey]) return; // Already discovered

    this.discoveryTriggers[featureKey] = true;
    this.tutorialState.discoveredFeatures.add(featureKey);

    console.log(`🎯 Feature discovered: ${featureKey}`);
  }

  // Integration points with existing systems
  onCelestialHover() {
    this.triggerDiscovery('celestialHover');
  }

  onCelestialTracking() {
    this.triggerDiscovery('celestialTracking');
  }

  onDodecahedronRotation() {
    this.triggerDiscovery('dodecahedronRotation');
  }

  onReturnToDodecahedron() {
    this.triggerDiscovery('returnToDodecahedron');
  }

  onDistanceHighlight() {
    this.triggerDiscovery('distanceHighlight');
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    // Skip updates if paused, but still render to maintain image
    if (this.isPaused) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Update stellar time
    const deltaTime = 0.016; // ~60fps
    this.stellarTime += deltaTime * this.timeAcceleration;

    // Update star properties (variability only, no constant motion)
    this.updateStellarEvolution(deltaTime);

    // Update orbital mechanics
    this.updateOrbitalBodies(deltaTime);

    // Update LOD system based on camera position
    this.updateLODSystem();

    // Perform memory maintenance periodically
    this.performMemoryMaintenance();

    this.updateAnimations();
    this.updateCameraTracking(); // Follow selected objects as they orbit
    this.updateSmoothZoom();
    this.updateDodecahedronHighlight(); // Animate dodecahedron highlight
    this.handleKeyboardRotation();
    this.controls.update();

    // Update UI positions when camera moves (only for currently hovered objects)
    if (this.isHoveringWhiteDwarf || this.isHoveringChione || this.isHoveringGrandVoss) {
      // Only update if camera moved (controls.update() modifies camera)
      if (this.isHoveringWhiteDwarf) this.updateWhiteDwarfUIPosition();
      if (this.isHoveringChione) this.updateChioneUIPosition();
      if (this.isHoveringGrandVoss) this.updateGrandVossUIPosition();
    }

    this.renderer.render(this.scene, this.camera);
  }

  updateOrbitalBodies(deltaTime) {
    if (!this.chione || !this.grandVoss || !this.orbitalParams) return;

    const deltaMs = deltaTime * 1000; // Convert to milliseconds
    const whiteDwarfPos = { x: -15, y: 8, z: -10 }; // Gies position

    // Update Chione's orbital position around white dwarf
    this.orbitalParams.chione.time += deltaMs * this.orbitalParams.chione.speed;
    const chioneAngle = this.orbitalParams.chione.time;
    const chionePos = {
      x: whiteDwarfPos.x + Math.cos(chioneAngle) * this.orbitalParams.chione.radius,
      y: whiteDwarfPos.y, // Keep same Y as white dwarf for now
      z: whiteDwarfPos.z + Math.sin(chioneAngle) * this.orbitalParams.chione.radius,
    };

    // Update Grand Voss's orbital position around Chione (hierarchical orbit)
    this.orbitalParams.grandVoss.time += deltaMs * this.orbitalParams.grandVoss.speed;
    const grandVossAngle = this.orbitalParams.grandVoss.time;
    const grandVossPos = {
      x: chionePos.x + Math.cos(grandVossAngle) * this.orbitalParams.grandVoss.radius,
      y: chionePos.y, // Keep same Y as Chione
      z: chionePos.z + Math.sin(grandVossAngle) * this.orbitalParams.grandVoss.radius,
    };

    // Debug logging every 5 seconds
    if (Math.floor(this.stellarTime) % 5 === 0 && Math.floor(this.stellarTime * 10) % 10 === 0) {
      console.log(`White dwarf (Gies) position:`, whiteDwarfPos);
      console.log(`Chione position:`, chionePos);
      console.log(`Grand Voss position:`, grandVossPos);
      console.log(
        `Distance Gies to Chione:`,
        Math.sqrt(
          Math.pow(chionePos.x - whiteDwarfPos.x, 2) +
            Math.pow(chionePos.y - whiteDwarfPos.y, 2) +
            Math.pow(chionePos.z - whiteDwarfPos.z, 2)
        ).toFixed(3),
        'scene units'
      );
      console.log(
        `Distance Chione to Grand Voss:`,
        Math.sqrt(
          Math.pow(grandVossPos.x - chionePos.x, 2) +
            Math.pow(grandVossPos.y - chionePos.y, 2) +
            Math.pow(grandVossPos.z - chionePos.z, 2)
        ).toFixed(3),
        'scene units'
      );
    }

    // Update visual representations
    if (this.chioneMesh) {
      this.chioneMesh.position.set(chionePos.x, chionePos.y, chionePos.z);
    }

    if (this.grandVossMesh) {
      this.grandVossMesh.position.set(grandVossPos.x, grandVossPos.y, grandVossPos.z);
    }
  }

  // Optimized Variable Star System
  updateStellarEvolution(deltaTime) {
    if (!this.starField || !this.starProperties.length) return;

    // Only process variable stars if enabled at current LOD level
    if (!this.isFeatureEnabledAtCurrentLOD('enableVariability')) return;

    const geometry = this.starField.geometry;
    const sizes = geometry.attributes.size;
    const colors = geometry.attributes.color;

    // Throttle updates - process only a subset of variable stars per frame
    const frameIndex = Math.floor(this.stellarTime * 10) % 60; // 60-frame cycle
    const variableStars = this.getVariableStarsForFrame(frameIndex);

    if (variableStars.length === 0) return;

    let needsSizeUpdate = false;
    let needsColorUpdate = false;

    variableStars.forEach(({ star, geometryIndex }) => {
      if (geometryIndex >= sizes.count) return;

      const variationData = this.calculateVariableStarVariation(star, this.stellarTime);

      if (variationData.magnitudeChanged) {
        // Update magnitude and size
        star.current_magnitude = variationData.magnitude;
        const baseSize = this.magnitudeToSize(star.current_magnitude);
        const newSize = baseSize * this.getLuminosityMultiplier(star.luminosity_class);

        // Smooth interpolation to prevent jarring transitions
        const currentSize = sizes.getX(geometryIndex);
        const smoothedSize = currentSize + (newSize - currentSize) * 0.15;
        sizes.setX(geometryIndex, smoothedSize);
        needsSizeUpdate = true;
      }

      if (variationData.colorChanged && this.lodSystem.currentLevel <= 1) {
        // Update color only for close LOD levels
        const colorShift = variationData.colorShift;
        const originalColor = star.baseColor;
        const newColor = {
          r: Math.max(0, Math.min(1, originalColor.r + colorShift.r)),
          g: Math.max(0, Math.min(1, originalColor.g + colorShift.g)),
          b: Math.max(0, Math.min(1, originalColor.b + colorShift.b)),
        };

        colors.setXYZ(geometryIndex, newColor.r, newColor.g, newColor.b);
        needsColorUpdate = true;
      }
    });

    // Update geometry attributes if needed
    if (needsSizeUpdate) sizes.needsUpdate = true;
    if (needsColorUpdate) colors.needsUpdate = true;
  }

  // Get variable stars to process for current frame (distributed loading)
  getVariableStarsForFrame(frameIndex) {
    if (!this.variableStarCache) {
      this.buildVariableStarCache();
    }

    const starsPerFrame = Math.ceil(this.variableStarCache.length / 60);
    const startIndex = frameIndex * starsPerFrame;
    const endIndex = Math.min(startIndex + starsPerFrame, this.variableStarCache.length);

    return this.variableStarCache.slice(startIndex, endIndex);
  }

  // Build cache of variable stars for efficient processing
  buildVariableStarCache() {
    this.variableStarCache = [];

    this.starProperties.forEach((star, index) => {
      if (star.variable_type && star.variable_period) {
        // Only include stars that are actually visible in current LOD
        if (index < this.lodSystem.levels[this.lodSystem.currentLevel].maxStars) {
          this.variableStarCache.push({
            star: star,
            geometryIndex: index,
            lastUpdateTime: 0,
            updateInterval: this.calculateVariableUpdateInterval(star),
          });
        }
      }
    });

    console.log(`📊 Built variable star cache: ${this.variableStarCache.length} stars`);
  }

  // Calculate how often each variable star should update
  calculateVariableUpdateInterval(star) {
    // Faster variables update more frequently
    const periodDays = star.variable_period;
    if (periodDays < 1) return 5; // Very fast variables (RR Lyrae)
    if (periodDays < 10) return 15; // Cepheids
    if (periodDays < 100) return 30; // Semi-regular
    return 60; // Slow irregular variables
  }

  // Calculate variable star brightness and color variations
  calculateVariableStarVariation(star, currentTime) {
    const timeSinceLastUpdate = currentTime - (star.lastVariableUpdate || 0);
    const updateInterval = this.calculateVariableUpdateInterval(star);

    // Skip if not enough time has passed
    if (timeSinceLastUpdate < updateInterval) {
      return { magnitudeChanged: false, colorChanged: false };
    }

    star.lastVariableUpdate = currentTime;

    // Calculate phase in variable cycle
    const cycleDuration = star.variable_period * 365.25; // Convert days to simulation time
    const phase =
      (currentTime / this.timeAcceleration / cycleDuration) * 2 * Math.PI + star.variable_phase;

    let magnitudeChange = 0;
    let temperatureChange = 0;

    switch (star.variable_type) {
      case 'cepheid':
        // Classical Cepheid pulsation with temperature variation
        magnitudeChange = star.variable_amplitude * 0.4 * Math.sin(phase);
        temperatureChange = 200 * Math.sin(phase + Math.PI / 4); // Temperature lags brightness
        break;

      case 'rr_lyrae':
        // RR Lyrae with characteristic asymmetric light curve
        const asymmetricPhase = Math.sin(phase) + 0.3 * Math.sin(2 * phase);
        magnitudeChange = star.variable_amplitude * 0.5 * asymmetricPhase;
        temperatureChange = 300 * asymmetricPhase;
        break;

      case 'semiregular':
        // Multiple period semiregular variable
        const primaryCycle = Math.sin(phase);
        const secondaryCycle = 0.3 * Math.sin(phase * 0.7 + Math.PI / 3);
        magnitudeChange = star.variable_amplitude * 0.3 * (primaryCycle + secondaryCycle);
        temperatureChange = 150 * primaryCycle;
        break;

      case 'irregular':
        // Chaotic irregular variability
        const noise1 = Math.sin(phase) * 0.7;
        const noise2 = Math.sin(phase * 1.3 + 1) * 0.3;
        const noise3 = Math.sin(phase * 2.1 + 2) * 0.1;
        magnitudeChange = star.variable_amplitude * 0.2 * (noise1 + noise2 + noise3);
        temperatureChange = 100 * noise1;
        break;

      default:
        return { magnitudeChanged: false, colorChanged: false };
    }

    // Apply limits to prevent extreme variations
    magnitudeChange = Math.max(
      -star.variable_amplitude,
      Math.min(star.variable_amplitude, magnitudeChange)
    );

    const newMagnitude = star.original_magnitude + magnitudeChange;
    const magnitudeChanged = Math.abs(newMagnitude - star.current_magnitude) > 0.01;

    // Calculate color shift based on temperature change
    let colorShift = { r: 0, g: 0, b: 0 };
    if (Math.abs(temperatureChange) > 50) {
      const tempFactor = temperatureChange / 1000; // Normalize
      colorShift = {
        r: tempFactor > 0 ? tempFactor * 0.1 : 0,
        g: Math.abs(tempFactor) * 0.05,
        b: tempFactor < 0 ? -tempFactor * 0.1 : 0,
      };
    }

    return {
      magnitude: newMagnitude,
      magnitudeChanged,
      colorShift,
      colorChanged: Math.abs(temperatureChange) > 50,
      temperatureChange,
    };
  }

  // Rebuild variable star cache when LOD changes
  onLODChanged() {
    this.buildVariableStarCache();
  }

  // Memory Management System
  async initializeWorkers() {
    try {
      // Initialize LOD System first
      const { AdvancedLODSystem } = await import('./modules/lod-system.js');
      this.advancedLOD = new AdvancedLODSystem();
      console.log('✅ LOD System initialized');

      // Try to initialize workers
      if (typeof Worker !== 'undefined') {
        // Initialize Orbital Worker
        try {
          this.workers.orbital = new Worker('./workers/orbital-worker.js');
          this.workers.orbital.onmessage = this.handleOrbitalWorkerMessage.bind(this);
          this.workers.orbital.onerror = error => {
            console.warn('Orbital Worker error, falling back:', error);
            this.workers.fallbackMode = true;
          };
        } catch (error) {
          console.warn('Failed to create orbital worker:', error);
        }

        // Initialize Stellar Worker
        try {
          this.workers.stellar = new Worker('./workers/stellar-worker.js');
          this.workers.stellar.onmessage = this.handleStellarWorkerMessage.bind(this);
          this.workers.stellar.onerror = error => {
            console.warn('Stellar Worker error, falling back:', error);
            this.workers.fallbackMode = true;
          };
        } catch (error) {
          console.warn('Failed to create stellar worker:', error);
        }

        // Wait for workers to be ready (with timeout)
        await Promise.race([
          this.waitForWorkersReady(),
          new Promise(resolve => setTimeout(resolve, 5000)), // 5 second timeout
        ]);

        this.workers.initialized = true;
        console.log('✅ Web Workers initialized successfully');
      } else {
        console.warn('Web Workers not supported, using fallback mode');
        this.workers.fallbackMode = true;
      }
    } catch (error) {
      console.error('Worker initialization failed:', error);
      this.workers.fallbackMode = true;
      this.workers.initialized = false;
    }
  }

  waitForWorkersReady() {
    return new Promise(resolve => {
      let readyCount = 0;
      const expectedWorkers = 2;

      const checkReady = () => {
        readyCount++;
        if (readyCount >= expectedWorkers) {
          resolve();
        }
      };

      if (this.workers.orbital) {
        this.workers.orbital.postMessage({ type: 'ping' });
        this.workers.orbital.addEventListener('message', function handler(e) {
          if (e.data.type === 'worker-ready' || e.data.type === 'pong') {
            this.removeEventListener('message', handler);
            checkReady();
          }
        });
      } else {
        checkReady();
      }

      if (this.workers.stellar) {
        this.workers.stellar.postMessage({ type: 'ping' });
        this.workers.stellar.addEventListener('message', function handler(e) {
          if (e.data.type === 'stellar-worker-ready' || e.data.type === 'pong') {
            this.removeEventListener('message', handler);
            checkReady();
          }
        });
      } else {
        checkReady();
      }
    });
  }

  handleOrbitalWorkerMessage(event) {
    const { type, taskId, result, error } = event.data;

    if (error) {
      console.error('Orbital worker error:', error);
      return;
    }

    switch (type) {
      case 'orbital-batch-result':
        this.updateOrbitalBodiesFromWorker(result);
        break;
      case 'worker-ready':
        console.log('✅ Orbital worker ready');
        break;
      default:
        console.log('Orbital worker message:', type);
    }
  }

  handleStellarWorkerMessage(event) {
    const { type, taskId, result, error } = event.data;

    if (error) {
      console.error('Stellar worker error:', error);
      return;
    }

    switch (type) {
      case 'star-field-generated':
        this.updateStarFieldFromWorker(result);
        break;
      case 'star-generation-progress':
        this.updateLoadingProgress(event.data.progress);
        break;
      case 'stellar-worker-ready':
        console.log('✅ Stellar worker ready');
        break;
      default:
        console.log('Stellar worker message:', type);
    }
  }

  updateOrbitalBodiesFromWorker(results) {
    // Update orbital body positions from worker calculations
    results.forEach((bodyData, index) => {
      if (this.orbitalBodies[index]) {
        const body = this.orbitalBodies[index];
        body.position.copy(bodyData.position);
        body.userData.meanAnomaly = bodyData.meanAnomaly;
      }
    });
  }

  updateStarFieldFromWorker(stars) {
    // Update star field from worker-generated data
    if (stars && stars.length > 0) {
      this.starProperties = stars;
      this.updateStarField();
      this.hideLoading();
    }
  }

  updateLoadingProgress(progress) {
    const loading = document.getElementById('loading');
    if (loading) {
      loading.innerHTML = `
                <div style="text-align: center;">
                    <div style="margin-bottom: 15px; font-size: 18px;">Generating Star Field...</div>
                    <div style="width: 250px; height: 6px; background: rgba(255,255,255,0.2); border-radius: 3px; margin: 0 auto; position: relative; overflow: hidden;">
                        <div style="width: ${progress}%; height: 100%; background: linear-gradient(90deg, #4a9eff, #00d4ff); border-radius: 3px; transition: width 0.5s ease; position: absolute; left: 0; top: 0;"></div>
                    </div>
                    <div style="margin-top: 12px; font-size: 14px; opacity: 0.9; color: #4a9eff;">${Math.round(progress)}% Complete</div>
                </div>
            `;
    }
  }

  hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
      loading.style.display = 'none';
    }
  }

  initializeMemoryOptimizations() {
    // Set up memory monitoring
    this.memoryStats = {
      geometrySize: 0,
      textureSize: 0,
      lastGC: 0,
      gcThreshold: 30000, // 30 seconds
    };

    // Pre-allocate commonly used objects to reduce GC pressure
    this.reusableObjects = {
      vector3Pool: Array(50)
        .fill()
        .map(() => new THREE.Vector3()),
      vector3PoolIndex: 0,
      colorPool: Array(20)
        .fill()
        .map(() => new THREE.Color()),
      colorPoolIndex: 0,
    };

    // Optimized star data structure using typed arrays for better memory layout
    this.optimizedStarData = {
      positions: null,
      colors: null,
      sizes: null,
      brightness: null,
      indices: null, // For efficient sorting/filtering
    };
  }

  // Get reusable Vector3 from pool to reduce allocations
  getPooledVector3() {
    const obj = this.reusableObjects.vector3Pool[this.reusableObjects.vector3PoolIndex];
    this.reusableObjects.vector3PoolIndex =
      (this.reusableObjects.vector3PoolIndex + 1) % this.reusableObjects.vector3Pool.length;
    return obj.set(0, 0, 0);
  }

  // Get reusable Color from pool
  getPooledColor() {
    const obj = this.reusableObjects.colorPool[this.reusableObjects.colorPoolIndex];
    this.reusableObjects.colorPoolIndex =
      (this.reusableObjects.colorPoolIndex + 1) % this.reusableObjects.colorPool.length;
    return obj.set(0xffffff);
  }

  // Compress star properties for memory efficiency
  compressStarProperties(starProperties) {
    const compressed = {
      // Use typed arrays for better memory efficiency and cache performance
      positions: new Float32Array(starProperties.length * 3),
      colors: new Float32Array(starProperties.length * 3),
      magnitudes: new Float32Array(starProperties.length),
      spectralTypes: new Uint8Array(starProperties.length), // Encoded spectral classes
      luminosityClasses: new Uint8Array(starProperties.length),
      variableFlags: new Uint16Array(starProperties.length), // Bitfield for variable properties

      // Keep only essential properties in full object form
      essentialProps: [],

      // Lookup tables for compression
      spectralClassLookup: ['O', 'B', 'A', 'F', 'G', 'K', 'M'],
      luminosityClassLookup: ['I', 'II', 'III', 'IV', 'V'],
    };

    starProperties.forEach((star, i) => {
      // Positions
      compressed.positions[i * 3] = star.position.x;
      compressed.positions[i * 3 + 1] = star.position.y;
      compressed.positions[i * 3 + 2] = star.position.z;

      // Colors
      compressed.colors[i * 3] = star.baseColor.r;
      compressed.colors[i * 3 + 1] = star.baseColor.g;
      compressed.colors[i * 3 + 2] = star.baseColor.b;

      // Magnitudes
      compressed.magnitudes[i] = star.original_magnitude;

      // Encode spectral and luminosity classes as indices
      const spectralIndex =
        compressed.spectralClassLookup.indexOf(star.spectral_class?.charAt(0)) || 4;
      compressed.spectralTypes[i] = spectralIndex;

      const lumIndex = compressed.luminosityClassLookup.indexOf(star.luminosity_class) || 4;
      compressed.luminosityClasses[i] = lumIndex;

      // Use bitfield for variable star flags
      let flags = 0;
      if (star.variable_type) flags |= 1;
      if (star.is_binary) flags |= 2;
      if (star.isBackground) flags |= 4;
      compressed.variableFlags[i] = flags;

      // Keep only important stars in full form
      if (i < 100 || star.variable_type || star.is_binary) {
        compressed.essentialProps[i] = star;
      }
    });

    return compressed;
  }

  // Periodic memory cleanup
  performMemoryMaintenance() {
    const now = Date.now();
    if (now - this.memoryStats.lastGC < this.memoryStats.gcThreshold) return;

    this.memoryStats.lastGC = now;

    // Clean up unused geometries and materials
    this.cleanupUnusedResources();

    // Rebuild compressed data if needed
    if (this.starProperties.length > 1000) {
      this.optimizedStarData = this.compressStarProperties(this.starProperties);
      console.log('🧹 Compressed star data for memory efficiency');
    }

    // Suggest garbage collection (modern browsers will ignore if not needed)
    if (window.gc) {
      window.gc();
    }
  }

  cleanupUnusedResources() {
    // Clean up old geometries and materials
    if (this.starField && this.starField.geometry) {
      const geometry = this.starField.geometry;

      // Only keep necessary attributes
      const keepAttributes = ['position', 'color', 'size'];
      const attributeNames = Object.keys(geometry.attributes);

      attributeNames.forEach(name => {
        if (!keepAttributes.includes(name)) {
          geometry.deleteAttribute(name);
        }
      });
    }

    // Clear unnecessary caches periodically
    if (this.variableStarCache && this.variableStarCache.length > 500) {
      this.variableStarCache = this.variableStarCache.slice(0, 300);
    }
  }

  // Efficient star field updates using compressed data
  updateStarFieldFromCompressed(lodLevel) {
    if (!this.optimizedStarData.positions) return;

    const config = this.lodSystem.levels[lodLevel];
    const maxStars = config.maxStars;

    // Use views into typed arrays for zero-copy slicing
    const positions = this.optimizedStarData.positions.subarray(0, maxStars * 3);
    const colors = this.optimizedStarData.colors.subarray(0, maxStars * 3);

    // Generate sizes on demand to save memory
    const sizes = new Float32Array(maxStars);
    for (let i = 0; i < maxStars; i++) {
      const magnitude = this.optimizedStarData.magnitudes[i];
      const spectralIndex = this.optimizedStarData.spectralTypes[i];
      const lumIndex = this.optimizedStarData.luminosityClasses[i];

      let size = this.magnitudeToSize(magnitude);
      size *= this.getLuminosityMultiplierFromIndex(lumIndex);
      size = Math.max(config.minSize, size);

      sizes[i] = size;
    }

    // Update geometry efficiently
    const geometry = this.starField.geometry;
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;
  }

  getLuminosityMultiplierFromIndex(index) {
    const multipliers = [2.8, 2.0, 1.6, 1.3, 1.1]; // I, II, III, IV, V
    return multipliers[index] || 1.1;
  }
}

// Export the class for dynamic imports
export { StellarDodecahedronViewer };
