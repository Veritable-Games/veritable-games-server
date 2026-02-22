# Stellar Viewer Technical Specifications

**Component**: Stellar Dodecahedron Viewer
**Location**: `/frontend/public/stellar/`
**Technology**: Three.js v0.180.0 + Vanilla JavaScript
**Status**: Production (embedded in home page)

---

## Overview

The Stellar Viewer is a standalone 3D visualization of a fictional stellar system ("Gies System") with realistic Keplerian orbital mechanics. Built entirely with vanilla JavaScript and Three.js, it runs independently of the Next.js application and is embedded via iframe on the home page.

---

## File Structure

```
/frontend/public/stellar/
├── index.html                          # Entry point (260 lines)
├── script.js                           # Main application (3,151 lines)
├── stellar-main.js                     # Additional logic (24KB)
├── stellar-viewer-loader.js            # Module loader (473 bytes)
│
├── three.js/                           # Three.js library
│   ├── three.module.js                 # Core module (ES6)
│   ├── three.core.js                   # Core functionality
│   └── examples/jsm/
│       └── controls/OrbitControls.js   # Camera controls
│
├── data/
│   ├── celestial-objects.json          # Gies System configuration (114 lines)
│   └── star-catalog.json               # Real star data (30-3000 stars)
│
└── workers/
    ├── orbital-worker.js               # Web Worker for orbit calculations
    └── stellar-worker.js               # Web Worker for star rendering
```

**Total Size**: 2.2MB

---

## Core Technologies

### 1. Three.js v0.180.0

**Import Strategy**: ES6 modules via import maps
```html
<script type="importmap">
{
  "imports": {
    "three": "./three.js/three.module.js",
    "three/addons/": "./three.js/examples/jsm/"
  }
}
</script>
```

**Usage**:
```javascript
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
```

**Components Used**:
- Scene, Camera, Renderer
- Lights (PointLight with shadows)
- Geometries (SphereGeometry, DodecahedronGeometry, BufferGeometry)
- Materials (MeshStandardMaterial, ShaderMaterial)
- OrbitControls for camera manipulation

### 2. Web Workers

**Purpose**: Offload heavy calculations to background threads

**Workers**:
- `orbital-worker.js`: Calculates orbital positions for celestial bodies
- `stellar-worker.js`: Processes star field rendering data

**Communication**:
```javascript
// Main thread
const worker = new Worker('./workers/orbital-worker.js');
worker.postMessage({ deltaTime, bodies });
worker.onmessage = (e) => {
  updatePositions(e.data.positions);
};
```

### 3. Performance Optimizations

#### Object Pooling
```javascript
class MemoryManager {
  constructor() {
    this.reusableObjects = {
      vectorPool: Array(50).fill(null).map(() => new THREE.Vector3()),
      colorPool: Array(20).fill(null).map(() => new THREE.Color()),
      vectorPoolIndex: 0,
      colorPoolIndex: 0,
    };
  }

  getPooledVector() {
    const obj = this.reusableObjects.vectorPool[this.reusableObjects.vectorPoolIndex];
    this.reusableObjects.vectorPoolIndex =
      (this.reusableObjects.vectorPoolIndex + 1) % this.reusableObjects.vectorPool.length;
    return obj.set(0, 0, 0);
  }
}
```

#### Typed Arrays for Star Data
```javascript
const compressed = {
  positions: new Float32Array(starCount * 3),        // X, Y, Z
  colors: new Float32Array(starCount * 3),           // R, G, B
  magnitudes: new Float32Array(starCount),           // Brightness
  spectralTypes: new Uint8Array(starCount),          // O,B,A,F,G,K,M (0-6)
  luminosityClasses: new Uint8Array(starCount),      // I,II,III,IV,V (0-4)
  variableFlags: new Uint16Array(starCount),         // Bitfield flags
};
```

**Memory Savings**: ~60% reduction vs array of objects

---

## Physics Engine

### Orbital Mechanics Implementation

**Constants**:
```javascript
const G = 6.6743e-11;        // Gravitational constant (m³/kg/s²)
const AU = 1.496e11;         // Astronomical Unit (m)
const SOLAR_MASS = 1.989e30; // Solar mass (kg)
const JUPITER_MASS = 1.898e27;
const LUNA_MASS = 7.342e22;
```

