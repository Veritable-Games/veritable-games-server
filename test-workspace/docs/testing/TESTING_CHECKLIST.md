# Systematic Testing Checklist for Veritable Games Platform

## 🎯 Testing Overview

This checklist provides a systematic approach to test all major features of the Veritable Games platform. Each section includes both automated and manual testing approaches.

**Test Environment Setup:**

- Development server: `http://127.0.0.1:3000`
- Test user credentials: `username=testuser, password=test123`
- Admin access: User ID 1 (Administrator profile)

---

## 🔐 Phase 1: Critical Security Features (HIGH PRIORITY)

### CSRF Protection

- [ ] CSRF token endpoint (`/api/auth/csrf-token`) returns valid tokens
- [ ] POST requests without CSRF tokens are rejected (403)
- [ ] Admin endpoints require authentication (401)
- [ ] Frontend components use `useCSRFToken` hook correctly

**Automated Test:** Manual testing required - comprehensive wiki testing not yet implemented

### Authentication System

- [ ] **User Registration** (`/forums/register`)
  - [ ] Valid registration creates new user
  - [ ] Duplicate email/username validation
  - [ ] Password strength requirements
  - [ ] Account activation process
- [ ] **User Login** (`/forums/login`)

  - [ ] Valid credentials authenticate successfully
  - [ ] Invalid credentials rejected
  - [ ] Session persistence across browser sessions
  - [ ] Logout functionality clears session

- [ ] **Password Security**
  - [ ] Password hashing (bcrypt cost 12)
  - [ ] Password reset functionality
  - [ ] Session timeout (30 days)

### Authorization & Role-Based Access

- [ ] **User Roles** (admin, moderator, user)
  - [ ] Admin can access all admin endpoints
  - [ ] Moderator can access content moderation
  - [ ] Regular users cannot access admin features
  - [ ] Role restrictions properly enforced

---

## 📚 Phase 2: Core Content Features (MEDIUM PRIORITY)

### Wiki System

- [ ] **Wiki Categories** (Public API working)

  - [ ] GET `/api/wiki/categories` returns categories
  - [ ] **Manual Test**: Admin category creation/editing/deletion
  - [ ] Category hierarchy (parent/child relationships)
  - [ ] Category sorting and ordering

- [ ] **Wiki Pages** (Authentication required)

  - [ ] Page creation with markdown content
  - [ ] Page editing and revision history
  - [ ] WikiLink processing ([[Page Name]] format)
  - [ ] Template and infobox integration
  - [ ] Page categorization and tagging

- [ ] **Wiki Templates & Infoboxes**
  - [ ] Template creation and field definition
  - [ ] Infobox rendering in pages
  - [ ] Template field validation
  - [ ] Template deletion restrictions (in-use check)

**Test Script:** Manual testing required - automated wiki link testing not yet implemented

### Forums System

- [ ] **Forum Categories**

  - [ ] Category creation and management
  - [ ] Category permissions and visibility
  - [ ] Category sorting and organization

- [ ] **Topics and Replies**

  - [ ] Topic creation in categories
  - [ ] Reply posting and threading
  - [ ] Topic/reply editing and deletion
  - [ ] Soft deletion functionality

- [ ] **Forum Moderation**
  - [ ] Topic locking/unlocking
  - [ ] Content moderation tools
  - [ ] User moderation (warnings, bans)

**Test Scripts:**

- Manual testing required - automated reply tree testing not yet implemented

### User Management

- [ ] **User Profiles**

  - [ ] Profile viewing (`/forums/profile/[id]`)
  - [ ] Profile editing for own account
  - [ ] Avatar upload and management
  - [ ] Bio and personal information

- [ ] **Social Features**
  - [ ] Following/followers system
  - [ ] User messaging
  - [ ] Favorites and bookmarks
  - [ ] Activity feed

---

## 📖 Phase 3: Content Library & Advanced Features

### Library System

- [ ] **Document Management**

  - [ ] Document upload and categorization
  - [ ] Text annotation and highlighting
  - [ ] Version tracking and history
  - [ ] Document search functionality

- [ ] **Library Categories**
  - [ ] Category creation and organization
  - [ ] Document categorization
  - [ ] Category-based filtering

**Test Scripts:** `scripts/check-library-*.js`

### News System

- [ ] **News Articles**
  - [ ] Article creation and publishing
  - [ ] Article editing and updates
  - [ ] Featured image handling
  - [ ] Article categorization and tagging

### Projects System

- [ ] **Project Management**
  - [ ] Project creation and configuration
  - [ ] Project revision tracking
  - [ ] Project collaboration features

