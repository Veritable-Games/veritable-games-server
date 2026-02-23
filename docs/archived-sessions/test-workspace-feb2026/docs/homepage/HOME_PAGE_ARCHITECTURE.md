# Home Page Architecture Analysis

**Date**: October 13, 2025
**Location**: `/frontend/src/app/page.tsx`
**Status**: ⚠️ Architectural review needed

---

## Overview

The home page (`/`) is architecturally unique in the platform: it's a **9-line iframe** embedding a **standalone 3D stellar visualization** built with vanilla JavaScript and Three.js. This represents a complete architectural departure from the rest of the Next.js 15 + React 19 application.

**Current Implementation**:
```tsx
export default function HomePage() {
  return (
    <iframe
      src="/stellar/index.html"
      className="w-full h-full border-0"
      title="Stellar Dodecahedron Viewer"
    />
  );
}
```

---

## Technical Architecture

### Stellar Viewer Assets

**Location**: `/frontend/public/stellar/`
**Total Size**: 2.2MB
**Last Updated**: September 2025

```
stellar/
├── index.html (260 lines)         # Entry point with inline CSS/JS
├── script.js (3,151 lines)         # Main application logic
├── stellar-main.js (24KB)          # Additional stellar logic
├── stellar-viewer-loader.js        # Module loader
├── three.js/                       # Three.js v0.180.0 library
│   ├── three.module.js            # Core Three.js module
│   ├── three.core.js              # Core functionality
│   └── examples/jsm/controls/     # OrbitControls
├── data/
│   ├── celestial-objects.json     # Gies System configuration
│   └── star-catalog.json          # Real star data (30-3000 stars)
└── workers/
    ├── orbital-worker.js          # Web Worker for orbit calculations
    └── stellar-worker.js          # Web Worker for star rendering
```

### Physics Engine

**Orbital Mechanics Implementation**:
- Full Keplerian orbital mechanics with realistic physics
- Gravitational constant: `6.6743e-11 m³/kg/s²`
- Newton-Raphson solver for Kepler's equation
- Eccentric anomaly → True anomaly conversion
- 3D orbital plane transformations with pre-computed trigonometry

**Performance Optimizations**:
```javascript
// Pre-compute trigonometric values for each orbital body
this.precomputed = {
  cosI: Math.cos(this.inclination),
  sinI: Math.sin(this.inclination),
  cosO: Math.cos(this.longitudeOfAscendingNode),
  sinO: Math.sin(this.longitudeOfAscendingNode),
  cosW: Math.cos(this.argumentOfPeriapsis),
  sinW: Math.sin(this.argumentOfPeriapsis),
};
```

**Distance Scaling**: 1 scene unit = 0.5 AU

### The Gies System (Fictional)

**Central Star - Gies (White Dwarf)**:
- Spectral Class: DA
- Mass: 0.6 M☉ (solar masses)
- Radius: 0.0084 R☉
- Temperature: 25,000K
- Luminosity: 0.05 L☉
- Color: #B4CCFF (blue-white)
- Position: (-15, 8, -10) scene units

**Planet - Chione (Super-Earth)**:
- Type: Super-Earth
- Mass: 5.0 M⊕ (Earth masses)
- Radius: 1.7 R⊕
- Semi-major axis: 2.5 AU
- Eccentricity: 0.15
- Orbital inclination: 5.2°
- Orbital period: ~2.8 years (calculated)
- Surface temperature: 280K
- Atmosphere: Thick CO₂/N₂
- Surface gravity: 2.94g
- Day length: 28.5 hours
- Color: #4A6741 (greenish)

**Moon - Grand Voss (Large Moon)**:
- Type: Large moon of Chione
- Mass: 1.2 M☾ (lunar masses)
- Radius: 1.1 R☾
- Semi-major axis: 60,420 km
- Eccentricity: 0.05
- Orbital period: 14 days
- Surface temperature: 220K
- Surface gravity: 0.19g
- Day length: 336 hours (14 days)
- Color: #8B7355 (brown)

### Star Catalog

**Real Astronomical Data**:
- 30-3000 stars (configurable)
- Coordinate system: J2000.0
- Data includes: Right ascension, declination, magnitude, spectral type, temperature, distance, luminosity class
- Notable stars: Sirius, Canopus, Arcturus, Vega, etc.