**Distance Scaling**:
```javascript
const DISTANCE_SCALE = 1 / (0.5 * AU);  // 1 scene unit = 0.5 AU
```

### OrbitalBody Class

**Properties**:
```javascript
class OrbitalBody {
  constructor(params) {
    // Physical properties
    this.name = params.name;
    this.type = params.type;
    this.mass = params.mass;
    this.radius = params.radius;

    // Orbital elements (Keplerian)
    this.semiMajorAxis = params.semiMajorAxis;           // a
    this.eccentricity = params.eccentricity;             // e
    this.inclination = params.inclination;               // i
    this.longitudeOfAscendingNode = params.longitudeOfAscendingNode; // Ω
    this.argumentOfPeriapsis = params.argumentOfPeriapsis;           // ω
    this.meanAnomalyAtEpoch = params.meanAnomalyAtEpoch;             // M₀

    // Central body
    this.centralMass = params.centralMass;
    this.parentBody = params.parentBody || null;

    // Calculated properties
    this.orbitalPeriod = this.calculateOrbitalPeriod();
    this.meanMotion = (2 * Math.PI) / this.orbitalPeriod;

    // Pre-compute trigonometry for performance
    this.precomputed = {
      cosI: Math.cos(this.inclination),
      sinI: Math.sin(this.inclination),
      cosO: Math.cos(this.longitudeOfAscendingNode),
      sinO: Math.sin(this.longitudeOfAscendingNode),
      cosW: Math.cos(this.argumentOfPeriapsis),
      sinW: Math.sin(this.argumentOfPeriapsis),
    };
  }
}
```

### Kepler's Equation Solver

**Newton-Raphson Iteration**:
```javascript
solveKeplersEquation(meanAnomaly, tolerance = 1e-6) {
  let E = meanAnomaly;  // Initial guess: eccentric anomaly
  let deltaE = 1;
  let iterations = 0;
  const maxIterations = 20;

  // Newton-Raphson: E_{n+1} = E_n - f(E_n) / f'(E_n)
  while (Math.abs(deltaE) > tolerance && iterations < maxIterations) {
    const f = E - this.eccentricity * Math.sin(E) - meanAnomaly;
    const fPrime = 1 - this.eccentricity * Math.cos(E);
    deltaE = f / fPrime;
    E -= deltaE;
    iterations++;
  }

  return E;  // Eccentric anomaly (radians)
}
```

**Convergence**: Typically 3-5 iterations for e < 0.5

### Orbital Position Calculation

**1. Eccentric Anomaly → True Anomaly**:
```javascript
eccentricToTrueAnomaly(eccentricAnomaly) {
  const E = eccentricAnomaly;
  const e = this.eccentricity;

  // Fundamental formula: tan(ν/2) = √((1+e)/(1-e)) * tan(E/2)
  const trueAnomaly = 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2)
  );

  return trueAnomaly;
}
```

**2. True Anomaly → Orbital Position**:
```javascript
calculateOrbitalPosition(trueAnomaly) {
  // Distance from central body (polar equation)
  const r = (this.semiMajorAxis * (1 - this.eccentricity ** 2)) /
            (1 + this.eccentricity * Math.cos(trueAnomaly));

  // Position in orbital plane
  const xOrb = r * Math.cos(trueAnomaly);
  const yOrb = r * Math.sin(trueAnomaly);

  return { x: xOrb, y: yOrb, r };
}
```

**3. Orbital Plane → 3D Space**:
```javascript
orbitalTo3D(orbitalPos) {
  const { x: xOrb, y: yOrb } = orbitalPos;
  const { cosI, sinI, cosO, sinO, cosW, sinW } = this.precomputed;

  // Rotation matrices: R_z(Ω) * R_x(i) * R_z(ω)
  const x3d = (cosO * cosW - sinO * sinW * cosI) * xOrb +
              (-cosO * sinW - sinO * cosW * cosI) * yOrb;

  const y3d = (sinO * cosW + cosO * sinW * cosI) * xOrb +
              (-sinO * sinW + cosO * cosW * cosI) * yOrb;

  const z3d = sinW * sinI * xOrb + cosW * sinI * yOrb;

  return { x: x3d, y: y3d, z: z3d };
}
```

