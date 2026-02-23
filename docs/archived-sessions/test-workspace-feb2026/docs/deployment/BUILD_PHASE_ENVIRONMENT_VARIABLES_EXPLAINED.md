# Understanding Build-Phase Environment Variables

**Purpose**: Deep dive into why Docker builds fail when environment variables are missing
**Audience**: Developers understanding deployment architecture
**Level**: Intermediate to Advanced

---

## The Core Problem: Three Different Environment Contexts

When deploying an application through Docker, there are **three distinct execution contexts**, each with different environment variable availability:

```
Context 1: Development Machine
├─ npm run dev or npm run build
├─ All environment variables from .env.local available
├─ Can access local database
└─ Everything works ✓

Context 2: Docker Build Process
├─ docker build -f Dockerfile ...
├─ ONLY --build-arg variables available
├─ CANNOT access local database
├─ Container filesystem not yet created
└─ Many env vars are undefined ❌

Context 3: Running Container
├─ docker run -e DATABASE_URL=... veritable-games:latest
├─ ALL environment variables from docker run -e available
├─ Can access remote database
└─ Everything works ✓
```

### Example Timeline

```
Development Laptop (Context 1)
  ✓ npm run dev
  ✓ Uses .env.local with DATABASE_URL
  ✓ TypeScript compiles
  ✓ Application runs

            git push origin main
                    ↓
GitHub Repository (webhook triggered)

            Coolify Server (Context 2 & 3)

Context 2: Docker Build
  ❌ DATABASE_URL undefined
  ❌ npm run build fails if code needs database
  ❌ Container never created

Context 3: Docker Run (if build succeeded)
  ✓ DATABASE_URL injected
  ✓ Application starts
  ✓ Database operations work
```

---

## Why Docker Builds Fail Without Environment Variables

### The Architectural Problem

**Docker builds are isolated from the host environment**. This is intentional for security and reproducibility:

```dockerfile
# This does NOT work:
FROM node:20-alpine
RUN npm install
RUN npm run build
# ERROR: build process can't see DATABASE_URL from host machine
```

**Why isolation is necessary**:
1. **Security**: Container shouldn't have access to host secrets
2. **Reproducibility**: Same Dockerfile should produce same image everywhere
3. **Portability**: Build shouldn't depend on host environment variables

### The Solution: Build Arguments

To pass values into a Docker build, use `ARG`:

```dockerfile
# This works:
ARG DATABASE_URL=fallback_value
ENV DATABASE_URL=${DATABASE_URL}
RUN npm run build
```

Called with:
```bash
docker build --build-arg DATABASE_URL=postgresql://... -t myapp .
```

### The Integration Problem: Coolify Doesn't Know About Build-Time Needs

```
What Coolify Does:
1. Reads environment_variables from database
2. Creates docker run command with -e flags
3. BUT does NOT create docker build command with --build-arg flags

Result:
- Runtime variables ✓ (injected via -e)
- Build variables ❌ (not passed via --build-arg)
```

---

## When Build-Time Variables Are Needed

### Scenario 1: Next.js Static Data Collection (Our Case)

```typescript
// File: src/app/api/documents/unified/route.ts

// This code runs at BUILD TIME
export async function GET() {
  // Needs database access during build to pre-generate responses
  const documents = await dbAdapter.query('SELECT * FROM documents');
  return Response.json(documents);
}

// Result: Next.js calls this at build time to generate static data
// Requires: DATABASE_URL to be available during docker build
```

### Scenario 2: Environment-Dependent Type Generation

```typescript
// This TypeScript file is evaluated at BUILD TIME
export const config = getConfigFromDatabase();

// Result: TypeScript compiler needs config values during build
// Requires: DATABASE_URL to connect and retrieve config
```

### Scenario 3: Build-Time Constants

```typescript
// In next.config.ts
const API_ENDPOINTS = await fetchEndpointsFromDatabase();

export default {
  publicRuntimeConfig: {
    apiEndpoints: API_ENDPOINTS,  // Set at build time
  }
};

// Result: Config is baked into the application during build
// Requires: DATABASE_URL during docker build
```

### Scenario 4: Static Asset Generation

