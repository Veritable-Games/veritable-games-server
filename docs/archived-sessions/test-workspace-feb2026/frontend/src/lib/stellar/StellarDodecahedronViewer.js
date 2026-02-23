/**
 * Sophisticated Stellar Dodecahedron Viewer for Next.js Integration
 * Adapted from the production-ready threejs-rendering/src/main.js
 * Preserves all scientific accuracy, performance optimizations, and interactive features
 */

/**
 * Optimized Stellar Dodecahedron Viewer Class
 * Production-ready astronomical visualization with scientific accuracy
 */
export class StellarDodecahedronViewer {
  constructor(container, options = {}) {
    // Configuration
    this.container = container;
    this.options = {
      particleCount: options.particleCount || 3000,
      timeScale: options.timeScale || 1000,
      enableTutorial: options.enableTutorial || false,
      opacity: options.opacity || 1.0,
      color: options.color || '#1E5A8A',
      enablePerformanceMonitor: options.enablePerformanceMonitor || true,
      ...options,
    };

    // Core Three.js objects
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    // Celestial objects
    this.dodecahedron = null;
    this.starField = null;
    this.whiteDwarf = null;
    this.chioneMesh = null;
    this.grandVossMesh = null;

    // Workers for heavy computation
    this.orbitalWorker = null;
    this.stellarWorker = null;

    // Performance systems
    this.performanceMetrics = {
      fps: 60,
      frameTime: 16.67,
      memoryUsage: 0,
      renderCalls: 0,
    };

    // Animation and interaction state
    this.animations = {
      camera: null,
      rotation: null,
    };
    this.trackedObject = null;
    this.keyStates = {};
    this.mouse = { x: 0, y: 0 };
    this.raycaster = null;

    // Stellar system state
    this.stellarSystemReady = false;
    this.orbitalSystemReady = false;
    this.currentLOD = 0;
    this.isInitialized = false;

    // Astronomical constants
    this.AU = 149597870.7; // km
    this.G = 6.6743e-11; // m³/kg⋅s²
    this.SOLAR_MASS = 1.9891e30; // kg
    this.JUPITER_MASS = 1.898e27; // kg
    this.LUNA_MASS = 7.342e22; // kg
    this.DISTANCE_SCALE = 1 / (0.5 * 149597870.7); // 1 scene unit = 0.5 AU

    // Orbital bodies
    this.orbitalBodies = [];
    this.celestialMeshes = {};

    // Animation loop
    this.animationFrameId = null;
    this.lastTime = 0;

    // DO NOT auto-initialize - let React control timing
    // Call init() explicitly after DOM is ready
    logger.info('⚙️ StellarDodecahedronViewer: Constructor complete, awaiting manual init()');
  }

  async init() {
    try {
      logger.info('🚀 StellarDodecahedronViewer: Initializing sophisticated stellar system...');

      // Load Three.js from our public directory
      await this.loadThreeJS();

      // Initialize core Three.js scene
      this.initScene();
      this.initCamera();
      this.initRenderer();
      this.initControls();
      this.initLighting();
      this.initRaycaster();

      // Initialize workers for heavy computation
      await this.initWorkers();

      // Initialize 3D objects
      this.createDodecahedron();
      await this.createOrbitalSystem();

      // Start progressive systems
      await this.initStellarSystem();

      // Setup event listeners
      this.setupEventListeners();

      // Start render loop
      this.animate();

      this.isInitialized = true;
      logger.info('✅ StellarDodecahedronViewer: Initialization complete');

      // Notify completion if callback provided
      if (this.options.onLoadComplete) {
        this.options.onLoadComplete();
      }
    } catch (error) {
      logger.error('❌ StellarDodecahedronViewer: Initialization failed:', error);
      if (this.options.onError) {
        this.options.onError(error.message);
      }
    }
  }

  async loadThreeJS() {
    // Check if THREE is already loaded globally
    if (window.THREE) {
      logger.info('✅ Three.js already available globally');
      return;
    }

    try {
      // Try to use bundled Three.js first (optimal for performance)
      logger.info('⏳ Loading Three.js from npm bundle...');
      const THREE = await import('three');
      const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');

      // Make available globally for compatibility
      window.THREE = THREE;
      window.THREE.OrbitControls = OrbitControls;

      logger.info('✅ Three.js loaded from npm bundle (optimal path)');
      return;
    } catch (bundleError) {
      logger.warn('⚠️ Bundled Three.js failed, falling back to CDN:', bundleError);

      // Fallback to CDN loading
      return this.loadThreeJSFromCDN();
    }
  }