### Orbital Period Calculation

**Kepler's Third Law**:
```javascript
calculateOrbitalPeriod() {
  // T² = (4π²/GM) * a³
  const coefficient = (4 * Math.PI ** 2) / (G * this.centralMass);
  return Math.sqrt(coefficient * this.semiMajorAxis ** 3);
}
```

**Example**: Chione's orbital period
- a = 2.5 AU = 3.74e11 m
- M = 0.6 M☉ = 1.19e30 kg
- T = √((4π²/(6.67e-11 * 1.19e30)) * (3.74e11)³)
- T ≈ 8.84e7 seconds ≈ 2.8 years

### Hierarchical Orbits

**Parent-Child Relationships**:
```javascript
updatePosition(deltaTime, timeScale = 1) {
  // Calculate position relative to central body
  const localPosition = this.calculateLocalPosition(deltaTime, timeScale);

  // If this body has a parent (e.g., moon orbiting planet)
  if (this.parentBody) {
    this.currentPosition.x = localPosition.x + this.parentBody.currentPosition.x;
    this.currentPosition.y = localPosition.y + this.parentBody.currentPosition.y;
    this.currentPosition.z = localPosition.z + this.parentBody.currentPosition.z;
  } else {
    // Direct orbit around central star
    this.currentPosition = localPosition;
  }
}
```

**Example**: Grand Voss (moon)
- Orbits Chione (planet)
- Chione orbits Gies (star)
- Grand Voss position = moonLocalPosition + chionePosition

---

## Gies System Configuration

**Data Source**: `/frontend/public/stellar/data/celestial-objects.json`

### Central Star: Gies

```json
{
  "name": "Gies",
  "type": "white_dwarf",
  "mass_solar": 0.6,
  "radius_solar": 0.0084,
  "temperature_k": 25000,
  "luminosity_solar": 0.05,
  "position": { "x": -15, "y": 8, "z": -10 },
  "color": "#B4CCFF",
  "spectral_class": "DA"
}
```