**Memory Optimization**:
```javascript
// Compressed star properties using typed arrays
const compressed = {
  positions: new Float32Array(starProperties.length * 3),      // 32-bit floats
  colors: new Float32Array(starProperties.length * 3),         // RGB values
  magnitudes: new Float32Array(starProperties.length),         // Brightness
  spectralTypes: new Uint8Array(starProperties.length),        // O,B,A,F,G,K,M
  luminosityClasses: new Uint8Array(starProperties.length),    // I,II,III,IV,V
  variableFlags: new Uint16Array(starProperties.length),       // Bitfields
};
```

### Rendering System

**Three.js Setup**:
- Version: 0.180.0 (bundled in `/public/stellar/three.js/`)
- ES6 module imports via import maps
- OrbitControls for camera manipulation
- Shadow mapping (4096x4096 resolution)

**Performance Features**:
1. **Object Pooling**: Reuses Three.js Color/Vector3 objects
2. **Web Workers**: Offloads orbital calculations to background threads
3. **Typed Arrays**: Efficient memory layout for star data
4. **LOD (implied)**: Different star counts based on performance

**Visual Effects**:
- Rim lighting on dodecahedron (fresnel-like effect)
- Pulsing glow animations on celestial bodies
- Shadow casting from white dwarf
- Bloom/glow effects on star field
- Dynamic hover UI with position tracking

### Interactive Controls

**Camera Controls**:
- Right-drag: Orbit camera around scene
- Mouse wheel: Zoom in/out
- R key: Reset camera to default position

**Object Interaction**:
- Hover: Show celestial body info overlay
- Double-click: Track/follow object (double-click again to return)

**Dodecahedron Controls**:
- W/A/S/D: Move on X/Y axes
- Q/E: Move on Z axis
- F key: Fit dodecahedron to view

**UI Elements**:
- Controls info panel (top-right)
- Hover overlays for Gies, Chione, Grand Voss
- Animated glow/pulse effects on hover

---

## Architectural Issues

### 🔴 Critical Problems

#### 1. Iframe Isolation
**Problem**: Complete isolation from Next.js application
- ❌ No access to React context (AuthContext, etc.)
- ❌ No access to Next.js routing
- ❌ No access to Zustand stores
- ❌ No communication channel between iframe and parent
- ❌ Requires full page reload to navigate away

**Impact**:
- Can't show user-specific content
- Can't track user interactions for analytics
- Can't link celestial objects to wiki/library
- Can't use platform authentication

#### 2. Duplicate Three.js Library
**Problem**: Two copies of Three.js in the application
- `package.json` lists `three@0.180.0` as dependency (unused)
- Stellar viewer bundles own copy in `/public/stellar/three.js/`
- Total wasted: ~500KB+ (gzipped)

**Impact**:
- Wasted bandwidth
- Cache inefficiency
- Maintenance burden (must update two copies)

#### 3. Zero Server-Side Rendering
**Problem**: iframe loads entirely client-side
- HTML page is just `<iframe>` tag
- No SSR benefits for initial render
- Browser must:
  1. Load page.tsx
  2. Render iframe
  3. Request `/stellar/index.html`
  4. Parse HTML
  5. Load ES6 modules
  6. Initialize Three.js
  7. Load star catalog JSON
  8. Render scene

**Impact**:
- Poor Largest Contentful Paint (LCP) - likely >2.5s
- Flash of empty content before iframe loads
- Poor perceived performance

#### 4. SEO Disaster
**Problem**: Search engines can't index content
```html
<!-- What Google sees: -->
<iframe src="/stellar/index.html" title="Stellar Dodecahedron Viewer"></iframe>
<!-- No textual content -->
<!-- No semantic HTML -->
<!-- No structured data -->
```

**Impact**:
- Home page has zero search-visible content
- No keywords for SEO
- No meta descriptions
- Google Search Console will flag this
- Won't rank for "stellar visualization" or similar terms

#### 5. Accessibility Violations
**WCAG 2.1 Issues**:
- ❌ No keyboard navigation documentation
- ❌ Screen readers only see "Stellar Dodecahedron Viewer" (no content)
- ❌ No ARIA labels on interactive elements
- ❌ Contrast issues (dark UI on black background)
- ❌ No alternative 2D view for users who can't use 3D
- ❌ No way to disable animations (vestibular disorders)

