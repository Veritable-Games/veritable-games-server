// ES6 module loader for StellarDodecahedronViewer
import * as THREE from './three.js/three.module.js';
import { OrbitControls } from './three.js/examples/jsm/controls/OrbitControls.js';

// Make THREE and OrbitControls globally available for the stellar viewer
window.THREE = THREE;
window.OrbitControls = OrbitControls;

// Import and re-export the StellarDodecahedronViewer
import { StellarDodecahedronViewer } from './script.js';

export { StellarDodecahedronViewer };