---

## 🔧 Phase 4: Technical Infrastructure

### Database Operations

- [ ] **Connection Pool**

  - [ ] Connection pooling prevents resource exhaustion
  - [ ] Prepared statements prevent SQL injection
  - [ ] Transaction handling for multi-table operations

- [ ] **Data Integrity**
  - [ ] Foreign key constraints enforced
  - [ ] Data validation at database level
  - [ ] Backup and recovery procedures

**Test Script:** `scripts/health-check.js`

### Performance & Optimization

- [ ] **Caching**

  - [ ] Query result caching
  - [ ] Static asset caching
  - [ ] CDN integration for media

- [ ] **Bundle Optimization**
  - [ ] Code splitting effectiveness
  - [ ] Tree shaking working correctly
  - [ ] Bundle size analysis

**Command:** `npm run analyze`

### Security Headers & CSP

- [ ] **Content Security Policy**

  - [ ] Nonce generation for inline scripts
  - [ ] CSP violations properly logged
  - [ ] XSS protection effective

- [ ] **Security Headers**
  - [ ] X-Frame-Options set correctly
  - [ ] X-Content-Type-Options enforced
  - [ ] Referrer-Policy configured

---

## 🎨 Phase 5: User Interface & Experience

### Responsive Design

- [ ] **Mobile Compatibility**

  - [ ] All pages render correctly on mobile
  - [ ] Touch-friendly navigation
  - [ ] Mobile-specific interactions

- [ ] **Cross-Browser Testing**
  - [ ] Chrome/Chromium compatibility
  - [ ] Firefox compatibility
  - [ ] Safari compatibility (if available)

### Accessibility

- [ ] **ARIA Labels**
  - [ ] Screen reader compatibility
  - [ ] Keyboard navigation
  - [ ] Color contrast compliance

### Three.js Visualization

- [ ] **Stellar Dodecahedron Viewer**
  - [ ] WebGL initialization
  - [ ] Interactive controls
  - [ ] Performance optimization
  - [ ] Error handling for unsupported browsers

---

## 🛠 Automated Testing Commands

### Core Test Commands

```bash
# Run all Jest tests
npm test

# Run with coverage
npm test -- --coverage

# Type checking
npm run type-check

# Linting
npm run lint

# Comprehensive wiki test
# Manual wiki testing required - automated comprehensive wiki tests not yet implemented
```

### Database Testing Scripts

```bash
# Health check (comprehensive system verification)
node scripts/health-check.js

# Wiki functionality
# Manual wiki link testing required - automated tests not yet implemented

# Forum functionality
# Manual forum reply testing required - automated tests not yet implemented

# Library functionality
node scripts/check-library-documents.js

# Security testing
# Manual security testing required - automated security tests not yet implemented
```

### Performance Testing

```bash
# Bundle analysis
npm run analyze

# Development server performance
npm run dev

# Production build test
npm run build
```

---

## 📋 Manual Testing Workflow

### Priority Order

1. **Authentication Flow** - Login/logout/registration
2. **Admin Panel** - Create wiki category to test CSRF fixes
3. **Wiki System** - Create page, test WikiLinks
4. **Forum System** - Create topic, post replies
5. **User Interface** - Test responsive design
6. **Performance** - Check page load times

### Critical User Journeys

1. **New User**: Register → Verify email → Login → Explore content
2. **Content Creator**: Login → Create wiki page → Add categories → Publish
3. **Community Member**: Browse forums → Join discussions → Follow users
4. **Administrator**: Access admin panel → Manage content → Moderate discussions

---

## 🔍 Issue Reporting Template

When bugs are found, use this format:

```
**Issue Type:** [Security/Functionality/Performance/UI]
**Priority:** [High/Medium/Low]
**Component:** [Wiki/Forums/Auth/Admin/etc.]
**Steps to Reproduce:**
1.
2.
3.

**Expected Result:**
**Actual Result:**
**Browser/Environment:**
**Error Messages:**
```

---

##

Mark items as complete when all sub-items in each phase pass:

- [ ] Phase 1: Critical Security Features (CSRF fixes completed and tested)
- [ ] Phase 2: Core Content Features (Wiki system partially tested)
- [ ] Phase 3: Content Library & Advanced Features
- [ ] Phase 4: Technical Infrastructure
- [ ] Phase 5: User Interface & Experience

**Overall Status:** 🟡 **In Progress** - Critical security fixes completed, core functionality testing in progress

---

_Generated: 2025-09-07 | Last Updated: After CSRF vulnerability fixes_
