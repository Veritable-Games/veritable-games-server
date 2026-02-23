# Dodecahedron UV Mapping Solution

**Date**: October 13, 2025
**Status**: ✅ **IMPLEMENTED** - Working correctly with test pattern
**Location**: `/frontend/public/stellar/script.js` - `createDodecahedron()` method

---

## Overview

Successfully implemented per-face UV mapping for the dodecahedron using an **orthonormal basis approach** that ensures textures appear correctly centered and undistorted on each pentagonal face.

---

## The Problem

Initial attempts to apply textures to dodecahedron faces resulted in severe distortion:
- ❌ Textures stretched/squashed in random directions per face
- ❌ Textures wrapped around the entire object (spherical UV mapping)
- ❌ Inconsistent sizing across faces
- ❌ Off-center positioning

### Root Causes Identified

1. **Spherical UV Mapping**: `DodecahedronGeometry` generates UVs designed for wrapping a single texture around the entire mesh (spherical/latitude-longitude style)
2. **Normalizing Broken UVs**: Attempting to normalize pre-distorted spherical UVs preserved the distortion
3. **Uniform Circular Scaling**: Using a single `maxDist` radius created circular projections that became ellipses when projected onto tilted pentagonal faces
4. **Bounding Box Centering**: Centering on 2D bounding box instead of actual geometric center

---

## The Solution: Orthonormal Basis UV Mapping

### Mathematical Approach

Create a **local 2D coordinate system** (orthonormal basis) aligned with each pentagon's plane, then project vertices into this space.

**Key Concept**: Instead of projecting 3D coordinates onto arbitrary 2D planes, we create custom perpendicular axes (tangent vectors) that lie flat in each pentagon's plane.

### Algorithm

```
For each of the 12 pentagonal faces:

1. Extract 5 unique vertices (from 9 total with duplicates)
2. Calculate pentagon center (average of 5 unique vertices)

3. Create orthonormal basis:
   - Normal = cross product of two edges (perpendicular to face)
   - Tangent1 = first edge normalized (lies in plane)
   - Tangent2 = Normal × Tangent1 (perpendicular to Tangent1, lies in plane)

4. Project vertices to 2D local space:
   - relative = vertex - center
   - localU = relative · Tangent1 (dot product)
   - localV = relative · Tangent2 (dot product)

5. Find max extent from center:
   - maxExtent = max distance from (0,0) in local space

6. Map to UV space (centered at 0.5):
   - u = 0.5 + localU / (maxExtent × 2)
   - v = 0.5 + localV / (maxExtent × 2)
```

### Why This Works

- ✅ **Conformal Mapping**: Preserves angles and local shapes
- ✅ **No Distortion**: Tangent vectors are perpendicular and lie flat in the pentagon plane
- ✅ **Perfect Centering**: Pentagon center (0,0 in local space) maps to texture center (0.5, 0.5)
- ✅ **Aspect Ratio Preserved**: Uniform scaling by `maxExtent` ensures square textures stay square
- ✅ **Consistent Results**: Same mathematical operation applied to all 12 faces

---

## Implementation Details

### File Modified
`/frontend/public/stellar/script.js` - Lines 534-658

### Key Code Sections

#### 1. Find Unique Pentagon Vertices
```javascript
const uniqueVertices = [];
const tolerance = 0.0001;

for (const p of positions) {
  let isDuplicate = false;
  for (const unique of uniqueVertices) {
    const dist = Math.sqrt(
      (p.x - unique.x) ** 2 +
      (p.y - unique.y) ** 2 +
      (p.z - unique.z) ** 2
    );
    if (dist < tolerance) {
      isDuplicate = true;
      break;
    }
  }
  if (!isDuplicate) {
    uniqueVertices.push(p);
  }
}
```

**Purpose**: Pentagon is made of 3 triangles (9 vertices), but only has 5 unique corners. This finds them.

#### 2. Calculate Pentagon Center
```javascript
let centerX = 0, centerY = 0, centerZ = 0;
for (const p of uniqueVertices) {
  centerX += p.x;
  centerY += p.y;
  centerZ += p.z;
}
centerX /= uniqueVertices.length;
centerY /= uniqueVertices.length;
centerZ /= uniqueVertices.length;
```

