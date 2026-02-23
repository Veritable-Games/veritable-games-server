# Home Page Documentation

This directory contains comprehensive documentation for the Veritable Games home page and its embedded Stellar Dodecahedron Viewer.

---

## Quick Links

### Core Documentation
- **[HOME_PAGE_ARCHITECTURE.md](./HOME_PAGE_ARCHITECTURE.md)** - Architectural analysis, issues, and recommendations
- **[STELLAR_VIEWER_TECHNICAL_SPECS.md](./STELLAR_VIEWER_TECHNICAL_SPECS.md)** - Technical specifications for the 3D viewer
- **[CONTROLS_PANEL_DOCUMENTATION.md](./CONTROLS_PANEL_DOCUMENTATION.md)** - Removed controls overlay (archived documentation)

---

## Overview

The home page (`/`) is architecturally unique: it's a **9-line iframe** embedding a **standalone 3D stellar visualization** built with vanilla JavaScript and Three.js v0.180.0.

**Current Implementation**:
```tsx
// /frontend/src/app/page.tsx
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

**Stellar Viewer Location**: `/frontend/public/stellar/` (2.2MB)

---

## Key Issues

### 🔴 Critical
1. **Iframe Isolation** - No integration with React/Next.js app
2. **Duplicate Three.js** - Bundled separately from npm dependency
3. **Zero SSR** - Client-side only, poor initial load performance
4. **SEO Disaster** - No indexable content on home page
5. **Accessibility Violations** - Screen readers can't access content

### 🟡 Medium
6. **No Platform Integration** - Can't link to wiki/library/projects
7. **2.2MB Initial Load** - Large payload with no code splitting
8. **No Loading State** - Blank screen during 2-3s load time
9. **No Error Handling** - Generic error message if Three.js fails

---

## Quick Wins (Implemented)

✅ **Removed Controls Overlay Panel** from stellar viewer (October 13, 2025) - See [CONTROLS_PANEL_DOCUMENTATION.md](./CONTROLS_PANEL_DOCUMENTATION.md)

---

## Quick Wins (To Do)

See [HOME_PAGE_ARCHITECTURE.md](./HOME_PAGE_ARCHITECTURE.md#-quick-wins-low-effort---1-2-hours) for detailed implementation:

1. **Add Loading State** - Show spinner during iframe load
2. **Improve SEO Metadata** - Add title, description, OpenGraph tags
3. **Add Accessibility Skip Link** - Allow keyboard users to skip to navigation
4. **Add Error Boundary** - Handle Three.js load failures gracefully

**Estimated Effort**: 1-2 hours
**Impact**: High (better UX, SEO, accessibility)

---

## Medium Refactor Options

See [HOME_PAGE_ARCHITECTURE.md](./HOME_PAGE_ARCHITECTURE.md#-medium-refactor-medium-effort---1-2-days) for details:

1. **Convert to React Component** - Replace iframe with `@react-three/fiber`
2. **Code Split Star Catalog** - Lazy load large star data
3. **Add Telemetry** - Track user interactions
4. **Integrate with Platform** - Link celestial bodies to wiki articles

**Estimated Effort**: 1-2 days
**Impact**: High (enables platform integration)

---

## Long-Term Vision

See [HOME_PAGE_ARCHITECTURE.md](./HOME_PAGE_ARCHITECTURE.md#-full-rearchitecture-high-effort---1-2-weeks) for full plan:

1. **Database-Driven Stellar Systems** - Move from JSON to SQLite
2. **Accessibility Overhaul** - Alternative 2D view, keyboard shortcuts panel
3. **Performance Optimization** - LOD system, CDN for Three.js, progressive enhancement

**Estimated Effort**: 1-2 weeks
**Impact**: Transformative (fully integrated feature)

---

## Technical Details

### Gies System (Fictional)

The stellar viewer shows a fictional solar system called the "Gies System":

- **Star**: Gies (DA White Dwarf, 0.6 M☉, 25,000K)
- **Planet**: Chione (Super-Earth, 5 M⊕, 2.5 AU orbit, 2.8 year period)
- **Moon**: Grand Voss (Large moon, 1.2 M☾, 14 day orbit around Chione)

**Physics**: Full Keplerian orbital mechanics with realistic gravitational calculations.

**Star Field**: 30-3000 real stars from astronomical catalogs (Sirius, Canopus, Arcturus, Vega, etc.)

### Technology Stack

- **Three.js**: v0.180.0 (bundled in `/public/stellar/three.js/`)
- **Orbital Mechanics**: Custom implementation with Newton-Raphson solver
- **Performance**: Object pooling, typed arrays, Web Workers
- **Size**: 2.2MB total (Three.js + star data + application logic)

For complete technical specs, see [STELLAR_VIEWER_TECHNICAL_SPECS.md](./STELLAR_VIEWER_TECHNICAL_SPECS.md).

---

## Architecture Decision Log

| Date | Decision | Rationale | Status |
|------|----------|-----------|--------|
| 2025-10-13 | Documented architecture as-is | Understanding current state before refactor | ✅ Done |
| 2025-10-13 | Removed CSRF dead code | CSRF was removed in Oct 2025, code was unused | ✅ Done |
| TBD | Quick wins (loading state, SEO, a11y) | Low effort, high impact improvements | 🔜 Next |
| TBD | React component vs iframe decision | Strategic choice needed | ⏳ Pending |
| TBD | Database integration planning | Long-term vision | ⏳ Future |

---

## Strategic Questions (Unanswered)

Before investing significant refactor effort, these questions need answers:

### 1. Purpose of Home Page
- [ ] Showcase of 3D capabilities (tech demo)
- [ ] Interactive landing experience (engagement tool)
- [ ] Navigation hub to rest of platform
- [ ] Standalone astronomy visualization tool
- [ ] Marketing asset to attract users

### 2. User Journey
What should happen after user views the stellar system?
- [ ] Navigate to wiki to learn about orbital mechanics
- [ ] Browse library for astronomy resources
- [ ] Create project to build their own stellar system
- [ ] Read news about recent astronomy developments
- [ ] Nothing - it's purely decorative

### 3. Content Strategy
Should celestial systems be:
- [ ] Static (current - one hardcoded system)
- [ ] Curated (admin-managed collection)
- [ ] User-generated (community creates/shares)
- [ ] Mixed (featured + user submissions)

### 4. Integration Depth
How much should stellar viewer integrate?
- [ ] Minimal - keep it isolated (current)
- [ ] Light - add links to wiki/library
- [ ] Medium - save favorites, track interactions
- [ ] Deep - database-driven, user systems, projects

---

## Related Files

### Source Code
- `/frontend/src/app/page.tsx` - Home page entry point (9 lines)
- `/frontend/src/app/layout.tsx` - Root layout
- `/frontend/src/components/layouts/MainLayout.tsx` - Navigation wrapper
- `/frontend/src/app/providers.tsx` - React providers (CSRF code removed)

### Stellar Viewer
- `/frontend/public/stellar/index.html` - Entry point (260 lines)
- `/frontend/public/stellar/script.js` - Main logic (3,151 lines)
- `/frontend/public/stellar/stellar-main.js` - Additional logic (24KB)
- `/frontend/public/stellar/data/celestial-objects.json` - Gies System config
- `/frontend/public/stellar/data/star-catalog.json` - Real star data

### Tests
- ❌ No tests currently exist for stellar viewer
- ❌ No E2E tests for home page

---

## Next Steps

1. **Review Documentation** - Share with team, get feedback
2. **Answer Strategic Questions** - Decide on home page purpose/vision
3. **Implement Quick Wins** - Loading state, SEO, accessibility improvements
4. **Make Architectural Decision** - Iframe vs React component
5. **Plan Long-Term Refactor** - If React route chosen, create migration plan

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-10-13 | Created initial documentation | Claude |
| 2025-10-13 | Removed CSRF dead code from providers.tsx | Claude |
| 2025-10-13 | Removed Controls overlay panel from stellar viewer | Claude |

---

**Questions or Feedback?**

This documentation is a living resource. If you have questions, find errors, or want to propose changes, please:
1. Open an issue in the project repository
2. Update this documentation directly
3. Discuss with the team during sprint planning

---

**Last Updated**: October 13, 2025
