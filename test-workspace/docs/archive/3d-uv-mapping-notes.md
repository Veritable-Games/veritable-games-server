# UV Mapping Distortion Analysis: Pentagon Face Texturing on Dodecahedron

## Problem Summary

**Observed Behavior:**
- Star textures are correctly centered on dodecahedron pentagon faces (verified with 3D markers)
- **BUT**: Stars are stretched/squashed in random directions despite perfect centering
- Current approach uses uniform scaling (`maxDist`) for both U and V coordinates

**Root Cause:** Uniform scaling assumes the pentagon is circular, but pentagons are NOT circular - they have different extents in different directions.

---

## Mathematical Analysis

### Why Uniform Scaling Causes Distortion

#### Current Approach (INCORRECT)
```
maxDist = max distance from center to any vertex
u = 0.5 + (coord1 - center1) / (maxDist * 2)
v = 0.5 + (coord2 - center2) / (maxDist * 2)
```

**Problem:** This creates a circular mapping zone, but pentagons are NOT circular!

#### Visual Explanation
```
Pentagon actual shape (angled view):
     *
    / \
   /   \
  *     *        <- vertices extend further horizontally than vertically
   \   /
    \ /
     *

Uniform scaling assumes:
    ***
   *   *         <- perfect circle
  *     *
   *   *
    ***

Result: Texture gets squashed where pentagon is wider than the circular zone
```

### The Fundamental Issue

For a regular pentagon:
- **Horizontal extent** (width): ~1.62 × radius (golden ratio φ ≈ 1.618)
- **Vertical extent** (height): ~1.90 × radius

If you use the same scaling factor for both directions, the texture will be:
- **Compressed horizontally** (pentagon is wider than circle)
- **Stretched vertically** (pentagon is taller than circle)

### Why It Varies By Face

Each dodecahedron face has a different orientation in 3D space:
- Some faces project wider in X-Z plane
- Some faces project wider in Y-Z plane
- Some faces project wider in X-Y plane

Because the pentagon's aspect ratio varies by projection angle, each face shows different distortion!

---

## Mathematical Solution

### Step 1: Compute Face Normal (Plane Equation)

Instead of using the "dominant axis" method (which just picks 2 axes), compute the actual plane the pentagon lies on.

```
Normal Vector Formula:
n = (v1 - v0) × (v2 - v0)    [cross product of two edges]

Normalize:
n = n / |n|
```

This gives you the perpendicular vector to the pentagon's plane.

### Step 2: Create Orthonormal Basis (Local 2D Coordinate System)

You need two perpendicular vectors that lie IN the plane of the pentagon.

```
Gram-Schmidt Orthogonalization:

1. Choose arbitrary "up" vector (e.g., world Y-axis):
   up = (0, 1, 0)

2. Compute first tangent (project "up" onto plane):
   tangent1 = up - (up · n) × n
   tangent1 = tangent1 / |tangent1|    [normalize]

3. Compute second tangent (perpendicular to both):
   tangent2 = n × tangent1    [cross product]
   (already normalized if n and tangent1 are)
```

**Critical:** These two tangents form an orthonormal basis (perpendicular unit vectors) in the plane.

### Step 3: Project Vertices to 2D Local Coordinates

```
For each vertex position p:
  local_u = (p - center) · tangent1
  local_v = (p - center) · tangent2
```

**Result:** Now you have TRUE 2D coordinates in the pentagon's local plane!

### Step 4: Compute Axis-Aligned Bounding Box in Local Space

```
min_u = min(all local_u values)
max_u = max(all local_u values)
min_v = min(all local_v values)
max_v = max(all local_v values)

width = max_u - min_u
height = max_v - min_v
```

### Step 5: Map to UV Space with Separate Scaling

**Option A: Fit to Unit Square (May Cause Aspect Ratio Distortion)**
```
u = (local_u - min_u) / width
v = (local_v - min_v) / height
```
*Problem:* If pentagon is wider than tall, texture gets squashed horizontally.

**Option B: Preserve Aspect Ratio (RECOMMENDED)**
```
scale = max(width, height)  // Use largest dimension

u = 0.5 + (local_u - center_u) / scale
v = 0.5 + (local_v - center_v) / scale

where:
  center_u = (min_u + max_u) / 2
  center_v = (min_v + max_v) / 2
```
*Benefit:* Square textures remain square, centered on pentagon.

**Option C: Anisotropic Scaling with Margin (BEST FOR STARS)**
```
margin = 1.1  // 10% padding

scale_u = width * margin
scale_v = height * margin

u = 0.5 + (local_u - center_u) / scale_u
v = 0.5 + (local_v - center_v) / scale_v
```
*Benefit:* Fits pentagon tightly while preserving texture aspect ratio.

---

## Why This Works

### The Key Insight

**Uniform scaling projects a 3D circle onto the pentagon's plane → ellipse (stretched circle)**

**Orthonormal basis projects the pentagon onto a 2D plane → true shape preserved**

### Mathematical Proof

Given:
- Pentagon vertices: `v₀, v₁, v₂, v₃, v₄`
- All vertices are coplanar (lie on same plane)

Using orthonormal basis `{t₁, t₂}`:
- `t₁ · t₂ = 0` (perpendicular)
- `|t₁| = |t₂| = 1` (unit length)
- `t₁ × t₂ = n` (normal to plane)

For any point `p` on the plane:
```
p = center + α×t₁ + β×t₂

where:
  α = (p - center) · t₁    [projection onto first axis]
  β = (p - center) · t₂    [projection onto second axis]
```

This is a **conformal mapping** (preserves angles and local shapes).