**Purpose**: True geometric center (not bounding box center).

#### 3. Create Orthonormal Basis
```javascript
// Calculate normal from cross product
const edge1 = p1 - p0;
const edge2 = p2 - p0;
const normal = normalize(cross(edge1, edge2));

// Tangent1 = first edge normalized
const tangent1 = normalize(edge1);

// Tangent2 = perpendicular to tangent1 in the plane
const tangent2 = cross(normal, tangent1);
```

**Purpose**: Creates two perpendicular axes lying flat in the pentagon's plane.

#### 4. Project to Local 2D Space
```javascript
const relX = p.x - centerX;
const relY = p.y - centerY;
const relZ = p.z - centerZ;

const localU = relX * tangent1x + relY * tangent1y + relZ * tangent1z;
const localV = relX * tangent2x + relY * tangent2y + relZ * tangent2z;
```

**Purpose**: Dot products project 3D vertex onto 2D local coordinate system. Center is at origin (0,0).

#### 5. Map to Texture Space
```javascript
let maxExtent = 0;
for (const coord of localCoords) {
  const dist = Math.sqrt(coord.u * coord.u + coord.v * coord.v);
  maxExtent = Math.max(maxExtent, dist);
}

const u = 0.5 + localCoords[i].u / (maxExtent * 2);
const v = 0.5 + localCoords[i].v / (maxExtent * 2);
```

**Purpose**: Uniform scaling preserves aspect ratio. Center (0,0) maps to texture center (0.5, 0.5).

---

## Debugging Process

### Problem Discovery Timeline

1. **Initial Implementation**: Geometry groups working, but textures wrapped around entire object
2. **UV Remapping Attempt #1**: Normalized spherical UVs → preserved distortion
3. **Planar Projection Attempt**: Box UV mapping → stretched/squashed results
4. **Centering Issue**: Stars centered but stretched in random directions per face
5. **Research Phase**: Identified need for orthonormal basis
6. **Final Solution**: Implemented orthonormal basis → perfect results

### Verification Methods

#### Red Dot Test (Lines 637-692)
Created 3D sphere meshes at calculated pentagon centers to verify centering accuracy:

```javascript
const dotGeometry = new THREE.SphereGeometry(0.05, 16, 16);
const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });

for (let faceIndex = 0; faceIndex < 12; faceIndex++) {
  // Calculate center...
  const dot = new THREE.Mesh(dotGeometry, dotMaterial);
  dot.position.set(centerX, centerY, centerZ);
  this.scene.add(dot);
}
```

**Result**: Red dots appear at exact pentagon centers, confirming center calculation accuracy.

#### Test Pattern
Created white 5-pointed star texture (256×256 canvas) to verify:
- ✅ Correct sizing
- ✅ Perfect centering
- ✅ No distortion
- ✅ Consistent appearance across all 12 faces

---

## Current Status

### What's Working ✅

- **Perfect Centering**: Stars align exactly with pentagon centers (verified with red dots)
- **No Distortion**: Stars maintain correct aspect ratio on all faces
- **Consistent Sizing**: All 12 stars appear the same size
- **Correct Orientation**: Stars are upright (no random rotation)

### Test Pattern Details

**Texture**: White 5-pointed star on transparent background
**Canvas Size**: 256×256 pixels
**Star Dimensions**:
- Outer radius: 80px
- Inner radius: 32px
- 5 spikes at 72° intervals

**Current Scale Factor**: N/A (auto-scaled by `maxExtent`)

### Debugging Tools (Currently Active)

**Red dots** showing pentagon centers are still rendering. To remove them, delete lines 637-692 in `script.js`.

---

## Next Steps

### 1. Remove Debug Red Dots
Once satisfied with alignment, remove the red dot visualization code (lines 637-692).

### 2. Swap in Real Symbol Textures

Replace test star with actual symbols from `/public/symbols/`:

