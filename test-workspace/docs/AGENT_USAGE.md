# Claude Code Agents: When to Use Them

Claude Code supports specialized agents for different types of work. Use this guide to invoke the right agent for faster, more efficient assistance.

---

## Available Agents in This Codebase

### 1. **Explore Agent** (Codebase Navigation)
**Best for**: Understanding architecture, finding files, learning how things work

**When to use**:
- "How does the forum system work?"
- "Where are all the API endpoints for wiki?"
- "What components render on the forums page?"
- "How is database caching implemented?"
- "Find all services that use the forums database"

**Why it's better than manual search**:
- Quickly builds mental model of interconnected code
- Finds patterns across multiple files
- Understands relationships between components

**How to invoke**:
```
User: "I need to understand the forum architecture"
Assistant: I'll use the Explore agent to map out the forum system components and architecture.
```

**Thoroughness levels**:
- `quick`: Basic file searches (fast, good for simple questions)
- `medium`: Cross-file patterns (default, balanced)
- `very thorough`: Deep analysis across entire subsystem (slow, best for complex architecture)

---

### 2. **Typescript-Architecture-Expert** (Type Safety & Design)
**Best for**: Type design, branded types, architectural improvements

**When to use**:
- "How should I structure this TypeScript module?"
- "Create a branded type for UserId"
- "Design a type-safe API routing system"
- "Review these types for safety issues"
- "How do I implement domain-driven design patterns?"
- "Migrate this code from JavaScript to TypeScript"

**Why it's better than manual typing**:
- Ensures compile-time safety
- Prevents runtime type errors
- Applies proven patterns (branded types, discriminated unions, etc.)

**Example scenarios**:
- Creating new API endpoint types
- Designing service interfaces
- Implementing Result pattern for error handling
- Building type-safe form validation

---

### 3. **React-Architecture-Specialist** (Component Design & Performance)
**Best for**: React components, hooks, optimization, React 19 patterns

**When to use**:
- "Create a complex form component with validation"
- "Optimize this component's rendering performance"
- "Design a component hierarchy for the dashboard"
- "How do I implement useOptimistic correctly?"
- "Review this component for performance issues"
- "Help me implement Server Components properly"
- "Design a state management solution"

**Why it's better than manual implementation**:
- Ensures React 19 + Next.js 15 best practices
- Prevents hydration errors
- Optimizes performance from the start
- Proper use of Server vs Client Components

**Example scenarios**:
- Building the new feature UI
- Refactoring components for performance
- Implementing optimistic UI updates
- Complex state management design

---

### 4. **Security-Auth-Specialist** (Auth & Security)
**Best for**: Authentication, authorization, security architecture

**When to use**:
- "Implement a new authentication method"
- "Review this code for security issues"
- "How do I implement WebAuthn/passkeys?"
- "Design a secure API endpoint"
- "Audit our CORS/CSRF implementation"
- "How do I ensure GDPR compliance?"
- "Help with password hashing strategy"

**Why it's better than manual implementation**:
- Implements modern security patterns
- Catches common vulnerabilities
- Ensures compliance with standards (OWASP, GDPR, etc.)

**Example scenarios**:
- Adding OAuth or email verification
- Implementing rate limiting correctly
- Securing API routes
- Password reset flows

---

### 5. **Performance-Optimizer** (Speed & Bundle Size)
**Best for**: Performance issues, bundle size, Core Web Vitals

**When to use**:
- "Our LCP score is too high, how do we fix it?"
- "The bundle size is 2MB, help us reduce it"
- "Image optimization not working"
- "Analyze and improve performance"
- "Help with code splitting strategy"
- "Database queries are slow"

**Why it's better than manual optimization**:
- Identifies actual bottlenecks (not guesses)
- Provides data-driven recommendations
- Implements modern optimization techniques

**Example scenarios**:
- Slow page load times
- Large bundle size
- Images loading slowly
- API responses taking too long

---

### 6. **Accessibility-Compliance-Auditor** (A11y & Compliance)
**Best for**: Web accessibility, WCAG compliance, inclusive design

**When to use**:
- "Review this component for accessibility issues"
- "Make this dropdown accessible"
- "Ensure WCAG 2.1 AA compliance"
- "Add ARIA labels properly"
- "Fix keyboard navigation"
- "Make this modal accessible"

**Why it's better than manual review**:
- Catches subtle a11y issues
- Implements proper ARIA patterns
- Ensures WCAG compliance
- Improves UX for all users

**Example scenarios**:
- Adding a new interactive component
- Making forms accessible
- Ensuring screen reader support
- Testing keyboard navigation

---

### 7. **DevOps-Build-Optimizer** (Build & CI/CD)
**Best for**: Build systems, deployments, CI/CD pipelines