**Screen Reader Experience**:
```
"Frame, Stellar Dodecahedron Viewer"
[User is stuck - no content announced]
```

### 🟡 Medium Concerns

#### 6. No Integration with Platform Features
**Missed Opportunities**:
- Can't link "Gies" star to wiki article about white dwarfs
- Can't add "Chione" planet to user's library favorites
- Can't create project workspace with stellar system
- Can't navigate from 3D view to related content
- Can't show user's saved celestial objects

**Example Use Case (Currently Impossible)**:
```
User hovers over Chione
→ Should show "View wiki article" link
→ Currently: Just shows orbital data
```

#### 7. Performance: 2.2MB Initial Load
**Breakdown**:
- Three.js library: ~500KB
- OrbitControls: ~20KB
- Star catalog JSON: ~100KB (30 stars) to ~2MB (3000 stars)
- Script.js: ~107KB
- Stellar-main.js: ~24KB

**Optimization Opportunities**:
- Use Three.js from CDN (Cloudflare/jsDelivr)
- Tree-shake unused Three.js modules
- Lazy load star catalog (load 30 stars, fetch 3000 on demand)
- Code split by feature (orbital mechanics vs star field)
- Use WebP textures if any exist

#### 8. No Loading State
**Problem**: User sees blank frame while loading
```tsx
// Current: No feedback during 2-3s load time
<iframe src="/stellar/index.html" />
```

**User Experience**:
- White/black screen for 2-3 seconds
- No progress indicator
- User thinks site is broken

#### 9. No Error Handling
**Problem**: If Three.js fails to load:
```javascript
// Current error handling in index.html:
catch (error) {
  document.body.innerHTML = `
    <div style="...">
      <h2>Loading Error</h2>
      <p>Please refresh the page</p>
    </div>
  `;
}
```

**Issues**:
- Generic error message (no diagnostics)
- Requires manual refresh
- No telemetry/logging of failures

---

## Architectural Mismatches

### Home Page vs Rest of Application

| Aspect | Home Page | Other Pages |
|--------|-----------|-------------|
| **Framework** | Vanilla JS | Next.js 15 + React 19 |
| **Rendering** | Client-only iframe | Server Components + Client Components |
| **State** | Internal JS variables | Zustand stores + React Context |
| **Routing** | N/A (isolated) | Next.js App Router |
| **Data** | Static JSON files | SQLite databases via dbPool |
| **Auth** | N/A | AuthContext + session management |
| **Styling** | Inline CSS | Tailwind CSS |
| **Type Safety** | None (vanilla JS) | TypeScript 5.7.2 strict mode |
| **Build** | Copy to public/ | Next.js build process |
| **Testing** | None | Jest + Playwright |

**Conclusion**: The home page doesn't participate in **any** of the platform's architectural patterns or infrastructure.

---

## Recommendations

### 🚀 Quick Wins (Low Effort - 1-2 hours)

#### 1. Add Loading State
```tsx
'use client';

import { useState } from 'react';

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-white">Loading Stellar Viewer...</p>
          </div>
        </div>
      )}
      <iframe
        src="/stellar/index.html"
        className="absolute inset-0 w-full h-full border-0"
        title="Interactive 3D stellar system viewer showing the Gies System"
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
}
```

#### 2. Improve SEO Metadata
```tsx
// In page.tsx
export const metadata = {
  title: 'Stellar Dodecahedron Viewer | Veritable Games',
  description: 'Explore the fictional Gies System with realistic orbital mechanics. Interactive 3D visualization of a white dwarf star, super-earth planet, and moon with Keplerian physics.',
  keywords: 'stellar visualization, orbital mechanics, 3D astronomy, Three.js, white dwarf, Kepler orbits',
  openGraph: {
    title: 'Stellar Dodecahedron Viewer',
    description: 'Interactive 3D stellar system with realistic physics',
    images: ['/stellar-preview.png'], // Create this screenshot
  },
};
```

#### 3. Add Accessibility Skip Link
```tsx
<div className="sr-only">
  <a href="#main-navigation">Skip to navigation</a>
</div>
```