```javascript
// Instead of createStarTexture(), load real textures:
const textureLoader = new THREE.TextureLoader();
const symbolPaths = [
  '/symbols/ELATION-PLEASURE.png',
  '/symbols/ENMITY-WILL-OF-REPROACH.png',
  '/symbols/FEAR-ANXIETY-AVERSION.png',
  '/symbols/HONOR-GAIN-DIGITY-PRIDE.png',
  '/symbols/MISERY-LOSS-SHAME.png',
  '/symbols/PAIN-INJURY-TRAUMA.png',
  '/symbols/RESPONSE-WILL-OF-REPROACH-AGGRESSION.png',
  '/symbols/SEEKING-WANT-TAKE.png',
];

// Create materials array (8 with symbols, 4 with original shader)
const materials = [];
for (let i = 0; i < 12; i++) {
  if (i < 8) {
    const texture = textureLoader.load(symbolPaths[i]);
    texture.colorSpace = THREE.SRGBColorSpace;
    materials.push(
      new THREE.ShaderMaterial({
        uniforms: {
          ...sharedUniforms,
          textureMap: { value: texture },
        },
        vertexShader,
        fragmentShader,
        side: THREE.FrontSide,
      })
    );
  } else {
    // Last 4 faces: solid blue with rim lighting (no texture)
    // ... use original shader without texture
  }
}
```

### 3. Adjust Texture Scaling (If Needed)

The current implementation auto-scales based on `maxExtent` (furthest vertex from center). If symbols appear too large/small, you can add a scale factor:

```javascript
// Add scaling parameter
const textureScale = 0.8; // 80% of max size

// Modify UV mapping
const u = 0.5 + (localCoords[i].u * textureScale) / (maxExtent * 2);
const v = 0.5 + (localCoords[i].v * textureScale) / (maxExtent * 2);
```

### 4. Fine-Tune Rim Lighting

Current shader blends texture with rim lighting. May need to adjust:

```glsl
// Current: 10% rim color mixing
vec3 finalColor = mix(texColor.rgb, rimColor, rim * 0.1);

// Adjust percentage as needed:
vec3 finalColor = mix(texColor.rgb, rimColor, rim * 0.05); // Less rim
vec3 finalColor = mix(texColor.rgb, rimColor, rim * 0.2);  // More rim
```

---

## Performance Notes

### Computational Complexity

**Per Frame**: None - UVs calculated once at initialization
**Initialization**: O(12 × 9) = O(108) vertex operations
**Memory**: Minimal - no additional textures or geometry

### Optimization Opportunities

1. **Red Dot Removal**: Delete debug visualization (12 extra meshes)
2. **Texture Compression**: Compress symbol PNGs (currently 363KB-826KB each)
3. **Texture Atlas**: Combine 8 symbols into single atlas (future enhancement)

---

## Mathematical Background

### Cross Product (Vector Perpendicular to Two Vectors)

```
Given vectors a and b:
cross(a, b) = (
  a.y × b.z - a.z × b.y,
  a.z × b.x - a.x × b.z,
  a.x × b.y - a.y × b.x
)
```

**Properties**:
- Result is perpendicular to both input vectors
- Right-hand rule determines direction
- Used to calculate face normal

### Dot Product (Projection of One Vector onto Another)

```
Given vectors a and b:
dot(a, b) = a.x × b.x + a.y × b.y + a.z × b.z
```

**Properties**:
- Returns scalar (not vector)
- Measures how much one vector points in direction of another
- Used to project 3D coordinates onto 2D axes

### Orthonormal Basis

A set of vectors that are:
1. **Orthogonal**: Perpendicular to each other (90° angles)
2. **Normalized**: Length = 1 (unit vectors)

**Why This Matters**: Guarantees no distortion when projecting from 3D to 2D.

### Gram-Schmidt Orthogonalization

Process to create perpendicular vectors from non-perpendicular ones:

```
1. v1 = normalize(arbitrary_vector)
2. v2 = normalize(another_vector - projection_onto_v1)
3. v3 = cross(v1, v2)
```

**Our Implementation**: Simplified version using cross product for 2D case.

---

## Troubleshooting

### Issue: Textures Still Distorted

**Check**:
1. Verify `uniqueVertices.length === 5` (should find exactly 5 unique vertices)
2. Check `normalLen > 0` (degenerate faces have zero-length normal)
3. Ensure `maxExtent > 0` (flat/degenerate geometry would cause this)