**Characteristics**:
- **Type**: DA White Dwarf (hydrogen atmosphere)
- **Mass**: 0.6 M☉ (typical for white dwarfs)
- **Radius**: 0.0084 R☉ ≈ 5,800 km (Earth-sized!)
- **Temperature**: 25,000K (very hot)
- **Luminosity**: 0.05 L☉ (dim despite high temperature)
- **Color**: Blue-white (#B4CCFF)

**Realism Check**: ✅ Realistic parameters for a white dwarf

### Planet: Chione

```json
{
  "name": "Chione",
  "type": "super_earth",
  "mass_earth": 5.0,
  "radius_earth": 1.7,
  "orbital_elements": {
    "semi_major_axis_au": 2.5,
    "eccentricity": 0.15,
    "inclination_deg": 5.2,
    "longitude_ascending_node_deg": 0,
    "argument_periapsis_deg": 0,
    "mean_anomaly_epoch_deg": 0
  },
  "physical_properties": {
    "surface_temperature_k": 280,
    "atmosphere": "thick_co2_n2",
    "surface_gravity_g": 2.94,
    "day_length_hours": 28.5
  },
  "visual_properties": {
    "color": "#4A6741",
    "albedo": 0.3,
    "visual_radius_scale": 1.0
  }
}
```

**Characteristics**:
- **Type**: Super-Earth (rocky planet larger than Earth)
- **Mass**: 5.0 M⊕
- **Radius**: 1.7 R⊕
- **Orbital Period**: 2.8 years (calculated)
- **Perihelion**: 2.125 AU (closest to Gies)
- **Aphelion**: 2.875 AU (farthest from Gies)
- **Habitable?**: Marginal (280K = 7°C average)
- **Atmosphere**: Thick CO₂/N₂ (like Venus?)
- **Surface Gravity**: 2.94g (humans would weigh ~3x normal)

**Realism Check**: ✅ Plausible super-earth parameters

### Moon: Grand Voss

```json
{
  "name": "Grand Voss",
  "type": "large_moon",
  "mass_lunar": 1.2,
  "radius_lunar": 1.1,
  "orbital_elements": {
    "semi_major_axis_km": 60420,
    "eccentricity": 0.05,
    "inclination_deg": 1.5,
    "longitude_ascending_node_deg": 0,
    "argument_periapsis_deg": 0,
    "mean_anomaly_epoch_deg": 0
  },
  "orbital_period_days": 14,
  "physical_properties": {
    "surface_temperature_k": 220,
    "surface_gravity_g": 0.19,
    "day_length_hours": 336
  },
  "visual_properties": {
    "color": "#8B7355",
    "albedo": 0.12,
    "visual_radius_scale": 0.8
  }
}
```

**Characteristics**:
- **Type**: Large moon (slightly bigger than Luna)
- **Mass**: 1.2 M☾
- **Radius**: 1.1 R☾
- **Orbital Period**: 14 days (around Chione)
- **Semi-major axis**: 60,420 km (compare: Moon-Earth = 384,400 km)
- **Temperature**: 220K = -53°C (cold!)
- **Surface Gravity**: 0.19g (similar to Luna's 0.166g)
- **Day Length**: 336 hours = 14 days (tidally locked)

**Realism Check**: ✅ Realistic moon parameters

---

## Star Catalog

**Data Source**: `/frontend/public/stellar/data/star-catalog.json`

### Catalog Format

```json
{
  "catalog": "Stellar Dodecahedron Basic Catalog",
  "version": "1.0",
  "coordinate_system": "J2000.0",
  "stars": [
    {
      "id": "HIP0",
      "name": "Sirius",
      "designation": "α CMa",
      "ra": 101.287,
      "dec": -16.716,
      "magnitude": -1.46,
      "spectral_type": "A1V",
      "temperature": 9940,
      "color": [155, 176, 255],
      "distance_ly": 8.6,
      "luminosity_class": "V"
    }
  ]
}
```

### Star Properties

| Property | Description | Units |
|----------|-------------|-------|
| `id` | Hipparcos catalog ID | String |
| `name` | Common name | String |
| `designation` | Bayer/Flamsteed designation | String |
| `ra` | Right ascension | Degrees (J2000.0) |
| `dec` | Declination | Degrees (J2000.0) |
| `magnitude` | Apparent visual magnitude | Dimensionless |
| `spectral_type` | Morgan-Keenan classification | String (e.g., "A1V") |
| `temperature` | Surface temperature | Kelvin |
| `color` | RGB color based on temperature | [R, G, B] (0-255) |
| `distance_ly` | Distance from Earth | Light years |
| `luminosity_class` | Yerkes classification | Roman numeral (I-V) |

### Spectral Types

| Type | Temperature Range | Color | Examples |
|------|------------------|-------|----------|
| O | 30,000-50,000K | Blue | Rare, very hot |
| B | 10,000-30,000K | Blue-white | Rigel, Spica |
| A | 7,500-10,000K | White | Sirius, Vega |
| F | 6,000-7,500K | Yellow-white | Canopus, Procyon |
| G | 5,200-6,000K | Yellow | Sun, Capella |
| K | 3,700-5,200K | Orange | Arcturus, Aldebaran |
| M | 2,400-3,700K | Red | Betelgeuse, Antares |

### Notable Stars in Catalog

1. **Sirius** (α CMa): Brightest star in night sky (-1.46 mag)
2. **Canopus** (α Car): Second brightest (-0.74 mag)
3. **Arcturus** (α Boo): Red giant (-0.05 mag)
4. **Vega** (α Lyr): Standard reference star (0.03 mag)
5. **Rigel** (β Ori): Blue supergiant (0.13 mag)

### Star Field Rendering

**Configurable Density**:
```javascript
const starFieldSettings = {
  default_count: 30,        // Fast performance
  max_count: 3000,          // Maximum detail
  size_range: [1.0, 4.0],   // Pixels
  brightness_range: [0.3, 1.0],
  color_temperature_range: [2400, 50000]  // K
};
```

**Distribution**: Stars positioned based on RA/Dec coordinates transformed to spherical coordinates around the scene.

---

## Rendering System

### Scene Setup

```javascript
class StellarDodecahedronViewer {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    document.getElementById('canvas-container').appendChild(this.renderer.domElement);
  }
}
```

### Lighting

**White Dwarf Light Source**:
```javascript
const whiteDwarfLight = new THREE.PointLight(0xB4CCFF, 3.5, 0, 2);
whiteDwarfLight.position.set(-15, 8, -10);
whiteDwarfLight.castShadow = true;
whiteDwarfLight.shadow.mapSize.width = 4096;
whiteDwarfLight.shadow.mapSize.height = 4096;
whiteDwarfLight.shadow.camera.near = 0.5;
whiteDwarfLight.shadow.camera.far = 500;
whiteDwarfLight.shadow.bias = -0.0001;
whiteDwarfLight.shadow.normalBias = 0.02;
scene.add(whiteDwarfLight);
```

**Ambient Light**:
```javascript
const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
scene.add(ambientLight);
```

### Dodecahedron

**Geometry**:
```javascript
const dodecahedronGeometry = new THREE.DodecahedronGeometry(5, 0);
```

**Shader Material** (Rim Lighting Effect):
```javascript
const dodecahedronMaterial = new THREE.ShaderMaterial({
  uniforms: {
    baseColor: { value: new THREE.Color(0x1E5A8A) },
    rimColor: { value: new THREE.Color(0x2E86AB) },
    rimPower: { value: 1.5 },
    minBrightness: { value: 0.4 }
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vViewDir;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewDir = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 baseColor;
    uniform vec3 rimColor;
    uniform float rimPower;
    uniform float minBrightness;

    varying vec3 vNormal;
    varying vec3 vViewDir;

    void main() {
      float rim = 1.0 - max(0.0, dot(normalize(vNormal), normalize(vViewDir)));
      rim = pow(rim, rimPower);

      vec3 color = mix(baseColor * minBrightness, rimColor, rim);
      gl_FragColor = vec4(color, 1.0);
    }
  `
});
```

**Rotation Animation**:
```javascript
function animate() {
  dodecahedron.rotation.x += 0.001;
  dodecahedron.rotation.y += 0.002;
}
```

### Celestial Bodies

**Gies (White Dwarf)**:
```javascript
const giesGeometry = new THREE.SphereGeometry(2, 32, 32);
const giesMaterial = new THREE.MeshStandardMaterial({
  color: 0xB4CCFF,
  emissive: 0xB4CCFF,
  emissiveIntensity: 0.8,
  metalness: 0.3,
  roughness: 0.7
});
const gies = new THREE.Mesh(giesGeometry, giesMaterial);
gies.position.set(-15, 8, -10);
gies.castShadow = true;
scene.add(gies);
```

**Chione (Planet)**:
```javascript
const chioneGeometry = new THREE.SphereGeometry(0.5, 32, 32);
const chioneMaterial = new THREE.MeshStandardMaterial({
  color: 0x4A6741,
  metalness: 0.1,
  roughness: 0.9
});
const chione = new THREE.Mesh(chioneGeometry, chioneMaterial);
chione.castShadow = true;
chione.receiveShadow = true;
scene.add(chione);
```

**Grand Voss (Moon)**:
```javascript
const grandVossGeometry = new THREE.SphereGeometry(0.2, 24, 24);
const grandVossMaterial = new THREE.MeshStandardMaterial({
  color: 0x8B7355,
  metalness: 0.05,
  roughness: 0.95
});
const grandVoss = new THREE.Mesh(grandVossGeometry, grandVossMaterial);
grandVoss.castShadow = true;
grandVoss.receiveShadow = true;
scene.add(grandVoss);
```

### Star Field

**Points Geometry**:
```javascript
const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

