# Dodecahedron Texture Mapping Research

**Date**: October 13, 2025
**Objective**: Apply PNG images to individual faces of the dodecahedron in the Stellar Viewer
**Status**: Research complete, implementation pending

---

## Current Implementation

### Dodecahedron Rendering (`/frontend/public/stellar/script.js:404-470`)

The dodecahedron is currently rendered using:

```javascript
const geometry = new THREE.DodecahedronGeometry(1, 0);

const material = new THREE.ShaderMaterial({
  uniforms: {
    lightPosition: { value: new THREE.Vector3(-15, 8, -10) },
    baseColor: { value: new THREE.Color(0x1e5a8a) },      // Deep blue
    rimColor: { value: new THREE.Color(0x2e86ab) },       // Lighter blue
    rimPower: { value: 1.5 },
    minBrightness: { value: 0.4 }
  },
  vertexShader: `...`, // Custom vertex shader
  fragmentShader: `...`, // Custom fragment shader with rim lighting
  side: THREE.DoubleSide
});

this.dodecahedron = new THREE.Mesh(geometry, material);
```

**Key Features**:
- Single custom ShaderMaterial applied to entire mesh
- Rim lighting effect (fresnel-like glow on edges)
- Dynamic lighting from white dwarf star position
- Wrapped diffuse lighting for soft shadows
- No textures currently applied

**Geometry Details**:
- `DodecahedronGeometry(radius, detail)` → (1, 0)
- Radius: 1 unit (scene scale)
- Detail: 0 (no subdivision, 12 pentagonal faces)
- Derives from `PolyhedronGeometry` base class

---

## Available Symbol Images

**Location**: `/frontend/public/symbols/`
**Count**: 10 PNG files
**Total Size**: 5.3MB
**Individual Sizes**: 350KB - 850KB each

### Symbol Files

| Filename | Size | Theme |
|----------|------|-------|
| `BALANCE.png` | 619KB | Equilibrium/Harmony |
| `DEPRESSION.png` | 363KB | Sadness/Low mood |
| `ELATION-PLEASURE.png` | 549KB | Joy/Happiness |
| `ENMITY-WILL-OF-REPROACH.png` | 507KB | Hostility/Reproach |
| `FEAR-ANXIETY-AVERSION.png` | (not listed) | Fear/Anxiety |
| `HONOR-GAIN-DIGITY-PRIDE.png` | 845KB | Honor/Pride |
| `MISERY-LOSS-SHAME.png` | 623KB | Sadness/Shame |
| `PAIN-INJURY-TRAUMA.png` | 421KB | Pain/Suffering |
| `RESPONSE-WILL-OF-REPROACH-AGGRESSION.png` | 543KB | Aggression |
| `SEEKING-WANT-TAKE.png` | 430KB | Desire/Seeking |

**Theme**: Emotional/psychological states (10 symbols for 12 faces - need 2 more)

**Note**: Dodecahedron has 12 faces, but only 10 symbols provided. Either:
1. Use 2 symbols twice (balance/center?)
2. Create 2 additional symbols
3. Leave 2 faces as plain color

---

## The Challenge: Applying Textures to Individual Faces

### Problem 1: Material Arrays Don't Work

**What works for cubes doesn't work for dodecahedrons:**

```javascript
// ❌ This works for BoxGeometry:
const materials = [
  new THREE.MeshBasicMaterial({ map: texture1 }),
  new THREE.MeshBasicMaterial({ map: texture2 }),
  // ... 6 materials for 6 faces
];
const cube = new THREE.Mesh(boxGeometry, materials);

// ❌ This DOESN'T work for DodecahedronGeometry:
const materials = [...]; // 12 materials
const dodeca = new THREE.Mesh(dodecaGeometry, materials); // Won't apply correctly
```

**Why?** `DodecahedronGeometry` derives from `PolyhedronGeometry`, which doesn't support material arrays the same way `BoxGeometry` does.

### Problem 2: UV Mapping Issues

**Default UVs are problematic:**
- Faces overlap in UV space
- UVs don't fill the 0-1 space efficiently
- Some faces are oddly mapped (stretched/rotated)
- Designed for single texture, not individual face textures

**Example from Three.js forum**:
> "Polyhedron UV mapping has faces that overlap, doesn't fill the space, and some faces are weirdly mapped."

### Problem 3: Current Shader is Custom

The current implementation uses a **custom ShaderMaterial** with:
- Vertex shader (transforms vertices)
- Fragment shader (per-pixel colors, lighting, rim effects)
- No texture sampling currently