**When to use**:
- "Our builds are taking too long"
- "Help me set up GitHub Actions"
- "Improve our Turbopack configuration"
- "Optimize Docker builds"
- "Design a deployment strategy"
- "Fix build errors in CI"

**Why it's better than manual setup**:
- Optimizes build performance
- Implements best practices
- Sets up proper deployment workflows

**Example scenarios**:
- Slow development builds
- CI/CD pipeline issues
- Deployment failures
- Production build optimization

---

## When to Use vs. Ask Directly

| Task | Method | Reason |
|------|--------|--------|
| "What database does wiki use?" | Direct | Simple fact lookup |
| "How does the forum system architecture work?" | Explore agent | Cross-file pattern analysis |
| "Design a type-safe API client" | TypeScript agent | Architectural expertise |
| "Make this form component" | React agent | Component best practices |
| "Find a security bug" | Security agent | Vulnerability expertise |
| "Bundle size is huge" | Performance agent | Bottleneck analysis |
| "Make modal accessible" | Accessibility agent | A11y patterns |
| "Builds are slow" | DevOps agent | Build expertise |

---

## How to Request an Agent

### Option A: Explicit Request
```
User: "I need to understand how the wiki system works"
Assistant: I'll use the Explore agent to map out the wiki architecture and show you how all the components connect.
```

### Option B: Implicit Recognition
If you describe a problem that matches an agent's expertise, the assistant should proactively suggest using that agent:

```
User: "The page is loading slowly"
Assistant: This sounds like a performance issue. Let me use the performance-optimizer agent to analyze your application and identify bottlenecks.
```

### Option C: Collaborative Approach
Sometimes multiple agents work together:

```
User: "I need to add a new feature with authentication, good performance, and WCAG compliance"
Assistant: I'll break this into:
1. Security-auth-specialist: Design the authentication flow
2. React-architecture-specialist: Build performant components
3. Accessibility-compliance-auditor: Ensure WCAG AA compliance
```

---

## Agent Invocation Syntax

From the system prompt, agents are invoked with the Task tool:

```typescript
// In the assistant's thinking, not visible to user:
{
  "subagent_type": "explore",
  "description": "Map wiki system architecture",
  "prompt": "Detailed task for the agent..."
}
```

---

## Tips for Agent Usage

### 1. **Be Specific**
```
❌ "Look at the code"
✅ "Map out all services in the forum system and how they interact"
```

### 2. **Provide Context**
```
❌ "This component is slow"
✅ "The TopicList component shows 100+ topics and re-renders on every keystroke"
```

### 3. **Ask for What You Need**
```
❌ "Fix this"
✅ "Identify performance bottlenecks and suggest optimizations with code examples"
```

### 4. **Chain Agent Calls**
```
❌ Use one agent for everything
✅ Use Explore to understand, then TypeScript agent to design, then React agent to implement
```

---

## Agents in This Codebase

This repo has special setup for agent usage. See:
- `.claude/agents/` - Agent configuration files
- Each agent file explains its specific expertise

---

## Quick Reference Cheat Sheet

| Need | Agent | Time |
|------|-------|------|
| Understand architecture | Explore | 2-5 min |
| Design types/interfaces | TypeScript | 3-10 min |
| Build components | React | 5-15 min |
| Security/auth | Security | 5-10 min |
| Performance issues | Performance | 5-10 min |
| A11y/WCAG | Accessibility | 3-8 min |
| Build/deploy | DevOps | 3-10 min |

---

## When NOT to Use Agents

- Simple fact lookups (just ask directly)
- Quick questions about syntax (direct is faster)
- Copy-paste code snippets (direct is faster)
- Urgent fixes (might be overkill, assess first)

---

## Examples from This Codebase

### Example 1: Understanding Forums
```
User: "I need to understand how the forum system works"
Assistant: I'll use the Explore agent with "very thorough" mode to map out:
- All forum services (6 total)
- API endpoints (17 routes)
- Components (20+ files)
- Database schema (4 tables + FTS5)
- How they connect
```

### Example 2: Adding Optimistic UI
```
User: "Add optimistic UI for forum moderation"
Assistant: I'll use the React-architecture-specialist agent to:
- Design useOptimistic hook implementation
- Show useForumEvents integration
- Build OptimisticModerationDropdown component
- Ensure proper rollback on error
```

### Example 3: Performance Investigation
```
User: "Forum search is slow (taking 5 seconds)"
Assistant: I'll use the performance-optimizer agent to:
- Profile the search query
- Analyze database indexes
- Check cache hit rates
- Suggest optimizations
```

---

## See Also

- **CLAUDE.md**: Main architecture guide
- **docs/**: Detailed system documentation
- **.claude/agents/**: Individual agent descriptions