const starMaterial = new THREE.PointsMaterial({
  size: 2.0,
  vertexColors: true,
  transparent: true,
  opacity: 0.8,
  sizeAttenuation: true
});

const starField = new THREE.Points(starGeometry, starMaterial);
scene.add(starField);
```

---

## Interactive Features

### Camera Controls (OrbitControls)

**Configuration**:
```javascript
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 10;
controls.maxDistance = 500;
controls.mouseButtons = {
  LEFT: null,                        // Disable left-drag (reserved for selection)
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.ROTATE
};
```

**Keyboard Shortcuts**:
- **R**: Reset camera to default position
- **F**: Fit dodecahedron to view

### Object Tracking

**Double-Click to Track**:
```javascript
let trackedObject = null;

renderer.domElement.addEventListener('dblclick', (event) => {
  const intersects = raycaster.intersectObjects(selectableObjects);

  if (intersects.length > 0) {
    if (trackedObject === intersects[0].object) {
      // Double-click again to release
      trackedObject = null;
      controls.enabled = true;
    } else {
      // Track new object
      trackedObject = intersects[0].object;
      controls.enabled = false;
    }
  }
});

function animate() {
  if (trackedObject) {
    // Camera follows tracked object
    camera.lookAt(trackedObject.position);
    controls.target.copy(trackedObject.position);
  }
}
```

### Hover UI

**Position Tracking**:
```javascript
function updateHoverUI(object, uiElement) {
  const vector = new THREE.Vector3();
  object.getWorldPosition(vector);
  vector.project(camera);

  const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;

  uiElement.style.left = `${x}px`;
  uiElement.style.top = `${y}px`;
}
```

**Visibility Toggle**:
```javascript
renderer.domElement.addEventListener('mousemove', (event) => {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects([gies, chione, grandVoss]);

  if (intersects.length > 0) {
    const object = intersects[0].object;
    const uiElement = getUIElementForObject(object);
    uiElement.classList.add('visible');
  } else {
    // Hide all UI elements
    document.querySelectorAll('.celestial-body-ui').forEach(el => {
      el.classList.remove('visible');
    });
  }
});
```

### Dodecahedron Controls

**WASD Movement**:
```javascript
const keyState = {};