#### 4. Add Error Boundary
```tsx
import { ErrorBoundary } from 'react-error-boundary';

function StellarFallback() {
  return (
    <div className="flex items-center justify-center h-full bg-black text-white">
      <div className="text-center">
        <h2 className="text-2xl mb-4">Stellar Viewer Unavailable</h2>
        <p className="mb-4">The 3D visualization failed to load.</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 rounded">
          Reload Page
        </button>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <ErrorBoundary FallbackComponent={StellarFallback}>
      {/* iframe code */}
    </ErrorBoundary>
  );
}
```

### 🔧 Medium Refactor (Medium Effort - 1-2 days)

#### 5. Convert to React Component
**Goal**: Replace iframe with native React Three.js component

**Approach**:
```tsx
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Lazy load to avoid SSR issues
const StellarViewer = dynamic(() => import('@/components/stellar/StellarViewer'), {
  ssr: false,
  loading: () => <LoadingSpinner />,
});

export default function HomePage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <StellarViewer />
    </Suspense>
  );
}
```

**Benefits**:
- ✅ Access to React Context (auth, routing)
- ✅ Share Three.js dependency with rest of app
- ✅ Enable code splitting
- ✅ Better error handling
- ✅ Can use TypeScript

**Migration Path**:
1. Install `@react-three/fiber` and `@react-three/drei`
2. Port `OrbitalBody` class to TypeScript
3. Create `<StellarViewer />` component
4. Refactor orbital mechanics into custom hooks
5. Move Web Workers to `/src/workers/`
6. Test side-by-side with iframe version
7. Switch when confident

#### 6. Code Split Star Catalog
```typescript
// Lazy load large star catalog
const loadStarCatalog = async (count: number) => {
  if (count <= 30) {
    return await import('@/data/stars-small.json');
  } else {
    return await import('@/data/stars-large.json');
  }
};
```

#### 7. Add Telemetry
```typescript
// Track user interactions
import { analytics } from '@/lib/analytics';

function handleCelestialBodyHover(bodyName: string) {
  analytics.track('stellar_body_hover', { body: bodyName });
}

function handleCameraReset() {
  analytics.track('stellar_camera_reset');
}
```

#### 8. Integrate with Platform
```tsx
// Link celestial bodies to wiki
function CelestialBodyInfo({ body }) {
  return (
    <div className="star-info">
      <h3>{body.name}</h3>
      <p>Temperature: {body.temperature}K</p>
      <Link href={`/wiki/astronomy/${body.slug}`}>
        View Wiki Article →
      </Link>
    </div>
  );
}
```

### 🏗️ Full Rearchitecture (High Effort - 1-2 weeks)

#### 9. Database-Driven Stellar Systems
**Goal**: Move celestial objects from JSON to SQLite