```typescript
// In src/app/page.tsx
export const generateStaticParams = async () => {
  // This function runs at BUILD TIME
  const posts = await db.query('SELECT * FROM blog_posts');
  return posts.map(post => ({ slug: post.slug }));
};

export default function Page({ params }) {
  // This function runs at RUNTIME
  return <div>{params.slug}</div>;
}

// Result: generateStaticParams needs database during build
// Requires: DATABASE_URL during docker build
```

---

## Our Specific Case: Why Veritable Games Failed

### The Application's Architecture

```
next.config.ts
  ↓
Imports: import { dbAdapter } from '@/lib/database/adapter'
  ↓
next.config.ts loaded → adapter.ts loaded
  ↓
DatabaseAdapter constructor executes
  ↓
Checks: if (!POSTGRES_URL && !DATABASE_URL) throw error
  ↓
Result: Fatal error during build (before build even starts!)
```

### The Stack Trace

```
> npm run build
> next build

Initializing Next.js...
Loading next.config.ts...

Error: 🚨 FATAL: PostgreSQL connection not configured.
Set POSTGRES_URL or DATABASE_URL environment variable.
SQLite is no longer supported in this codebase.

at DatabaseAdapter.constructor (adapter.ts:75)
at Object.<anonymous> (next.config.ts:1)
at ModuleManager.require (webpack.js:1)

Build failed
```

### Why The Error Happened

1. **next.config.ts exists** - required by Next.js to configure the app
2. **next.config.ts imports the adapter** - to set up database access
3. **DatabaseAdapter constructor runs immediately** - when the file is imported
4. **Constructor validates database configuration** - throws if not found
5. **Docker build has no DATABASE_URL** - Coolify doesn't pass --build-arg
6. **Build fails before npm run build even starts** - during Next.js initialization

---

## The Solution Explained

### How the Fix Works

**Original Code**:
```typescript
if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
  throw error;  // Always throws during build
}
```

**Fixed Code**:
```typescript
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

if (!isBuildPhase && !process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
  throw error;  // Only throws at runtime
}
```

### Why This Works

**Build Phase**:
```
docker build ...
  ↓
npm run build
  ↓
Next.js initialization
  ↓
next.config.ts loaded
  ↓
DatabaseAdapter constructor
  ↓
Checks: NEXT_PHASE === 'phase-production-build'? YES ✓
  ↓
Skips validation
  ↓
Build continues ✓
```

**Runtime Phase**:
```
docker run -e NODE_ENV=production ...
  ↓
node server.js
  ↓
Application initialization
  ↓
DatabaseAdapter constructor
  ↓
Checks: NEXT_PHASE === 'phase-production-build'? NO
       NODE_ENV === 'development'? NO
  ↓
Validates: Do we have DATABASE_URL? → MUST be yes
  ↓
If no: throw error (correct behavior)
If yes: connect to PostgreSQL ✓
```

### Key Insight: NEXT_PHASE is Set by Next.js

Next.js automatically sets this during builds:

```javascript
// Next.js internals
if (process.env.NODE_ENV === 'production') {
  process.env.NEXT_PHASE = 'phase-production-build';
  // ... run build ...
  process.env.NEXT_PHASE = 'phase-production-server';
  // ... run server ...
}
```

So we can reliably detect: "Are we currently in a build?" by checking this variable.

---

## Comparison with Other Approaches

### Approach 1: Skip Database Validation Entirely

❌ Bad:
```typescript
// Never check for database configuration
if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
  // Silent fail - application might work without database
  return;
}
```

**Problem**: Production application runs without database and user doesn't know why

---

### Approach 2: Use Dummy Fallback Value

❌ Not Great:
```typescript
const dbUrl = process.env.POSTGRES_URL || 'postgresql://dummy:dummy@localhost:5432/dummy';

// Build might succeed with dummy value
// Application might try to use dummy value at runtime
```

**Problem**: Doesn't distinguish between build and runtime contexts

---

### Approach 3: Defer to Service Instantiation

⚠️ Okay:
```typescript
// Check database only when actually needed
export class UserService {
  async getUsers() {
    if (!process.env.DATABASE_URL) throw error;
    // ... use database ...
  }
}
```

**Problem**: Multiple error checks scattered throughout code, harder to test

---

### Approach 4: Detect Build Phase (Our Solution)

✅ Best:
```typescript
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

if (!isBuildPhase && !process.env.POSTGRES_URL) {
  throw error;  // Enforced at runtime, skipped at build time
}
```