To add textures, we must:
1. Add texture uniforms to the shader
2. Add `sampler2D` uniform for texture
3. Modify fragment shader to sample texture
4. Ensure proper UV coordinates

---

## Approach 1: Geometry Groups (Recommended for Single Face)

**Best For**: Applying one texture to one specific face as a test

### How It Works

1. **Define Geometry Groups**: Manually assign face indices to material groups
2. **Create Material Array**: One material per group
3. **Map face indices to groups**: Tell Three.js which faces use which material

### Pros
- Works with existing `DodecahedronGeometry`
- Can keep custom shader for non-textured faces
- Precise control over which face gets which texture

### Cons
- Requires manual face index identification
- Need to understand dodecahedron topology
- More complex code

### Implementation Overview

```javascript
// 1. Create geometry
const geometry = new THREE.DodecahedronGeometry(1, 0);

// 2. Load textures
const loader = new THREE.TextureLoader();
const balanceTexture = loader.load('/symbols/BALANCE.png');

// 3. Create materials
const texturedMaterial = new THREE.MeshBasicMaterial({
  map: balanceTexture,
  transparent: true
});

const shaderMaterial = new THREE.ShaderMaterial({
  // ... existing shader code
});

// 4. Define groups (identify face indices for top face, for example)
geometry.clearGroups();
geometry.addGroup(0, 3, 0);    // First face (3 vertices) → material index 0
geometry.addGroup(3, 3, 1);    // Second face → material index 1
// ... continue for all 12 faces (36 vertices total, 3 per face)

// 5. Create mesh with material array
const materials = [
  texturedMaterial,  // Material 0 (top face)
  shaderMaterial,    // Material 1 (all other faces)
  // ... or one material per face
];

this.dodecahedron = new THREE.Mesh(geometry, materials);
```

### Challenge: Identifying Face Indices

**Dodecahedron has 12 pentagonal faces:**
- Each face = 5 vertices, but stored as 3 triangles (15 vertices)
- Wait, no: BufferGeometry uses indices
- Need to inspect `geometry.index` to understand face ordering

**Solution**: Write helper function to visualize face indices:

```javascript
function identifyFaces(geometry) {
  const position = geometry.attributes.position;
  const index = geometry.index;

  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);

    // Get triangle center
    const centerX = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
    const centerY = (position.getY(a) + position.getY(b) + position.getY(c)) / 3;
    const centerZ = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3;

    console.log(`Triangle ${Math.floor(i/3)}: center (${centerX}, ${centerY}, ${centerZ})`);
  }
}
```

This would help identify which group of triangles forms the "top" face, etc.

---

## Approach 2: Custom UV Mapping (Recommended for All Faces)

**Best For**: Applying different textures to all 12 faces systematically

### How It Works

1. **Compute new UVs**: Calculate proper UV coordinates for each face
2. **Use box UV mapping**: Treat each face as a separate quad in UV space
3. **Create texture atlas**: Arrange all 10 symbols in a single image
4. **Map UVs to atlas regions**: Each face's UVs point to its symbol

### Pros
- Can use single material (simpler)
- Works with ShaderMaterial (just add texture uniform)
- Standard Three.js pattern

### Cons
- Requires manual UV calculation
- Need to create texture atlas (combine 10 PNGs into 1)
- More complex initial setup

### Implementation Overview

**Step 1: Create Texture Atlas**

Combine 10 symbol PNGs into a single image:

```
+----------+----------+----------+----------+
| BALANCE  | DEPRESS  | ELATION  | ENMITY   |
+----------+----------+----------+----------+
| FEAR     | HONOR    | MISERY   | PAIN     |
+----------+----------+----------+----------+
| RESPONSE | SEEKING  | (blank)  | (blank)  |
+----------+----------+----------+----------+
```

**Dimensions**: 4x3 grid = 12 slots (perfect for 12 faces!)
**Atlas Size**: 2048x1536 pixels (512px per symbol @ 4x3)

**Step 2: Compute UVs**

```javascript
function computeBoxUVs(geometry) {
  const pos = geometry.attributes.position;
  const uvs = [];

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // Determine which face this vertex belongs to
    // Map to appropriate region in texture atlas
    const [u, v] = mapVertexToAtlas(x, y, z, i);
    uvs.push(u, v);
  }

  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
}
```

**Step 3: Load Atlas and Update Shader**