**Schema Design**:
```sql
-- New tables in content.db or astronomy.db
CREATE TABLE stellar_systems (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  age_billion_years REAL,
  created_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE celestial_bodies (
  id INTEGER PRIMARY KEY,
  system_id INTEGER REFERENCES stellar_systems(id),
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('star', 'planet', 'moon', 'asteroid', 'comet')),
  parent_id INTEGER REFERENCES celestial_bodies(id),
  mass_kg REAL,
  radius_m REAL,
  semi_major_axis_m REAL,
  eccentricity REAL,
  inclination_rad REAL,
  -- ... orbital elements ...
  wiki_page_id INTEGER REFERENCES wiki_pages(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stellar_observations (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  body_id INTEGER REFERENCES celestial_bodies(id),
  observation_type TEXT CHECK(observation_type IN ('view', 'favorite', 'track', 'double_click')),
  duration_seconds INTEGER,
  observed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Benefits**:
- User-submitted solar systems
- Version control for celestial data
- Link to wiki articles
- Track user engagement
- Create projects around stellar systems

#### 10. Accessibility Overhaul
**Components Needed**:

a. **Keyboard Shortcuts Panel**:
```tsx
function KeyboardShortcutsPanel() {
  return (
    <div className="bg-black/80 p-4 rounded" role="dialog" aria-label="Keyboard shortcuts">
      <h2 className="text-xl mb-4">Keyboard Controls</h2>
      <dl>
        <dt>Arrow Keys / WASD</dt>
        <dd>Move dodecahedron</dd>
        <dt>Q / E</dt>
        <dd>Move up/down</dd>
        <dt>R</dt>
        <dd>Reset camera</dd>
        <dt>F</dt>
        <dd>Fit to view</dd>
        <dt>?</dt>
        <dd>Show this help</dd>
      </dl>
    </div>
  );
}
```

b. **Alternative 2D View**:
```tsx
function CelestialBodiesTable({ system }) {
  return (
    <table className="w-full" role="table" aria-label="Celestial bodies in system">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Mass</th>
          <th>Orbital Period</th>
        </tr>
      </thead>
      <tbody>
        {system.bodies.map(body => (
          <tr key={body.id}>
            <td>{body.name}</td>
            <td>{body.type}</td>
            <td>{body.mass} M⊕</td>
            <td>{body.orbitalPeriod} days</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

c. **ARIA Live Regions**:
```tsx
function StellarViewer() {
  const [focusedBody, setFocusedBody] = useState<string | null>(null);

  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {focusedBody && `Now viewing ${focusedBody}`}
      </div>
      <Canvas>
        {/* 3D scene */}
      </Canvas>
    </>
  );
}
```

d. **High Contrast Mode**:
```tsx
function useContrastMode() {
  const [highContrast, setHighContrast] = useState(false);

  return {
    highContrast,
    toggle: () => setHighContrast(!highContrast),
    colors: highContrast
      ? { star: '#FFFFFF', planet: '#FFFF00', background: '#000000' }
      : { star: '#B4CCFF', planet: '#4A6741', background: '#000011' }
  };
}
```

#### 11. Performance Optimization
**Progressive Enhancement Strategy**:

```tsx
'use client';

import { useEffect, useState } from 'react';

function useWebGLSupport() {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    setSupported(!!gl);
  }, []);

  return supported;
}

export default function HomePage() {
  const webglSupported = useWebGLSupport();

  if (webglSupported === null) {
    return <LoadingSpinner />;
  }

  if (!webglSupported) {
    return <FallbackStellarView />;
  }

  return <StellarViewer />;
}
```

**CDN Strategy**:
```html
<!-- Use Three.js from CDN instead of bundling -->
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/"
  }
}
</script>
```

**Benefits**:
- Better caching (shared across sites)
- Reduced bundle size
- Faster initial load

---

## Integration Ideas

### Link to Other Platform Features

#### 1. Wiki Integration
```typescript
// Link celestial objects to wiki articles
const celestialWikiLinks = {
  'Gies': '/wiki/astronomy/white-dwarfs',
  'Chione': '/wiki/astronomy/super-earths',
  'Grand Voss': '/wiki/astronomy/moons',
};

function CelestialBodyInfo({ body }) {
  const wikiLink = celestialWikiLinks[body.name];

  return (
    <div>
      <h3>{body.name}</h3>
      <p>{body.description}</p>
      {wikiLink && (
        <Link href={wikiLink}>
          Learn more in wiki →
        </Link>
      )}
    </div>
  );
}
```

#### 2. Library Integration
```typescript
// Save celestial systems to library
async function saveStellarSystemToLibrary(systemId: string, userId: number) {
  await fetch('/api/library/documents', {
    method: 'POST',
    body: JSON.stringify({
      title: `Gies System - Interactive Model`,
      type: 'stellar_system',
      content: { systemId },
      tags: ['astronomy', '3d-model', 'orbital-mechanics'],
    }),
  });
}
```

#### 3. Project Workspace Integration
```typescript
// Create project from stellar system
async function createProjectFromSystem(systemId: string) {
  await fetch('/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Gies System Analysis',
      description: 'Study of the Gies stellar system',
      type: 'astronomy',
      initialData: { systemId },
    }),
  });
}
```

#### 4. User Tracking
```typescript
// Track user's favorite celestial bodies
async function toggleFavorite(bodyId: string, userId: number) {
  const favorite = await fetch('/api/users/favorites', {
    method: 'POST',
    body: JSON.stringify({
      itemType: 'celestial_body',
      itemId: bodyId,
    }),
  });
}
```

---

## Decision Matrix

### When to Tackle Each Recommendation

| Priority | Effort | Impact | Timeline |
|----------|--------|--------|----------|
| 🔴 Loading state | Low | High | This week |
| 🔴 SEO metadata | Low | High | This week |
| 🔴 Remove CSRF dead code | Low | Low | ✅ DONE |
| 🟡 Error boundary | Low | Medium | This week |
| 🟡 Accessibility skip link | Low | Medium | Next week |
| 🟠 Convert to React | High | High | Next sprint |
| 🟠 Code splitting | Medium | Medium | Next sprint |
| 🟠 Telemetry | Low | Medium | Next sprint |
| 🟢 Database integration | High | Medium | Future |
| 🟢 Alternative 2D view | Medium | High | Future |
| 🟢 Wiki integration | Medium | High | Future |

---

## Strategic Questions

Before investing significant effort, answer these questions:

### 1. Purpose of Home Page
**What is the strategic vision?**
- [ ] Showcase of 3D capabilities (tech demo)
- [ ] Interactive landing experience (engagement tool)
- [ ] Navigation hub to rest of platform
- [ ] Standalone astronomy visualization tool
- [ ] Marketing asset to attract users

### 2. User Journey
**What should happen after user views the stellar system?**
- [ ] Navigate to wiki to learn about orbital mechanics
- [ ] Browse library for astronomy resources
- [ ] Create project to build their own stellar system
- [ ] Read news about recent astronomy developments
- [ ] Nothing - it's purely decorative

### 3. Content Strategy
**Should celestial systems be:**
- [ ] Static (current approach - one hardcoded system)
- [ ] Curated (admin-managed collection of systems)
- [ ] User-generated (community can create/share systems)
- [ ] Mixed (featured systems + user submissions)

### 4. Performance Priorities
**What matters most?**
- [ ] Initial load speed (<2s LCP)
- [ ] Interactivity (smooth 60fps rendering)
- [ ] Mobile support (works on phones/tablets)
- [ ] Accessibility (screen reader friendly)
- [ ] SEO (discoverable via search)

### 5. Integration Depth
**How much should stellar viewer integrate with platform?**
- [ ] Minimal - keep it isolated (current)
- [ ] Light - add links to wiki/library
- [ ] Medium - save favorites, track interactions
- [ ] Deep - database-driven, user systems, projects

### 6. Maintenance Philosophy
**Who maintains the stellar viewer code?**
- [ ] Separate codebase (current - vanilla JS in /public/)
- [ ] Integrated codebase (TypeScript React components)
- [ ] Third-party library (use existing solution)
- [ ] Open source (extract as standalone package)

---

## Related Files

### Code Files
- `/frontend/src/app/page.tsx` - Home page entry point (9 lines)
- `/frontend/src/app/layout.tsx` - Root layout with MainLayout
- `/frontend/src/components/layouts/MainLayout.tsx` - Navigation wrapper
- `/frontend/src/app/providers.tsx` - ✅ CSRF dead code removed

### Stellar Viewer Files
- `/frontend/public/stellar/index.html` - Entry point (260 lines)
- `/frontend/public/stellar/script.js` - Main logic (3,151 lines)
- `/frontend/public/stellar/stellar-main.js` - Additional logic (24KB)
- `/frontend/public/stellar/data/celestial-objects.json` - Gies System config
- `/frontend/public/stellar/data/star-catalog.json` - Real star data

### Documentation
- This file: `/docs/homepage/HOME_PAGE_ARCHITECTURE.md`
- Stellar viewer docs: `/docs/homepage/STELLAR_VIEWER_TECHNICAL_SPECS.md` (to be created)
- Integration guide: `/docs/homepage/STELLAR_INTEGRATION_GUIDE.md` (to be created)

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-10-13 | Initial architectural analysis | Claude |
| 2025-10-13 | Removed CSRF dead code from providers.tsx | Claude |

---

## Next Steps

1. ✅ **DONE**: Remove CSRF dead code from providers.tsx
2. **Discuss**: Review strategic questions with team
3. **Decide**: Choose architectural direction (iframe vs React component)
4. **Implement**: Quick wins (loading state, SEO, error handling)
5. **Plan**: Long-term refactor if React component route chosen
6. **Test**: Verify improvements with Lighthouse/axe-core
7. **Monitor**: Track user engagement with home page

---

## Notes

**Last Updated**: October 13, 2025

**Reviewer Notes**:
- The stellar viewer is technically impressive (realistic Keplerian mechanics!)
- But architecturally it's a "black box" that doesn't integrate with the platform
- Quick wins can improve UX without major refactor
- Long-term decision: Keep iframe isolated or migrate to React?
- Consider user analytics to see if home page drives engagement

**Key Insight**: The home page is the only page that doesn't use Next.js Server Components, React context, SQLite databases, or any of the platform's infrastructure. It's essentially a separate application embedded via iframe.