window.addEventListener('keydown', (e) => {
  keyState[e.key.toLowerCase()] = true;
});

window.addEventListener('keyup', (e) => {
  keyState[e.key.toLowerCase()] = false;
});

function animate() {
  const moveSpeed = 0.1;

  if (keyState['w']) dodecahedron.position.y += moveSpeed;
  if (keyState['s']) dodecahedron.position.y -= moveSpeed;
  if (keyState['a']) dodecahedron.position.x -= moveSpeed;
  if (keyState['d']) dodecahedron.position.x += moveSpeed;
  if (keyState['q']) dodecahedron.position.z += moveSpeed;
  if (keyState['e']) dodecahedron.position.z -= moveSpeed;
}
```

**Fit to View (F key)**:
```javascript
if (keyState['f']) {
  // Calculate bounding sphere
  const boundingBox = new THREE.Box3().setFromObject(dodecahedron);
  const center = boundingBox.getCenter(new THREE.Vector3());
  const size = boundingBox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  // Position camera to fit object
  const fov = camera.fov * (Math.PI / 180);
  const distance = maxDim / (2 * Math.tan(fov / 2));

  camera.position.set(center.x, center.y, center.z + distance * 1.5);
  controls.target.copy(center);
}
```

---

## Performance Metrics

### Target Performance

| Metric | Target | Notes |
|--------|--------|-------|
| FPS | 60 | Smooth animation |
| Initial Load | <3s | From page load to first render |
| Memory Usage | <200MB | Including Three.js and star data |
| CPU Usage | <30% | On mid-range hardware |

### Actual Performance (Estimated)

- **Initial Load**: ~2-3 seconds (2.2MB download + parse + render)
- **FPS**: 60fps with 30 stars, 45-55fps with 3000 stars
- **Memory**: ~150MB with 30 stars, ~250MB with 3000 stars

### Bottlenecks

1. **Large Star Catalog**: Loading 3000 stars takes 500ms-1s
2. **Shadow Maps**: 4096x4096 shadow map is expensive
3. **Orbital Calculations**: 3 bodies × 60fps = 180 calculations/second

### Optimizations Applied

✅ Object pooling (Vector3, Color)
✅ Typed arrays for star data
✅ Pre-computed trigonometry
✅ Web Workers for heavy calculations
✅ Instanced rendering for stars (BufferGeometry)

### Potential Improvements

- [ ] Implement LOD (Level of Detail) for star field
- [ ] Use InstancedMesh for multiple planets
- [ ] Lazy load large star catalog (fetch on user request)
- [ ] Use lower shadow map resolution (2048x2048)
- [ ] Throttle orbital calculations to 30fps instead of 60fps

---

## API Surface

### Public Methods

```javascript
class StellarDodecahedronViewer {
  // Constructor
  constructor() { }