```javascript
const atlasTexture = loader.load('/symbols/atlas.png');

const material = new THREE.ShaderMaterial({
  uniforms: {
    // ... existing uniforms
    symbolTexture: { value: atlasTexture }
  },
  vertexShader: `
    varying vec2 vUv;
    // ... existing code
    void main() {
      vUv = uv;  // Pass UVs to fragment shader
      // ... existing code
    }
  `,
  fragmentShader: `
    uniform sampler2D symbolTexture;
    varying vec2 vUv;
    // ... existing code
    void main() {
      vec4 texColor = texture2D(symbolTexture, vUv);
      // Mix texture with existing lighting
      vec3 finalColor = mix(baseColor, texColor.rgb, texColor.a);
      // ... rest of lighting code
    }
  `
});
```

### Challenge: UV Calculation Complexity

**Dodecahedron faces are pentagons**, but Three.js renders them as triangles:
- Each pentagon = 3 triangles (fan from center)
- Need to map 3 triangle UVs to represent full pentagon
- UV coordinates must account for pentagonal shape

**Possible Solutions**:
1. **Manual UV definition**: Hardcode UVs for each of 12 faces (tedious but precise)
2. **Algorithmic UV generation**: Calculate UVs based on vertex positions (complex math)
3. **Blender export**: Model in Blender, UV unwrap there, export to glTF (easiest!)

---

## Approach 3: Blender + glTF Export (Easiest, Most Flexible)

**Best For**: Production-ready solution with full control

### How It Works