**Advantages**:
- Single check location
- Clear intent
- Fails fast at runtime if database not configured
- Build succeeds even without database
- No performance impact

---

## The Coolify Limitation

### How Coolify Handles Environment Variables

```
Coolify Database (PostgreSQL)
├── Table: environment_variables
│   ├── id
│   ├── key
│   ├── value
│   ├── is_buildtime BOOLEAN
│   └── is_runtime BOOLEAN
│
└── When deploying:
    ├── Reads application environment_variables
    ├── For runtime vars: docker run -e KEY=VALUE ...
    ├── For build vars: ??? (not implemented!)
    └── Result: Build vars not passed to docker build
```

### What Coolify SHOULD Do (But Doesn't)

```bash
# Current behavior (build vars ignored):
docker build -f Dockerfile ...
  # Note: No --build-arg flags

# Better behavior (if implemented):
docker build \
  --build-arg DATABASE_URL=postgresql://... \
  --build-arg SESSION_SECRET=... \
  -f Dockerfile ...
```

### Why This Limitation Exists

1. **Complexity**: Not all build systems need build-time variables
2. **Security**: Passing secrets as build-args makes them visible in Docker history
3. **Priority**: Most Node.js apps don't need database at build time
4. **Architecture**: Coolify focuses on simplicity, not edge cases

---

## Prevention: How to Design Applications

### Pattern 1: Avoid Database Access at Build Time

```typescript
// ❌ BAD - Database access at build time
export async function generateConfig() {
  const dbUrl = process.env.DATABASE_URL;
  const connection = await pg.connect(dbUrl);
  const config = await connection.query('SELECT * FROM config');
  return config;
}

export default { config: await generateConfig() };

// ✓ GOOD - Database access at request time
export default {
  apiUrl: process.env.NEXT_PUBLIC_API_URL,  // Set at build time
  // config loaded dynamically at runtime
};
```

### Pattern 2: Use Environment Variables for Non-Database Config

```typescript
// ✓ GOOD - No database needed for these
export const config = {
  apiVersion: process.env.NEXT_PUBLIC_API_VERSION || 'v1',
  siteName: process.env.NEXT_PUBLIC_SITE_NAME || 'Veritable Games',
  analyticsId: process.env.NEXT_PUBLIC_ANALYTICS_ID || '',
};

// Database queries happen at request time, not build time
```

### Pattern 3: Conditional Initialization

```typescript
// ✓ GOOD - Adapter only validates when needed
class DatabaseAdapter {
  private initialized = false;

  private ensureInitialized() {
    if (this.initialized) return;

    if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
      throw error;
    }

    this.initialized = true;
  }

  async query(sql: string) {
    this.ensureInitialized();  // Check only at query time
    // ... execute query ...
  }
}
```

---

## Key Takeaways

### 1. Build Phase Environment Is Isolated
- Docker builds don't have access to host environment variables
- Only --build-arg values are available during build
- This is by design for security and reproducibility

### 2. Different Phases Need Different Strategies
- **Build Phase**: Use fallback values or skip expensive operations
- **Runtime Phase**: Enforce required configuration
- Don't confuse the two contexts

### 3. NEXT_PHASE Variable Is Your Friend
- Available in Next.js 15+
- Tells you: "Are we currently building or running?"
- Perfect for conditional initialization

### 4. Coolify Has Limitations
- Build variables aren't automatically passed
- This is acceptable for most applications
- Our fix works around this limitation

### 5. Design for Deployment
- Minimize database access at build time
- Use environment variables for configuration
- Validate configuration at runtime, not build time
- Test builds locally before deploying

---

## References

- **Next.js Build Process**: https://nextjs.org/docs/app/building-your-application-building/deploying
- **Docker Build Arguments**: https://docs.docker.com/engine/reference/builder/#arg
- **Environment Variables in Node.js**: https://nodejs.org/docs/latest/api/process.html#process_process_env
- **Coolify Documentation**: https://coolify.io/docs
- **PostgreSQL Connection Strings**: https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING

---

**Document Created**: November 9, 2025
**Purpose**: Educational reference for understanding build-phase environment challenges
**Audience**: Developers maintaining Veritable Games or similar Next.js deployments