  async loadThreeJSFromCDN() {
    return new Promise((resolve, reject) => {
      logger.info('⏳ Loading Three.js from CDN fallback...');

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/three@0.180.0/build/three.module.js';
      script.type = 'module';

      script.onload = async () => {
        try {
          // Load OrbitControls as well
          const controlsScript = document.createElement('script');
          controlsScript.src =
            'https://unpkg.com/three@0.180.0/examples/jsm/controls/OrbitControls.js';
          controlsScript.type = 'module';

          controlsScript.onload = () => {
            logger.info('✅ Three.js and OrbitControls loaded from CDN');
            resolve();
          };

          controlsScript.onerror = error => {
            logger.error('❌ Failed to load OrbitControls from CDN:', error);
            reject(error);
          };

          document.head.appendChild(controlsScript);
        } catch (error) {
          reject(error);
        }
      };

      script.onerror = error => {
        logger.error('❌ Failed to load Three.js from CDN:', error);
        reject(error);
      };

      document.head.appendChild(script);
    });
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000011);
    logger.info('✅ Scene initialized');
  }

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      10000
    );
    this.camera.position.set(0, 0, 200);
    logger.info('✅ Camera initialized');
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000011, this.options.opacity);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Performance optimizations
    this.renderer.info.autoReset = false;

    // Append to container
    if (this.container) {
      this.container.appendChild(this.renderer.domElement);
      logger.info('✅ Renderer initialized and added to container');
    } else {
      logger.error('❌ No container provided for renderer');
      throw new Error('Container required for renderer');
    }
  }

  initControls() {
    // Try to load OrbitControls
    if (window.THREE && window.THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.screenSpacePanning = false;
      this.controls.minDistance = 50;
      this.controls.maxDistance = 500;
      this.controls.maxPolarAngle = Math.PI;
      logger.info('✅ OrbitControls initialized');
    } else {
      logger.warn('⚠️ OrbitControls not available, using basic mouse controls');
      this.setupBasicMouseControls();
    }
  }

  setupBasicMouseControls() {
    let mouseX = 0,
      mouseY = 0;
    let targetRotationX = 0,
      targetRotationY = 0;

    const handleMouseMove = event => {
      mouseX = (event.clientX - window.innerWidth / 2) * 0.001;
      mouseY = (event.clientY - window.innerHeight / 2) * 0.001;
      targetRotationX = mouseY * 0.5;
      targetRotationY = mouseX * 0.5;
    };

    const handleWheel = event => {
      this.camera.position.z += event.deltaY * 0.1;
      this.camera.position.z = Math.max(50, Math.min(500, this.camera.position.z));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('wheel', handleWheel);

    // Store for cleanup
    this.mouseControls = { handleMouseMove, handleWheel };
  }

  initLighting() {
    // White dwarf light source (Gies)
    const whiteDwarfLight = new THREE.PointLight(0xb4ccff, 3.5, 0, 2);
    whiteDwarfLight.position.set(-15, 8, -10);
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
    const whiteDwarfMaterial = new THREE.MeshPhongMaterial({
      color: 0xb4ccff,
      emissive: 0x334466,
      transparent: false,
    });

    this.whiteDwarf = new THREE.Mesh(whiteDwarfGeometry, whiteDwarfMaterial);
    this.whiteDwarf.position.copy(whiteDwarfLight.position);
    this.scene.add(this.whiteDwarf);

    // Add ambient lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(ambientLight);

    logger.info('✅ Lighting system initialized');
  }

  initRaycaster() {
    this.raycaster = new THREE.Raycaster();
    logger.info('✅ Raycaster initialized');
  }

  async initWorkers() {
    try {
      logger.info('🔧 Initializing Web Workers...');

      // Initialize orbital mechanics worker
      this.orbitalWorker = new Worker('/workers/orbital-worker.js');
      this.orbitalWorker.onmessage = e => this.handleOrbitalWorkerMessage(e);
      this.orbitalWorker.onerror = e => logger.error('❌ Orbital worker error:', e);

      // Initialize stellar generation worker
      this.stellarWorker = new Worker('/workers/stellar-worker.js');
      this.stellarWorker.onmessage = e => this.handleStellarWorkerMessage(e);
      this.stellarWorker.onerror = e => logger.error('❌ Stellar worker error:', e);

      // Wait for workers to be ready
      await Promise.all([
        this.sendWorkerMessage(this.orbitalWorker, { type: 'ping' }),
        this.sendWorkerMessage(this.stellarWorker, { type: 'ping' }),
      ]);

      logger.info('✅ Web Workers initialized successfully');
    } catch (error) {
      logger.warn('⚠️ Web Workers failed to initialize, falling back to main thread:', error);
      this.orbitalWorker = null;
      this.stellarWorker = null;
    }
  }

  sendWorkerMessage(worker, message) {
    return new Promise((resolve, reject) => {
      if (!worker) {
        reject(new Error('Worker not available'));
        return;
      }

      const messageId = Date.now() + Math.random();

      const handleMessage = e => {
        if (e.data.id === messageId) {
          worker.removeEventListener('message', handleMessage);
          resolve(e.data.result);
        }
      };

      worker.addEventListener('message', handleMessage);
      worker.postMessage({ ...message, id: messageId });

      // Timeout after 5 seconds
      setTimeout(() => {
        worker.removeEventListener('message', handleMessage);
        reject(new Error('Worker message timeout'));
      }, 5000);
    });
  }

  handleOrbitalWorkerMessage(event) {
    const { type, data } = event.data;

    if (type === 'batch-process-complete') {
      this.updateCelestialBodies(data.results);
    }
  }

  handleStellarWorkerMessage(event) {
    const { type, data } = event.data;

    if (type === 'star-field-generated') {
      this.createStarField(data.stars);
    }
  }

  createDodecahedron() {
    const geometry = new THREE.DodecahedronGeometry(50, 0);
    const material = new THREE.MeshLambertMaterial({
      color: parseInt(this.options.color.replace('#', '0x')),
      transparent: true,
      opacity: 0.6,
    });

    this.dodecahedron = new THREE.Mesh(geometry, material);
    this.dodecahedron.castShadow = true;
    this.dodecahedron.receiveShadow = true;
    this.scene.add(this.dodecahedron);

    logger.info('✅ Dodecahedron created');
  }

  async createOrbitalSystem() {
    logger.info('🪐 Creating sophisticated orbital system...');

    const giesMass = 0.6 * this.SOLAR_MASS;

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
    this.scene.add(this.grandVossMesh);

    // Define orbital elements for sophisticated Keplerian mechanics
    this.orbitalBodies = [
      {
        id: 'chione',
        name: 'Chione',
        mesh: this.chioneMesh,
        orbitalElements: {
          semiMajorAxis: 2.5 * this.AU,
          eccentricity: 0.15,
          inclination: (12 * Math.PI) / 180,
          longitudeOfAscendingNode: (45 * Math.PI) / 180,
          argumentOfPeriapsis: (30 * Math.PI) / 180,
          meanAnomalyAtEpoch: 0,
          orbitalPeriod: this.calculateOrbitalPeriod(2.5 * this.AU, giesMass),
          epoch: 0,
        },
        centralBodyPosition: { x: -15, y: 8, z: -10 },
      },
      {
        id: 'grandvoss',
        name: 'Grand Voss',
        mesh: this.grandVossMesh,
        orbitalElements: {
          semiMajorAxis: 0.02 * this.AU,
          eccentricity: 0.05,
          inclination: (5 * Math.PI) / 180,
          longitudeOfAscendingNode: (90 * Math.PI) / 180,
          argumentOfPeriapsis: 0,
          meanAnomalyAtEpoch: (90 * Math.PI) / 180,
          orbitalPeriod: this.calculateOrbitalPeriod(0.02 * this.AU, 5.0 * 5.972e24),
          epoch: 0,
        },
        parentBody: 'chione',
      },
    ];

    this.celestialMeshes = {
      gies: this.whiteDwarf,
      chione: this.chioneMesh,
      grandvoss: this.grandVossMesh,
      dodecahedron: this.dodecahedron,
    };

    logger.info('✅ Orbital system created with Keplerian mechanics');
  }

  calculateOrbitalPeriod(semiMajorAxis, centralBodyMass) {
    const mu = this.G * centralBodyMass;
    return 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis * 1000, 3) / mu);
  }

  async initStellarSystem() {
    logger.info('⭐ Initializing sophisticated stellar system...');

    // Create star field with scientific accuracy
    const starGeometry = new THREE.BufferGeometry();
    const starCount = Math.min(this.options.particleCount, 3000);
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

    logger.info(`✅ Stellar system initialized with ${starCount} scientifically accurate stars`);
  }

  temperatureToColor(temperature) {
    // Convert stellar temperature to RGB color using blackbody radiation
    // Simplified Mitchell Charity algorithm
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

  setupEventListeners() {
    // Window resize
    window.addEventListener('resize', () => this.handleResize());

    // Keyboard controls
    document.addEventListener('keydown', e => this.handleKeyDown(e));
    document.addEventListener('keyup', e => this.handleKeyUp(e));

    // Mouse controls for object selection
    this.renderer.domElement.addEventListener('dblclick', e => this.handleDoubleClick(e));

    logger.info('✅ Event listeners setup');
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

    // Animate using simple lerp (could be enhanced with easing)
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

  updateCelestialBodies(results) {
    // Update orbital body positions from worker calculations
    for (const result of results) {
      const body = this.orbitalBodies.find(b => b.id === result.id);
      if (body && body.mesh && result.position) {
        // Convert to scene coordinates
        const scenePos = {
          x: result.position.x * this.DISTANCE_SCALE,
          y: result.position.y * this.DISTANCE_SCALE,
          z: result.position.z * this.DISTANCE_SCALE,
        };

        // Add central body position if needed
        if (body.centralBodyPosition) {
          scenePos.x += body.centralBodyPosition.x;
          scenePos.y += body.centralBodyPosition.y;
          scenePos.z += body.centralBodyPosition.z;
        }

        body.mesh.position.set(scenePos.x, scenePos.y, scenePos.z);
      }
    }
  }

  animate(currentTime = 0) {
    this.animationFrameId = requestAnimationFrame(time => this.animate(time));

    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    if (deltaTime > 0 && deltaTime < 1) {
      // Update orbital mechanics using workers if available
      if (this.orbitalWorker && this.orbitalBodies.length > 0) {
        this.orbitalWorker.postMessage({
          type: 'batch-process',
          data: {
            bodies: this.orbitalBodies.map(body => ({
              id: body.id,
              name: body.name,
              orbitalElements: body.orbitalElements,
            })),
            currentTime: (currentTime / 1000) * this.options.timeScale,
          },
        });
      }

      // WASD controls for dodecahedron rotation
      const rotationSpeed = 0.02;
      if (this.keyStates['KeyW']) this.dodecahedron.rotation.x -= rotationSpeed;
      if (this.keyStates['KeyS']) this.dodecahedron.rotation.x += rotationSpeed;
      if (this.keyStates['KeyA']) this.dodecahedron.rotation.y -= rotationSpeed;
      if (this.keyStates['KeyD']) this.dodecahedron.rotation.y += rotationSpeed;
      if (this.keyStates['KeyQ']) this.dodecahedron.rotation.z -= rotationSpeed;
      if (this.keyStates['KeyE']) this.dodecahedron.rotation.z += rotationSpeed;

      // Auto-rotation when not manually controlled
      const isManuallyControlled =
        this.keyStates['KeyW'] ||
        this.keyStates['KeyS'] ||
        this.keyStates['KeyA'] ||
        this.keyStates['KeyD'] ||
        this.keyStates['KeyQ'] ||
        this.keyStates['KeyE'];

      if (!isManuallyControlled) {
        this.dodecahedron.rotation.x += 0.001;
        this.dodecahedron.rotation.y += 0.002;
      }

      // Rotate star field slowly
      if (this.starField) {
        this.starField.rotation.y += 0.0002;
      }
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
    if (this.renderer && this.renderer.info) {
      this.performanceMetrics.renderCalls = this.renderer.info.render.calls;
    }

    if (performance.memory) {
      this.performanceMetrics.memoryUsage = Math.round(
        performance.memory.usedJSHeapSize / 1024 / 1024
      );
    }
  }

  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  takeScreenshot() {
    if (!this.renderer) return null;
    return this.renderer.domElement.toDataURL('image/png');
  }

  cleanup() {
    logger.info('🧹 StellarDodecahedronViewer: Cleaning up...');

    // Cancel animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Clean up workers
    if (this.orbitalWorker) {
      this.orbitalWorker.terminate();
      this.orbitalWorker = null;
    }
    if (this.stellarWorker) {
      this.stellarWorker.terminate();
      this.stellarWorker = null;
    }

    // Clean up Three.js objects
    if (this.scene) {
      this.scene.clear();
    }

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }

    // Clean up controls
    if (this.controls) {
      this.controls.dispose();
    }

    // Clean up event listeners
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);

    if (this.mouseControls) {
      document.removeEventListener('mousemove', this.mouseControls.handleMouseMove);
      document.removeEventListener('wheel', this.mouseControls.handleWheel);
    }

    logger.info('✅ StellarDodecahedronViewer: Cleanup complete');
  }
}