1. **Create dodecahedron in Blender**
2. **UV unwrap faces** (Blender's UV editor)
3. **Assign materials** to each face
4. **Export as glTF 2.0**
5. **Load in Three.js** via `GLTFLoader`

### Pros
- ✅ Visual UV editing (see exactly what you're doing)
- ✅ Professional workflow
- ✅ Easy to iterate (change textures, re-export)
- ✅ Can add more detail (bevels, subdivisions)
- ✅ glTF is industry standard

### Cons
- ❌ Requires Blender knowledge
- ❌ Extra file dependency (glTF model)
- ❌ Loses current custom shader (would need to re-implement)

### Implementation Overview

**Blender Steps**:
1. Add → Mesh → Icosphere (12 faces option) or manually create dodecahedron
2. UV Editing workspace → Unwrap → Smart UV Project
3. Arrange UV islands (each pentagon face) in 0-1 space
4. Assign texture atlas to material
5. File → Export → glTF 2.0 (.glb or .gltf + .bin)

**Three.js Code**:
```javascript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load('/models/dodecahedron.glb', (gltf) => {
  this.dodecahedron = gltf.scene.children[0];
  this.dodecahedron.castShadow = true;
  this.dodecahedron.receiveShadow = true;
  this.scene.add(this.dodecahedron);
});
```

**Note**: Would lose current custom shader unless re-implemented on the imported material.

---

## Approach 4: Instance Per Face (Brute Force)

**Best For**: Quick prototype to test visual concept

### How It Works

Create 12 separate plane meshes, position them to form dodecahedron shape:

```javascript
const faces = [];
const faceMaterial = (texture) => new THREE.MeshBasicMaterial({
  map: texture,
  transparent: true
});

// Create 12 planes, one per face
for (let i = 0; i < 12; i++) {
  const texture = loader.load(`/symbols/${symbolNames[i]}.png`);
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    faceMaterial(texture)
  );

  // Position and rotate to match dodecahedron face position
  const position = calculateFacePosition(i);
  const rotation = calculateFaceRotation(i);
  plane.position.copy(position);
  plane.rotation.copy(rotation);

  faces.push(plane);
  this.scene.add(plane);
}
```

### Pros
- Simple to implement
- Each face is independent (easy to animate)
- No UV mapping needed

### Cons
- Not a true dodecahedron (12 separate objects)
- More draw calls (worse performance)
- Gaps between faces if not positioned perfectly
- Doesn't match current aesthetic

---

## Recommended Implementation Strategy

### Phase 1: Single Face Prototype (1-2 hours)

**Goal**: Test texture application on one face to validate approach

1. **Choose one symbol** (e.g., `BALANCE.png`)
2. **Use Approach 1** (Geometry Groups)
3. **Identify top face** using face inspection helper
4. **Apply texture** to top face only
5. **Keep existing shader** for other 11 faces

**Success Criteria**:
- One face shows BALANCE symbol
- Other faces maintain rim lighting effect
- No visual glitches

### Phase 2: Texture Atlas Creation (2-3 hours)

**Goal**: Combine 10 symbols into single texture atlas

1. **Design atlas layout**: 4x3 grid (512px per cell = 2048x1536 total)
2. **Create in image editor** (GIMP/Photoshop/Canvas):
   - Arrange 10 symbols in grid
   - Add 2 duplicates (BALANCE center top/bottom?)
   - Export as `/public/symbols/dodecahedron-atlas.png`
3. **Document atlas layout**: Which cell = which symbol

**Tools**:
- GIMP (free): Create new image, paste symbols into layers, export
- Online: https://www.codeandweb.com/texturepacker (free for simple use)

### Phase 3: Full UV Mapping (4-6 hours)

**Goal**: All 12 faces show different symbols

**Option A: Manual UV Calculation** (harder, more control)
1. Write UV generation function
2. Map each face to atlas region
3. Test and adjust

**Option B: Blender Export** (easier, less control)
1. Model dodecahedron in Blender
2. UV unwrap with Smart UV Project
3. Apply atlas texture
4. Export glTF
5. Import via GLTFLoader

### Phase 4: Shader Integration (2-3 hours)

**Goal**: Maintain rim lighting effect with textures

1. **Add texture uniform** to existing shader
2. **Sample texture** in fragment shader
3. **Blend with lighting**: `mix(texture, lighting, factor)`
4. **Tune blend factor** for best visual result

**Modified Fragment Shader**:
```glsl
uniform sampler2D symbolTexture;
varying vec2 vUv;

void main() {
  // Existing lighting calculations
  float lighting = mix(minBrightness, diffuse, 0.8) + rim * 0.2;
  vec3 baseColorLit = baseColor * lighting;

  // Sample texture
  vec4 texColor = texture2D(symbolTexture, vUv);

  // Blend texture with base color (texture takes priority)
  vec3 finalColor = mix(baseColorLit, texColor.rgb, texColor.a * 0.8);

  gl_FragColor = vec4(finalColor, 1.0);
}
```

### Phase 5: Polish (1-2 hours)

1. **Add face labels** (on hover, show symbol name)
2. **Animate rotation** to showcase all faces
3. **Test performance** (atlas vs 10 separate textures)
4. **Document approach** for future updates

---

## Technical Considerations

### Texture Loading

**Current Pattern** (for star field):
```javascript
const texture = new THREE.TextureLoader().load('/path/to/texture.png');
```

**Recommended Pattern** (with loading callback):
```javascript
const loader = new THREE.TextureLoader();
loader.load(
  '/symbols/BALANCE.png',
  (texture) => {
    // Success: texture loaded
    console.log('Texture loaded:', texture);
    material.uniforms.symbolTexture.value = texture;
    material.needsUpdate = true;
  },
  (progress) => {
    // Progress callback
    console.log('Loading:', (progress.loaded / progress.total * 100) + '%');
  },
  (error) => {
    // Error callback
    console.error('Error loading texture:', error);
  }
);
```

### Texture Settings

```javascript
texture.wrapS = THREE.ClampToEdgeWrapping;
texture.wrapT = THREE.ClampToEdgeWrapping;
texture.minFilter = THREE.LinearFilter;
texture.magFilter = THREE.LinearFilter;
texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); // Better quality
```

### Performance

**Considerations**:
- 10 separate textures = 10 HTTP requests + 10 GPU textures (5.3MB total)
- 1 texture atlas = 1 HTTP request + 1 GPU texture (~2MB with compression)
- **Recommendation**: Use texture atlas for production

**Memory Usage**:
- Each 512x512 RGBA texture = 1MB GPU memory
- 10 textures = 10MB GPU memory
- 1 atlas (2048x1536) = 12MB GPU memory (but fewer draw calls)

### Browser Compatibility

**Texture Size Limits**:
- Modern browsers: 4096x4096 or 8192x8192
- Older devices: 2048x2048
- **Recommendation**: Keep atlas at 2048x1536 (safe for all devices)

**Format Support**:
- PNG: ✅ Universal support, transparency
- JPEG: ✅ Universal support, no transparency, smaller file size
- WebP: ✅ Modern browsers (95%+), best compression
- AVIF: ⚠️ Newer format, not all browsers yet

**Current symbols are PNG** → Good choice for transparency

---

## Symbol Naming & Meaning

The 10 symbols appear to represent emotional/psychological states, possibly related to a wheel of emotions or psychological framework:

### Positive/Elevated States
- **BALANCE** (619KB) - Equilibrium, harmony
- **ELATION-PLEASURE** (549KB) - Joy, happiness, pleasure
- **HONOR-GAIN-DIGITY-PRIDE** (845KB) - Pride, achievement, dignity
- **SEEKING-WANT-TAKE** (430KB) - Desire, motivation, pursuit

### Negative/Difficult States
- **DEPRESSION** (363KB) - Sadness, low mood
- **FEAR-ANXIETY-AVERSION** - Anxiety, fear, avoidance
- **MISERY-LOSS-SHAME** (623KB) - Loss, shame, misery
- **PAIN-INJURY-TRAUMA** (421KB) - Physical/emotional pain
- **ENMITY-WILL-OF-REPROACH** (507KB) - Hostility, reproach

### Reactive States
- **RESPONSE-WILL-OF-REPROACH-AGGRESSION** (543KB) - Aggressive response

**Pattern**: Seems like a 12-part emotional model (with 2 states missing)

**Possible Missing States** (to fill 12 faces):
1. **LOVE/AFFECTION** - Positive relational state
2. **CURIOSITY/INTEREST** - Engaged/exploring state
3. **CALM/PEACE** - Neutral grounded state
4. **SURPRISE/WONDER** - Reactive positive state

**Philosophical Note**: This could be mapping emotional states onto Platonic solid faces, creating a 3D "emotion wheel" that can be rotated to explore different states. Very cool concept!

---

## Implementation Complexity Rating

| Approach | Difficulty | Time | Quality | Maintainability |
|----------|-----------|------|---------|-----------------|
| **Approach 1: Geometry Groups** | Medium | 4-6h | Good | Medium |
| **Approach 2: Custom UVs** | High | 8-12h | Excellent | High |
| **Approach 3: Blender + glTF** | Low-Medium | 3-4h | Excellent | High |
| **Approach 4: Instance Per Face** | Low | 2-3h | Poor | Low |

**Recommendation**: Start with **Approach 1** for prototype, then move to **Approach 3** (Blender) for production if you're comfortable with 3D modeling, or **Approach 2** if you want to stay in code.

---

## Questions to Answer Before Implementation

1. **Which face should have which symbol?**
   - Random assignment?
   - Specific mapping (top face = BALANCE, etc.)?
   - User-configurable?

2. **Should the dodecahedron rotate automatically to showcase symbols?**
   - Current: Slow auto-rotation
   - Option: Pause on each face for 2 seconds
   - Option: User-controlled only

3. **What happens on face hover/click?**
   - Show symbol name in UI overlay?
   - Link to wiki article about that emotion?
   - Animate/highlight the face?

4. **Should rim lighting be preserved?**
   - Keep existing shader + blend with textures?
   - Replace shader with simple textured material?

5. **Missing 2 symbols - what to use?**
   - Duplicate BALANCE (center of wheel)?
   - Create new symbols?
   - Leave 2 faces as plain color (accent faces)?

6. **Integration with platform features?**
   - Link faces to wiki articles?
   - Track which faces users click?
   - Save user's "current emotional state" to profile?

---

## Next Steps

1. **Review this document** - Understand the options
2. **Answer key questions** - Decide on face mapping, interaction, etc.
3. **Choose approach** - Geometry Groups (fast test) vs Blender (production)
4. **Create texture atlas** - Combine 10 PNGs into single image
5. **Implement Phase 1** - Single face prototype
6. **Iterate** - Test, refine, expand to all faces

---

## Additional Resources

### Three.js Documentation
- **DodecahedronGeometry**: https://threejs.org/docs/#api/en/geometries/DodecahedronGeometry
- **ShaderMaterial**: https://threejs.org/docs/#api/en/materials/ShaderMaterial
- **TextureLoader**: https://threejs.org/docs/#api/en/loaders/TextureLoader
- **BufferGeometry Groups**: https://threejs.org/docs/#api/en/core/BufferGeometry.addGroup

### Community Discussions
- **Dodecahedron texture per face**: https://discourse.threejs.org/t/dodecahedron-with-a-separate-texture-for-each-face/21897
- **Stack Overflow: DodecahedronGeometry texture**: https://stackoverflow.com/questions/57373932/how-to-apply-to-each-side-of-dodecahedrongeometry-a-unique-texture

### Tools
- **Texture Atlas Generator**: https://www.codeandweb.com/texturepacker
- **GIMP** (free): https://www.gimp.org/
- **Blender** (free): https://www.blender.org/

---

**Last Updated**: October 13, 2025
**Status**: Research complete, ready for implementation decision
**Next Action**: Review with team, choose approach, begin Phase 1 prototype
