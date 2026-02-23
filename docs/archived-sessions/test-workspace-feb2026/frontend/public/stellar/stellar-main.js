/**
 * Secure ES6 Module Loader for Stellar Dodecahedron Viewer
 * Imports Three.js dependencies and exports the stellar viewer securely
 */

// Import Three.js core
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

export class StellarDodecahedronViewer {
  constructor(options = {}) {
    console.log('🚀 Initializing StellarDodecahedronViewer...');

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
    };

    // Tutorial system
    this.tutorialStage = 0;
    this.tutorialVisible = options.tutorial !== false;
    this.discoveredFeatures = new Set();

    // Performance monitoring
    this.performanceMetrics = {
      frameCount: 0,
      lastFPSCheck: Date.now(),
      currentFPS: 60,
      averageFPS: 60,
      minFPS: 60,
      memoryUsage: 0,
    };

    // Orbital mechanics
    this.orbitalBodies = [];
    this.centralBodyPosition = { x: -15, y: 8, z: -10 }; // Gies white dwarf position

    // Time and animation
    this.lastTime = Date.now();
    this.timeScale = 1000; // Speed up orbital motion
    this.isRunning = false;
    this.animationFrameId = null;

    // Mouse and interaction
    this.mouse = { x: 0, y: 0 };
    this.raycaster = null;
    this.hoveredObject = null;
    this.selectedObject = null;

    // Initialize viewer
    this.init();
    this.initializeMemoryOptimizations();
    this.setupEventListeners();
    this.animate();