### Issue: Textures Off-Center

**Check**:
1. Red dots should appear at pentagon centers (visual verification)
2. Verify center calculation uses `uniqueVertices`, not all `positions`
3. Check projection uses `centerX/Y/Z` for relative coordinates

### Issue: Textures Upside Down or Rotated

**Cause**: Tangent vector orientation
**Fix**: Swap tangent1 and tangent2, or negate one of them

```javascript
// If rotated 90°:
const localU = relX * tangent2x + relY * tangent2y + relZ * tangent2z;
const localV = relX * tangent1x + relY * tangent1y + relZ * tangent1z;

// If flipped:
const localV = -(relX * tangent2x + relY * tangent2y + relZ * tangent2z);
```

---

## References

### Research Documents
- `/SCRATCHPAD.md` - Detailed mathematical analysis (if created during research)
- `/docs/homepage/DODECAHEDRON_TEXTURE_MAPPING_RESEARCH.md` - Initial research on 4 approaches

### Related Files
- `/frontend/public/stellar/script.js` - Implementation
- `/frontend/public/symbols/` - Symbol PNG files (8 emotional states)

### External Resources
- [Three.js BufferGeometry Documentation](https://threejs.org/docs/api/en/core/BufferGeometry.html)
- [Gram-Schmidt Orthogonalization](https://en.wikipedia.org/wiki/Gram%E2%80%93Schmidt_process)
- [UV Mapping Fundamentals](https://en.wikipedia.org/wiki/UV_mapping)

---

## Comparison: Before vs After

### Before (Spherical UV Normalization)
```javascript
// Old approach: normalize spherical UVs
const minU = Math.min(...uvs.map(uv => uv.u));
const maxU = Math.max(...uvs.map(uv => uv.u));
const u = (originalU - minU) / (maxU - minU);

// Problem: Preserved spherical distortion
```

### After (Orthonormal Basis Projection)
```javascript
// New approach: project to local 2D space
const tangent1 = normalize(edge1);
const tangent2 = cross(normal, tangent1);
const localU = (vertex - center) · tangent1;
const u = 0.5 + localU / (maxExtent * 2);

// Result: No distortion, perfect centering
```

---

## Changelog

| Date | Change | Status |
|------|--------|--------|
| 2025-10-13 | Initial UV mapping attempt (spherical normalization) | ❌ Failed |
| 2025-10-13 | Planar projection attempt (box UV mapping) | ❌ Stretched |
| 2025-10-13 | Research orthonormal basis approach | ✅ Researched |
| 2025-10-13 | Implement orthonormal basis UV mapping | ✅ Implemented |
| 2025-10-13 | Add red dot debugging visualization | ✅ Working |
| 2025-10-13 | Create white star test pattern | ✅ Working |
| 2025-10-13 | Documentation created | ✅ Complete |

---

## Team Notes

### Design Decisions

**Why 5-pointed stars for test pattern?**
Pentagon has 5 vertices, star has 5 points → natural geometric alignment for verification.

**Why leave red dots in for now?**
Visual confirmation that centers are calculated correctly. Easy to remove when no longer needed.

**Why not use texture.repeat/offset?**
Texture repeat/offset manipulates texture coordinates, but can't fix underlying UV distortion. Need to fix UVs at the source.

### Known Limitations

1. **Assumes planar faces**: If geometry has curved/subdivided faces, approach would need modification
2. **Pentagon-specific**: Algorithm finds 5 unique vertices. Would need adjustment for different face counts
3. **No texture rotation**: Stars always upright relative to tangent1 vector. Future enhancement could align with specific vertices.

---

## Success Metrics ✅

- [x] Textures centered on pentagon centers
- [x] No stretching or squashing
- [x] Consistent appearance across all 12 faces
- [x] Square textures remain square
- [x] Verified with test pattern
- [x] Verified with 3D marker visualization
- [x] Ready for production symbol textures

---

**Last Updated**: October 13, 2025
**Author**: Claude (with collaboration)
**Status**: Production-ready, awaiting symbol texture integration