  // Lifecycle
  init() { }
  animate() { }
  dispose() { }

  // Camera
  resetCamera() { }
  setCameraPosition(x, y, z) { }

  // Objects
  trackObject(object) { }
  releaseTrackedObject() { }

  // Star Field
  setStarCount(count) { }
  toggleStarField(visible) { }

  // Dodecahedron
  moveDodecahedron(dx, dy, dz) { }
  fitDodecahedronToView() { }

  // Performance
  getStats() { }
}
```

### Events (Custom)

```javascript
// Dispatch custom events for integration
viewer.addEventListener('bodyHover', (e) => {
  console.log('User hovered over', e.detail.bodyName);
});

viewer.addEventListener('bodyClick', (e) => {
  console.log('User clicked on', e.detail.bodyName);
});

viewer.addEventListener('cameraMove', (e) => {
  console.log('Camera moved to', e.detail.position);
});
```

---

## Maintenance Notes

### Dependencies

- **Three.js**: v0.180.0 (bundled, not from npm)
  - ⚠️ Must manually update `/public/stellar/three.js/` files
  - ⚠️ Out of sync with npm package (`three@0.180.0` in package.json)

### Browser Compatibility

**Required Features**:
- WebGL 1.0 (widely supported)
- ES6 modules (import/export)
- Web Workers
- Typed Arrays (Float32Array, Uint8Array)

**Tested Browsers**:
- ✅ Chrome 90+ (primary)
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

**Unsupported**:
- ❌ IE11 (no ES6 modules)
- ❌ Mobile Safari <14 (limited WebGL)

### Known Issues

1. **Memory Leak**: Hover UI elements not properly disposed
2. **Mobile Performance**: Laggy on older mobile devices
3. **Shadow Artifacts**: Occasional shadow acne on planets
4. **Window Resize**: Aspect ratio jumps on rapid resize

### Testing

**No automated tests currently exist**

**Manual Test Checklist**:
- [ ] Load page in Chrome/Firefox/Safari
- [ ] Verify all 3 celestial bodies visible
- [ ] Test camera controls (right-drag, zoom, reset)
- [ ] Test dodecahedron controls (WASD, QE, F)
- [ ] Hover over Gies, Chione, Grand Voss (check UI)
- [ ] Double-click to track/release objects
- [ ] Check FPS (should be 60fps)
- [ ] Test on mobile device

---

## Future Enhancements

### Near Term (Low Effort)
- [ ] Add loading progress indicator
- [ ] Implement pause/play button
- [ ] Add time scale slider (speed up/slow down orbits)
- [ ] Create screenshot/share button
- [ ] Add orbit path visualization (ellipses)

### Medium Term (Medium Effort)
- [ ] Convert to TypeScript
- [ ] Add Jest/Vitest tests
- [ ] Implement LOD system
- [ ] Add more celestial bodies (asteroid belt?)
- [ ] Create orbit editor (adjust parameters visually)

### Long Term (High Effort)
- [ ] Migrate to React + @react-three/fiber
- [ ] Integrate with wiki (link bodies to articles)
- [ ] Database-driven celestial systems
- [ ] User-created solar systems
- [ ] VR support (WebXR)

---

## References

### Astronomical Resources
- **Orbital Mechanics**: https://en.wikipedia.org/wiki/Orbital_elements
- **Kepler's Equation**: https://en.wikipedia.org/wiki/Kepler%27s_equation
- **White Dwarfs**: https://en.wikipedia.org/wiki/White_dwarf
- **Hipparcos Catalog**: https://www.cosmos.esa.int/web/hipparcos

### Technical Documentation
- **Three.js**: https://threejs.org/docs/
- **Web Workers**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
- **WebGL**: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API

---

**Last Updated**: October 13, 2025
**Status**: Production
**Maintainer**: TBD
