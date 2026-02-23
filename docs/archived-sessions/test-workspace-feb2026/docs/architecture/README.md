# Architecture Documentation

This directory contains the core architectural documentation for the Veritable Games platform.

## 📋 Current Architecture Documents

### System Overview
- **[SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)** - Overall system design and components
- **[FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md)** - React 19 frontend architecture
- **[DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md)** - Multi-database SQLite architecture

### Security & Performance
- **[SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md)** - Security layers and authentication
- **[BUILD_AND_DEVOPS.md](BUILD_AND_DEVOPS.md)** - Build system and deployment pipeline

### Feature-Specific
- **[WIKI_SYSTEM_ARCHITECTURE.md](WIKI_SYSTEM_ARCHITECTURE.md)** - Wiki system design
- **[ADVANCED_FTS5_SEARCH_IMPLEMENTATION.md](ADVANCED_FTS5_SEARCH_IMPLEMENTATION.md)** - Full-text search system
- **[COLLABORATIVE_PROJECT_API_ARCHITECTURE.md](COLLABORATIVE_PROJECT_API_ARCHITECTURE.md)** - Collaborative features

### Implementation Guides
- **[COLLABORATIVE_API_IMPLEMENTATION_GUIDE.md](COLLABORATIVE_API_IMPLEMENTATION_GUIDE.md)** - API implementation patterns
- **[ENHANCED_STATE_MANAGEMENT_DEMO.md](ENHANCED_STATE_MANAGEMENT_DEMO.md)** - State management patterns

### Legacy Migration
- **[CATEGORY_MIGRATION_STRATEGY.md](CATEGORY_MIGRATION_STRATEGY.md)** - Category system migration
- **[REVISION_BACKEND_IMPROVEMENTS.md](REVISION_BACKEND_IMPROVEMENTS.md)** - Backend optimization history

## 🏗️ Architecture Principles

The Veritable Games platform follows these core architectural principles:

1. **Microservice Patterns**: Modular service architecture with clear separation of concerns
2. **Multi-Database**: Separated databases for different domains (forums, wiki, library, auth)
3. **Security-First**: 4-tier security with CSRF, CSP, rate limiting, and sanitization
4. **Performance Optimized**: Connection pooling, caching, and query optimization
5. **TypeScript**: Full type safety across frontend and backend
6. **Modern React**: React 19 with server components and concurrent features

## 🚀 Quick Navigation

- **New to the platform?** Start with [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)
- **Frontend development?** See [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md)
- **Database work?** Check [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md)
- **Security concerns?** Review [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md)

## 📝 Documentation Standards

All architecture documents follow these standards:
- Current implementation status (not future plans)
- Practical examples and code snippets
- Security considerations for each component
- Performance implications and optimizations
- Dependencies and integration points

## 🔄 Last Updated
September 2025 - Post 4-wave recovery architecture documentation