---

## Algorithm Summary

```
PSEUDOCODE:

For each pentagon face:
  1. Extract 5 unique vertices

  2. Compute center = average of 5 vertices

  3. Compute face normal:
     edge1 = vertices[1] - vertices[0]
     edge2 = vertices[2] - vertices[0]
     normal = normalize(cross(edge1, edge2))

  4. Create orthonormal basis:
     up = (0, 1, 0)  // or (0, 0, 1) or (1, 0, 0)
     tangent1 = normalize(up - (up·normal)×normal)
     tangent2 = cross(normal, tangent1)

  5. Project all vertices to 2D:
     For each vertex v:
       local_u = (v - center) · tangent1
       local_v = (v - center) · tangent2

  6. Find bounding box:
     min_u, max_u, min_v, max_v
     width = max_u - min_u
     height = max_v - min_v

  7. Choose scaling strategy:

     OPTION 1 - Uniform (preserves aspect):
       scale = max(width, height)
       u = 0.5 + local_u / scale
       v = 0.5 + local_v / scale

     OPTION 2 - Anisotropic (fits tighter):
       u = 0.5 + local_u / width
       v = 0.5 + local_v / height

     OPTION 3 - Hybrid (centered + fitted):
       center_u = (min_u + max_u) / 2
       center_v = (min_v + max_v) / 2
       u = 0.5 + (local_u - center_u) / width
       v = 0.5 + (local_v - center_v) / height
```

---

## Special Considerations

### Edge Case: Degenerate Normals

If the pentagon is nearly degenerate (all vertices nearly collinear), the normal may be unstable.

**Solution:** Check magnitude of normal before normalizing:
```
normal = cross(edge1, edge2)
if (length(normal) < epsilon):
  // Use fallback method (e.g., dominant axis)
normal = normalize(normal)
```

### Edge Case: Parallel to "Up" Vector

If `normal` is parallel to your chosen `up` vector, `tangent1` becomes zero.

**Solution:** Use a different reference vector:
```
if (abs(normal · up) > 0.99):
  up = (1, 0, 0)  // Use X-axis instead
```

### Coordinate System Handedness

Ensure consistent winding order for all faces:
```
// Right-hand rule: thumb = normal, fingers = edge order
// If normal points outward, edges should be counter-clockwise
```

---

## Recommended Approach for Your Use Case

Since you want **square star textures centered on pentagon faces**:

### Use Option B: Uniform Scaling with Orthonormal Basis

```
1. Compute orthonormal basis {tangent1, tangent2} for pentagon plane
2. Project all vertices to 2D local coordinates
3. Find max extent: scale = max(width, height)
4. Map to UV:
   u = 0.5 + local_u / scale
   v = 0.5 + local_v / scale
```

**Benefits:**
- ✅ Centers remain perfect (already verified)
- ✅ Square textures remain square (no aspect distortion)
- ✅ Uniform size across all faces
- ✅ No stretching or squashing

**Trade-off:**
- ⚠️ Small gaps between texture and pentagon edges (acceptable for stars)

---

## Verification Strategy

After implementing the fix:

1. **Visual Inspection:** Stars should appear perfectly circular/square (not elliptical)
2. **Measurement:** Check U/V gradients along pentagon edges (should be uniform)
3. **Quantitative Test:**
   ```javascript
   // For each face:
   const aspectRatio = measureStarAspectRatio(face);
   console.assert(Math.abs(aspectRatio - 1.0) < 0.05, "Star is distorted!");
   ```

---

## References & Theory

### Linear Algebra Concepts
- **Orthonormal Basis:** Set of perpendicular unit vectors that span a space
- **Gram-Schmidt Process:** Algorithm to orthogonalize vectors
- **Dot Product Projection:** `proj_a(b) = (b·a)a` (assumes `a` is unit vector)
- **Cross Product:** `a × b` produces vector perpendicular to both `a` and `b`

### Geometry Concepts
- **Planar Projection:** Mapping 3D points to 2D plane while preserving distances
- **Conformal Mapping:** Transformation that preserves angles (not necessarily sizes)
- **Affine Transformation:** Linear mapping + translation (preserves parallel lines)

### UV Mapping Best Practices
- **Minimize Distortion:** Use least-squares methods or conformal mappings
- **Aspect Ratio:** Match texture aspect ratio to surface aspect ratio
- **Seam Placement:** For closed surfaces, carefully plan UV seams

---

## Next Steps

### Implementation Checklist
- [ ] Replace dominant-axis projection with orthonormal basis
- [ ] Compute face normal using cross product
- [ ] Implement Gram-Schmidt orthogonalization
- [ ] Project vertices to 2D local space using dot products
- [ ] Compute axis-aligned bounding box in local space
- [ ] Apply uniform scaling using max(width, height)
- [ ] Test with star texture and verify no distortion

### Testing Plan
- [ ] Add debug visualization for tangent vectors
- [ ] Measure aspect ratios of rendered stars
- [ ] Compare UVs before/after fix
- [ ] Verify all 12 faces show consistent star sizes

---

## Conclusion

**The Problem:** Uniform scaling in 3D space creates a spherical UV mapping zone, but pentagons are planar and non-circular.

**The Solution:** Create a local 2D coordinate system (orthonormal basis) aligned with the pentagon's plane, project vertices to this 2D space, and then scale uniformly in 2D.

**The Math:** This uses fundamental linear algebra (dot products, cross products, normalization) to create a conformal mapping that preserves the texture's aspect ratio while fitting the pentagon.

**Expected Result:** Square star textures will remain square, perfectly centered, with no stretching or squashing on any face.