    // Load stars asynchronously with progress feedback
    this.initializeAsync();
  }

  async initializeAsync() {
    try {
      // Allow scene to render first, then load heavy features
      setTimeout(async () => {
        await this.loadStarDataProgressive();
        this.createOrbitalSystem();

        // Notify completion
        this.loadingCallbacks.onLoadComplete();
      }, 10); // Minimal delay to allow first frame
    } catch (error) {
      console.error('Async initialization failed:', error);
      if (this.loadingCallbacks.onError) {
        this.loadingCallbacks.onError(error.message);
      }
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
    if (container) {
      container.appendChild(this.renderer.domElement);
      console.log('✅ Renderer attached to canvas-container');
    } else {
      console.error('❌ canvas-container element not found');
      throw new Error('canvas-container element required');
    }

    // OrbitControls setup
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 1000;
    this.controls.maxPolarAngle = Math.PI;

    // Raycaster for object selection
    this.raycaster = new THREE.Raycaster();

    this.createDodecahedron();
    this.initLighting();

    console.log('✅ Core initialization complete');
  }

  createDodecahedron() {
    const geometry = new THREE.DodecahedronGeometry(50, 0);
    const material = new THREE.MeshLambertMaterial({
      color: 0x1e5a8a,
      transparent: true,
      opacity: 0.6,
    });

    this.dodecahedron = new THREE.Mesh(geometry, material);
    this.dodecahedron.castShadow = true;
    this.dodecahedron.receiveShadow = true;
    this.scene.add(this.dodecahedron);

    console.log('✅ Dodecahedron created');
  }

  initLighting() {
    // White dwarf light source (Gies)
    const whiteDwarfLight = new THREE.PointLight(0xb4ccff, 3.5, 0, 2);
    whiteDwarfLight.position.copy(this.centralBodyPosition);
    whiteDwarfLight.castShadow = true;
    whiteDwarfLight.shadow.mapSize.width = 2048;
    whiteDwarfLight.shadow.mapSize.height = 2048;
    whiteDwarfLight.shadow.camera.near = 0.1;
    whiteDwarfLight.shadow.camera.far = 100;
    whiteDwarfLight.shadow.bias = -0.0001;
    whiteDwarfLight.shadow.normalBias = 0.02;

    this.scene.add(whiteDwarfLight);

    // Create visual white dwarf
    const whiteDwarfGeometry = new THREE.SphereGeometry(0.15, 32, 32);
    const whiteDwarfMaterial = new THREE.MeshBasicMaterial({
      color: 0xb4ccff,
      emissive: 0x334466,
    });

    this.whiteDwarf = new THREE.Mesh(whiteDwarfGeometry, whiteDwarfMaterial);
    this.whiteDwarf.position.copy(whiteDwarfLight.position);
    this.whiteDwarf.userData = { name: 'Gies', type: 'white_dwarf' };
    this.scene.add(this.whiteDwarf);

    // Add ambient lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(ambientLight);

    console.log('✅ Lighting system initialized');
  }

  async loadStarDataProgressive() {
    console.log('⭐ Loading stellar data...');

    // Create star field with scientific accuracy
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 2000;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    // Generate stars with proper distribution
    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;

      // Spherical distribution for realistic star field
      const radius = 1000 + Math.random() * 1000;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      // Realistic star colors based on temperature
      const temp = 2400 + Math.random() * 47600; // 2400K to 50000K range
      const color = this.temperatureToColor(temp);
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 2,
      transparent: true,
      opacity: 0.8,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });

    this.starField = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(this.starField);

    console.log(`✅ Star field created with ${starCount} stars`);
  }

  temperatureToColor(temperature) {
    // Convert stellar temperature to RGB color using blackbody radiation
    let r, g, b;

    if (temperature < 3500) {
      r = 1.0;
      g = Math.max(0, Math.min(1, (temperature - 1000) / 2500));
      b = 0.0;
    } else if (temperature < 5000) {
      r = 1.0;
      g = 0.39 * Math.log(temperature / 3500) + 0.61;
      b = Math.max(0, 1.292 * Math.log(temperature / 3500) - 1.292);
    } else if (temperature < 6600) {
      r = 1.292 - 0.204 * Math.log(temperature / 5000);
      g = 0.39 * Math.log(temperature / 5000) + 0.61;
      b = 1.0;
    } else {
      r = 1.292 - 0.204 * Math.log(temperature / 6600);
      g = 1.292 - 0.204 * Math.log(temperature / 6600);
      b = 1.0;
    }

    return {
      r: Math.max(0, Math.min(1, r)),
      g: Math.max(0, Math.min(1, g)),
      b: Math.max(0, Math.min(1, b)),
    };
  }

  createOrbitalSystem() {
    console.log('🪐 Creating orbital system...');

    const giesMass = 0.6 * SOLAR_MASS;

    // Create planet Chione (Super-Earth)
    const chioneGeometry = new THREE.SphereGeometry(0.4, 32, 32);
    const chioneMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a9edb,
      roughness: 0.8,
      metalness: 0.0,
    });
    this.chioneMesh = new THREE.Mesh(chioneGeometry, chioneMaterial);
    this.chioneMesh.castShadow = true;
    this.chioneMesh.receiveShadow = true;
    this.chioneMesh.userData = { name: 'Chione', type: 'planet' };
    this.scene.add(this.chioneMesh);

    // Create moon Grand Voss
    const grandVossGeometry = new THREE.SphereGeometry(0.08, 32, 32);
    const grandVossMaterial = new THREE.MeshStandardMaterial({
      color: 0xc0c0c0,
      roughness: 0.9,
      metalness: 0.0,
    });
    this.grandVossMesh = new THREE.Mesh(grandVossGeometry, grandVossMaterial);
    this.grandVossMesh.castShadow = true;
    this.grandVossMesh.receiveShadow = true;
    this.grandVossMesh.userData = { name: 'Grand Voss', type: 'moon' };
    this.scene.add(this.grandVossMesh);

    // Create orbital bodies with Keplerian elements
    const chione = new OrbitalBody({
      name: 'Chione',
      type: 'planet',
      mass: 5.0 * 5.972e24, // 5 Earth masses
      radius: 0.4,
      visualRadius: 0.4,
      semiMajorAxis: 2.5 * AU,
      eccentricity: 0.15,
      inclination: (12 * Math.PI) / 180,
      longitudeOfAscendingNode: (45 * Math.PI) / 180,
      argumentOfPeriapsis: (30 * Math.PI) / 180,
      meanAnomalyAtEpoch: 0,
      centralMass: giesMass,
      visualScale: 1,
    });
    chione.centralBodyPosition = this.centralBodyPosition;
    chione.mesh = this.chioneMesh;

    const grandVoss = new OrbitalBody({
      name: 'Grand Voss',
      type: 'moon',
      mass: 1.2 * LUNA_MASS,
      radius: 0.08,
      visualRadius: 0.08,
      semiMajorAxis: 0.02 * AU,
      eccentricity: 0.05,
      inclination: (5 * Math.PI) / 180,
      longitudeOfAscendingNode: (90 * Math.PI) / 180,
      argumentOfPeriapsis: 0,
      meanAnomalyAtEpoch: (90 * Math.PI) / 180,
      centralMass: chione.mass,
      parentBody: chione,
      visualScale: 1,
    });
    grandVoss.mesh = this.grandVossMesh;

    this.orbitalBodies = [chione, grandVoss];

    console.log('✅ Orbital system created');
  }

  setupEventListeners() {
    // Window resize
    window.addEventListener('resize', () => this.handleResize());

    // Keyboard controls
    document.addEventListener('keydown', e => this.handleKeyDown(e));
    document.addEventListener('keyup', e => this.handleKeyUp(e));

    // Mouse controls for object selection
    this.renderer.domElement.addEventListener('dblclick', e => this.handleDoubleClick(e));

    console.log('✅ Event listeners setup');
  }

  handleResize() {
    if (!this.camera || !this.renderer) return;

    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  handleKeyDown(event) {
    this.keyStates[event.code] = true;
  }

  handleKeyUp(event) {
    this.keyStates[event.code] = false;
  }

  handleDoubleClick(event) {
    if (!this.raycaster) return;

    // Update mouse coordinates
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Cast ray
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check for intersections with celestial bodies
    const celestialObjects = [
      this.whiteDwarf,
      this.chioneMesh,
      this.grandVossMesh,
      this.dodecahedron,
    ].filter(obj => obj);

    const intersects = this.raycaster.intersectObjects(celestialObjects);

    if (intersects.length > 0) {
      this.focusOnObject(intersects[0].object);
    } else {
      this.resetCamera();
    }
  }

  focusOnObject(object) {
    if (!object || !this.controls) return;

    const targetPosition = object.position.clone();
    let distance = 3;

    // Determine appropriate distance based on object
    if (object === this.whiteDwarf) distance = 3;
    if (object === this.chioneMesh) distance = 2;
    if (object === this.grandVossMesh) distance = 1;
    if (object === this.dodecahedron) distance = 200;

    this.animateCameraTo(targetPosition, distance);
  }

  resetCamera() {
    if (!this.controls) return;

    const targetPosition = new THREE.Vector3(0, 0, 0);
    this.animateCameraTo(targetPosition, 200);
  }

  animateCameraTo(targetPosition, distance) {
    if (!this.camera || !this.controls) return;

    const direction = new THREE.Vector3();
    direction.subVectors(this.camera.position, targetPosition).normalize();

    const newPosition = new THREE.Vector3();
    newPosition.copy(targetPosition).add(direction.multiplyScalar(distance));

    // Animate using simple lerp
    const animate = () => {
      this.camera.position.lerp(newPosition, 0.05);
      this.controls.target.lerp(targetPosition, 0.05);
      this.controls.update();

      if (this.camera.position.distanceTo(newPosition) > 0.1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  updateOrbitalMechanics(deltaTime) {
    // Update orbital body positions
    for (const body of this.orbitalBodies) {
      body.updatePosition(deltaTime, this.timeScale);

      // Update mesh position
      if (body.mesh) {
        body.mesh.position.set(
          body.currentPosition.x,
          body.currentPosition.y,
          body.currentPosition.z
        );
      }
    }
  }

  initializeMemoryOptimizations() {
    // Optimize garbage collection and memory usage
    this.memoryPool = {
      vectors: [],
      quaternions: [],
      matrices: [],
    };
  }

  animate(currentTime = Date.now()) {
    if (!this.isRunning) {
      this.isRunning = true;
      console.log('✅ Animation loop started');
    }

    this.animationFrameId = requestAnimationFrame(time => this.animate(time));

    const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
    this.lastTime = currentTime;

    // Limit delta time to prevent large jumps
    const clampedDeltaTime = Math.min(deltaTime, 0.05);

    // Update orbital mechanics
    this.updateOrbitalMechanics(clampedDeltaTime);

    // WASD controls for dodecahedron rotation
    if (this.keyStates['KeyW']) this.dodecahedron.rotation.x -= this.rotationSpeed;
    if (this.keyStates['KeyS']) this.dodecahedron.rotation.x += this.rotationSpeed;
    if (this.keyStates['KeyA']) this.dodecahedron.rotation.y -= this.rotationSpeed;
    if (this.keyStates['KeyD']) this.dodecahedron.rotation.y += this.rotationSpeed;
    if (this.keyStates['KeyQ']) this.dodecahedron.rotation.z -= this.rotationSpeed;
    if (this.keyStates['KeyE']) this.dodecahedron.rotation.z += this.rotationSpeed;

    // Auto-rotation when not manually controlled
    const isManuallyControlled =
      this.keyStates['KeyW'] ||
      this.keyStates['KeyS'] ||
      this.keyStates['KeyA'] ||
      this.keyStates['KeyD'] ||
      this.keyStates['KeyQ'] ||
      this.keyStates['KeyE'];

    if (!isManuallyControlled && this.dodecahedron) {
      this.dodecahedron.rotation.x += 0.001;
      this.dodecahedron.rotation.y += 0.002;
    }

    // Rotate star field slowly
    if (this.starField) {
      this.starField.rotation.y += 0.0002;
    }

    // Update controls
    if (this.controls) {
      this.controls.update();
    }

    // Render the scene
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }

    // Update performance metrics
    this.updatePerformanceMetrics();
  }

  updatePerformanceMetrics() {
    this.performanceMetrics.frameCount++;
    const now = Date.now();

    if (now - this.performanceMetrics.lastFPSCheck >= 1000) {
      const fps =
        (this.performanceMetrics.frameCount * 1000) / (now - this.performanceMetrics.lastFPSCheck);
      this.performanceMetrics.currentFPS = Math.round(fps);
      this.performanceMetrics.frameCount = 0;
      this.performanceMetrics.lastFPSCheck = now;

      // Track performance statistics
      if (this.performanceMetrics.currentFPS < this.performanceMetrics.minFPS) {
        this.performanceMetrics.minFPS = this.performanceMetrics.currentFPS;
      }
    }

    // Update memory usage if available
    if (performance.memory) {
      this.performanceMetrics.memoryUsage = Math.round(
        performance.memory.usedJSHeapSize / 1024 / 1024
      );
    }
  }

  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  dispose() {
    console.log('🧹 Disposing StellarDodecahedronViewer...');

    // Cancel animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Dispose Three.js resources
    if (this.scene) {
      this.scene.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      this.scene.clear();
    }

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }

    if (this.controls) {
      this.controls.dispose();
    }

    // Remove event listeners
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);

    this.isRunning = false;
    console.log('✅ Disposal complete');
  }
}
