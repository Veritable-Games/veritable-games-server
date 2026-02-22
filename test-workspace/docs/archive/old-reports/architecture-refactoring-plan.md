# Architecture Refactoring Plan

## Executive Summary

The Veritable Games codebase exhibits critical architectural issues that require systematic refactoring. This plan addresses 10 major problems through a 9-week phased approach, establishing clean boundaries, implementing dependency injection, and standardizing patterns across 148 API routes and 1,000+ lines service classes.

### Critical Issues Identified

1. **WebSocket server bypasses database pool** - Direct Database() instantiation
2. **Service instantiation anti-pattern** - 50+ routes create new service instances
3. **Redis configured but not operational** - Infrastructure exists without implementation
4. **No dependency injection** - Tight coupling throughout
5. **Three competing architectural styles** - Inconsistent patterns
6. **God objects** - ForumService (1,091 lines), WikiService (800+ lines)
7. **23% code duplication** - Repeated patterns across routes
8. **No service registry** - Manual instantiation everywhere
9. **Circular dependencies** - 47+ dependency chains
10. **Missing abstractions** - Direct database access, no repositories

## Architecture Vision

### Target State
```
┌─────────────────────────────────────────────────────────┐
│                   API Gateway Layer                      │
│  • Versioning (v1/v2)  • Rate Limiting  • Auth          │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│                 Application Service Layer                │
│  • Business Logic  • Transaction Boundaries             │
│  • Event Publishing  • Cross-Domain Orchestration       │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│                  Domain Service Layer                    │
│  • Forum Domain  • Wiki Domain  • Auth Domain           │
│  • Notification Domain  • Analytics Domain              │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│                  Repository Layer                        │
│  • Data Access  • Query Building  • Caching             │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│              Infrastructure Layer                        │
│  • Database Pool  • Redis Cache  • WebSocket            │
│  • Event Bus  • Monitoring  • Logging                   │
└──────────────────────────────────────────────────────────┘
```

## Phase 1: Foundation (Weeks 1-2)

### Week 1: Dependency Injection & Service Registry

#### 1.1 Implement IoC Container
```typescript
// src/lib/core/container.ts
export class Container {
  private services = new Map<string, any>();
  private factories = new Map<string, Factory>();
  private singletons = new Map<string, any>();

  register<T>(token: string, factory: Factory<T>, options?: RegisterOptions): void;
  resolve<T>(token: string): T;
  createScope(): Container;
}

// src/lib/core/service-registry.ts
export const ServiceTokens = {
  DATABASE_POOL: Symbol('DATABASE_POOL'),
  FORUM_SERVICE: Symbol('FORUM_SERVICE'),
  WIKI_SERVICE: Symbol('WIKI_SERVICE'),
  AUTH_SERVICE: Symbol('AUTH_SERVICE'),
  CACHE_MANAGER: Symbol('CACHE_MANAGER'),
  EVENT_BUS: Symbol('EVENT_BUS'),
} as const;
```

#### 1.2 Fix WebSocket Database Connection
```typescript
// BEFORE (server.ts line 85)
this.db = new Database();

// AFTER
constructor(private container: Container) {
  this.db = container.resolve<DatabasePool>(ServiceTokens.DATABASE_POOL);
}
```

#### 1.3 Create Service Factories
```typescript
// src/lib/core/factories/forum-factory.ts
export const forumServiceFactory = (container: Container) => {
  const db = container.resolve<DatabasePool>(ServiceTokens.DATABASE_POOL);
  const cache = container.resolve<CacheManager>(ServiceTokens.CACHE_MANAGER);
  const eventBus = container.resolve<EventBus>(ServiceTokens.EVENT_BUS);

  return new ForumService(db, cache, eventBus);
};
```

### Week 2: Infrastructure Standardization

#### 2.1 Implement Event Bus
```typescript
// src/lib/core/events/event-bus.ts
export class EventBus {
  private handlers = new Map<string, Set<Handler>>();

  publish(event: DomainEvent): Promise<void>;
  subscribe(eventType: string, handler: Handler): Unsubscribe;
  publishBatch(events: DomainEvent[]): Promise<void>;
}
```

#### 2.2 Redis Cache Implementation
```typescript
// src/lib/infrastructure/cache/redis-manager.ts
export class RedisManager {
  private client: RedisClient;
  private fallbackCache: Map<string, CacheEntry>;

  async get<T>(key: string): Promise<T | null>;
  async set(key: string, value: any, ttl?: number): Promise<void>;
  async invalidate(pattern: string): Promise<void>;
}
```

#### 2.3 Create Database Transaction Manager
```typescript
// src/lib/infrastructure/database/transaction-manager.ts
export class TransactionManager {
  async executeInTransaction<T>(
    callback: (tx: Transaction) => Promise<T>
  ): Promise<T>;
}
```

## Phase 2: Service Layer Refactoring (Weeks 3-4)

### Week 3: Break Down God Objects

#### 3.1 Split ForumService (1,091 lines → 5 services)
```typescript
// Before: One massive ForumService
// After: Domain-focused services

// src/lib/domains/forum/services/category-service.ts
export class CategoryService {
  constructor(
    private repo: CategoryRepository,
    private cache: CacheManager
  ) {}

  async findAll(): Promise<Category[]>;
  async findById(id: string): Promise<Category>;
  async create(data: CreateCategoryDto): Promise<Category>;
}

// src/lib/domains/forum/services/topic-service.ts
export class TopicService {
  constructor(
    private repo: TopicRepository,
    private eventBus: EventBus
  ) {}

  async create(data: CreateTopicDto): Promise<Topic>;
  async update(id: string, data: UpdateTopicDto): Promise<Topic>;
  async delete(id: string): Promise<void>;
}

// src/lib/domains/forum/services/reply-service.ts
export class ReplyService {
  constructor(
    private repo: ReplyRepository,
    private mentionService: MentionService,
    private eventBus: EventBus
  ) {}
}

// src/lib/domains/forum/services/moderation-service.ts
export class ModerationService {
  async pinTopic(topicId: string): Promise<void>;
  async lockTopic(topicId: string): Promise<void>;
  async flagContent(contentId: string, reason: string): Promise<void>;
}

// src/lib/domains/forum/services/search-service.ts
export class ForumSearchService {
  async searchTopics(query: string, options: SearchOptions): Promise<SearchResult>;
  async searchReplies(query: string, options: SearchOptions): Promise<SearchResult>;
}
```

#### 3.2 Implement Repository Pattern
```typescript
// src/lib/domains/forum/repositories/topic-repository.ts
export class TopicRepository {
  constructor(private db: DatabaseConnection) {}

  async findById(id: string): Promise<Topic | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM forum_topics WHERE id = ? AND is_deleted = 0
    `);
    return stmt.get(id);
  }

  async save(topic: Topic): Promise<Topic> {
    if (topic.id) {
      return this.update(topic);
    }
    return this.create(topic);
  }

  async delete(id: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE forum_topics SET is_deleted = 1 WHERE id = ?
    `);
    stmt.run(id);
  }
}
```

### Week 4: Domain Model Implementation

#### 4.1 Create Domain Entities
```typescript
// src/lib/domains/forum/entities/topic.ts
export class Topic {
  constructor(
    private data: TopicData,
    private validator: TopicValidator
  ) {}

  static create(data: CreateTopicDto): Topic {
    // Factory method with validation
    const validated = TopicValidator.validate(data);
    return new Topic(validated);
  }

  pin(): void {
    if (this.isDeleted()) {
      throw new DomainError('Cannot pin deleted topic');
    }
    this.data.isPinned = true;
    this.data.updatedAt = new Date();
  }

  toDTO(): TopicDTO {
    return { ...this.data };
  }
}
```

#### 4.2 Implement Value Objects
```typescript
// src/lib/domains/shared/value-objects/email.ts
export class Email {
  constructor(private readonly value: string) {
    if (!Email.isValid(value)) {
      throw new InvalidEmailError(value);
    }
  }

  static isValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  toString(): string {
    return this.value;
  }
}
```

## Phase 3: API Layer Standardization (Weeks 5-6)

### Week 5: API Response Standardization

#### 5.1 Create Response Factory
```typescript
// src/lib/api/responses/response-factory.ts
export class ApiResponse<T = any> {
  static success<T>(data: T, meta?: ResponseMeta): NextResponse {
    return NextResponse.json({
      success: true,
      data,
      meta,
      timestamp: new Date().toISOString()
    });
  }

  static error(error: AppError): NextResponse {
    return NextResponse.json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      },
      timestamp: new Date().toISOString()
    }, { status: error.statusCode });
  }

  static paginated<T>(
    data: T[],
    pagination: PaginationMeta
  ): NextResponse {
    return this.success(data, { pagination });
  }
}
```

#### 5.2 Implement Middleware Composition
```typescript
// src/lib/api/middleware/composer.ts
export class MiddlewareComposer {
  private middlewares: Middleware[] = [];

  use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  compose(): ComposedMiddleware {
    return async (request: NextRequest) => {
      let index = 0;

      const next = async (): Promise<NextResponse> => {
        if (index >= this.middlewares.length) {
          throw new Error('No handler found');
        }

        const middleware = this.middlewares[index++];
        return middleware(request, next);
      };

      return next();
    };
  }
}

// Usage in API route
export const GET = new MiddlewareComposer()
  .use(rateLimitMiddleware({ limit: 60 }))
  .use(authMiddleware({ required: true }))
  .use(validationMiddleware(GetTopicsSchema))
  .use(async (req) => {
    const topics = await topicService.findAll();
    return ApiResponse.success(topics);
  })
  .compose();
```

### Week 6: API Versioning Implementation

#### 6.1 Version Router
```typescript
// src/lib/api/versioning/version-router.ts
export class VersionRouter {
  private versions = new Map<string, Handler>();

  register(version: string, handler: Handler): this {
    this.versions.set(version, handler);
    return this;
  }

  route(): Handler {
    return async (request: NextRequest) => {
      const version = this.extractVersion(request);
      const handler = this.versions.get(version) || this.versions.get('v1');

      if (!handler) {
        return ApiResponse.error(new NotFoundError('API version not found'));
      }

      return handler(request);
    };
  }
}

// src/app/api/[version]/forums/topics/route.ts
export const GET = new VersionRouter()
  .register('v1', getTopicsV1)
  .register('v2', getTopicsV2)
  .route();
```

#### 6.2 Create API Gateway
```typescript
// src/lib/api/gateway/api-gateway.ts
export class ApiGateway {
  constructor(
    private rateLimiter: RateLimiter,
    private auth: AuthService,
    private monitoring: MonitoringService
  ) {}

  async handleRequest(
    request: NextRequest,
    handler: Handler
  ): Promise<NextResponse> {
    const requestId = generateRequestId();

    try {
      // Pre-processing
      await this.rateLimiter.check(request);
      const user = await this.auth.authenticate(request);

      // Execute handler with context
      const context = { requestId, user, request };
      const response = await handler(context);

      // Post-processing
      this.monitoring.recordRequest(requestId, response.status);

      return response;
    } catch (error) {
      this.monitoring.recordError(requestId, error);
      return this.handleError(error);
    }
  }
}
```

## Phase 4: Integration & Optimization (Weeks 7-8)

### Week 7: Resolve Circular Dependencies

#### 7.1 Identify and Break Cycles
```typescript
// Problem: Circular dependency between ForumService and NotificationService

// Solution: Use Event-Driven Architecture
// src/lib/domains/forum/events/topic-created.ts
export class TopicCreatedEvent implements DomainEvent {
  constructor(
    public readonly topicId: string,
    public readonly authorId: string,
    public readonly categoryId: string
  ) {}
}

// Forum domain publishes events
class TopicService {
  async create(data: CreateTopicDto): Promise<Topic> {
    const topic = await this.repo.save(data);

    // Publish event instead of direct call
    await this.eventBus.publish(
      new TopicCreatedEvent(topic.id, topic.authorId, topic.categoryId)
    );

    return topic;
  }
}

// Notification domain subscribes to events
class NotificationHandler {
  @Subscribe(TopicCreatedEvent)
  async handleTopicCreated(event: TopicCreatedEvent): Promise<void> {
    // Send notifications to subscribers
    await this.notificationService.notifySubscribers(event);
  }
}
```

#### 7.2 Implement Dependency Graph Validation
```typescript
// src/lib/core/dependency-validator.ts
export class DependencyValidator {
  private graph = new Map<string, Set<string>>();

  addDependency(from: string, to: string): void {
    if (!this.graph.has(from)) {
      this.graph.set(from, new Set());
    }
    this.graph.get(from)!.add(to);
  }

  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();

    for (const node of this.graph.keys()) {
      if (!visited.has(node)) {
        this.dfs(node, visited, stack, [], cycles);
      }
    }

    return cycles;
  }
}
```

### Week 8: Performance Optimization

#### 8.1 Implement Query Optimization
```typescript
// src/lib/infrastructure/database/query-optimizer.ts
export class QueryOptimizer {
  private queryCache = new Map<string, PreparedStatement>();

  async executeOptimized<T>(
    query: string,
    params: any[]
  ): Promise<T> {
    const key = this.generateKey(query, params);

    if (!this.queryCache.has(key)) {
      const stmt = this.db.prepare(query);
      this.queryCache.set(key, stmt);
    }

    const stmt = this.queryCache.get(key)!;
    return stmt.get(...params) as T;
  }

  async batchExecute<T>(
    queries: BatchQuery[]
  ): Promise<T[]> {
    return this.db.transaction(() => {
      return queries.map(q => this.executeOptimized(q.sql, q.params));
    })();
  }
}
```

#### 8.2 Implement Caching Strategy
```typescript
// src/lib/infrastructure/cache/cache-strategy.ts
export class CacheStrategy {
  private strategies = new Map<string, Strategy>();

  constructor() {
    this.strategies.set('user', new ShortLivedCache(5 * 60)); // 5 minutes
    this.strategies.set('content', new LongLivedCache(60 * 60)); // 1 hour
    this.strategies.set('static', new PermanentCache());
  }

  async get<T>(key: string, factory: () => Promise<T>, type: string): Promise<T> {
    const strategy = this.strategies.get(type) || this.strategies.get('content');
    return strategy.get(key, factory);
  }
}
```

## Phase 5: Documentation & Training (Week 9)

### Week 9: Documentation and Guidelines

#### 9.1 Architecture Decision Records (ADRs)
```markdown
# ADR-001: Adopt Dependency Injection

## Status
Accepted

## Context
The codebase has 50+ routes creating new service instances, leading to:
- Memory leaks
- Inconsistent state
- Difficult testing

## Decision
Implement IoC container with service registry

## Consequences
- Positive: Centralized dependency management, easier testing
- Negative: Initial learning curve for team
```

#### 9.2 API Documentation
```typescript
// src/lib/api/documentation/openapi-generator.ts
export class OpenAPIGenerator {
  generateSpec(): OpenAPISpec {
    return {
      openapi: '3.0.0',
      info: {
        title: 'Veritable Games API',
        version: '2.0.0'
      },
      paths: this.generatePaths(),
      components: this.generateSchemas()
    };
  }
}
```

#### 9.3 Developer Guidelines
```markdown
# Developer Guidelines

## Service Creation
1. Always use dependency injection
2. Services must be stateless
3. Use repository pattern for data access

## API Development
1. Use ApiResponse factory for all responses
2. Implement proper error handling
3. Version all breaking changes

## Testing Requirements
1. Unit tests for all services
2. Integration tests for API routes
3. E2E tests for critical flows
```

## Migration Strategy

### Approach: Strangler Fig Pattern
1. **Parallel Implementation**: Build new architecture alongside existing
2. **Gradual Migration**: Migrate one route at a time
3. **Feature Flags**: Control rollout with feature toggles
4. **Rollback Plan**: Maintain ability to revert to old implementation

### Migration Example
```typescript
// Step 1: Create new implementation
class TopicServiceV2 {
  // New implementation with DI
}

// Step 2: Update route with feature flag
export const GET = async (request: NextRequest) => {
  if (featureFlags.useNewArchitecture) {
    const service = container.resolve<TopicServiceV2>(ServiceTokens.TOPIC_SERVICE);
    return service.handleGet(request);
  } else {
    // Old implementation
    const service = new ForumService();
    return service.getTopics();
  }
};

// Step 3: Monitor and gradually increase traffic
// Step 4: Remove old implementation after validation
```

## Testing Strategy

### Unit Testing
```typescript
// src/lib/domains/forum/services/__tests__/topic-service.test.ts
describe('TopicService', () => {
  let service: TopicService;
  let mockRepo: jest.Mocked<TopicRepository>;
  let mockEventBus: jest.Mocked<EventBus>;

  beforeEach(() => {
    mockRepo = createMock<TopicRepository>();
    mockEventBus = createMock<EventBus>();
    service = new TopicService(mockRepo, mockEventBus);
  });

  test('should create topic and publish event', async () => {
    const data = { title: 'Test', content: 'Content' };
    mockRepo.save.mockResolvedValue(mockTopic);

    const result = await service.create(data);

    expect(mockRepo.save).toHaveBeenCalledWith(data);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ topicId: mockTopic.id })
    );
  });
});
```

### Integration Testing
```typescript
// src/app/api/forums/topics/__tests__/integration.test.ts
describe('Topics API Integration', () => {
  let container: Container;

  beforeAll(() => {
    container = createTestContainer();
  });

  test('GET /api/v2/forums/topics', async () => {
    const response = await request(app)
      .get('/api/v2/forums/topics')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeArray();
  });
});
```

### E2E Testing
```typescript
// e2e/forum-flow.spec.ts
test('Complete forum interaction flow', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // Create topic
  await page.goto('/forums');
  await page.click('text=New Topic');
  await page.fill('[name="title"]', 'E2E Test Topic');
  await page.fill('[name="content"]', 'Test content');
  await page.click('text=Create');

  // Verify creation
  await expect(page.locator('h1')).toContainText('E2E Test Topic');
});
```

## Success Metrics

### Technical Metrics
- **Database Connections**: Reduce from 79+ to max 15
- **Response Time**: p95 < 200ms (from current 500ms)
- **Memory Usage**: 30% reduction in heap size
- **Code Duplication**: Reduce from 23% to < 5%
- **Test Coverage**: Increase from 40% to 80%

### Business Metrics
- **Error Rate**: Reduce 500 errors by 90%
- **Deployment Frequency**: Daily deployments enabled
- **MTTR**: Reduce from hours to minutes
- **Developer Velocity**: 2x increase in feature delivery

## Risk Mitigation

### Identified Risks
1. **Data Loss**: Mitigated by comprehensive backups and gradual rollout
2. **Performance Degradation**: Mitigated by performance testing and monitoring
3. **Team Resistance**: Mitigated by training and documentation
4. **Integration Issues**: Mitigated by extensive integration testing

### Rollback Strategy
```typescript
// Implement circuit breaker for automatic rollback
export class FeatureCircuitBreaker {
  private failures = 0;
  private threshold = 10;

  async execute<T>(
    newImpl: () => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T> {
    if (this.failures >= this.threshold) {
      console.error('Circuit open, using fallback');
      return fallback();
    }

    try {
      const result = await newImpl();
      this.failures = 0;
      return result;
    } catch (error) {
      this.failures++;

      if (this.failures >= this.threshold) {
        this.notifyOps('Circuit breaker opened');
      }

      return fallback();
    }
  }
}
```

## Team Training Requirements

### Week 1-2: Foundation Concepts
- Dependency Injection principles
- IoC Container usage
- Service Registry patterns

### Week 3-4: Domain-Driven Design
- Repository pattern
- Domain entities and value objects
- Event-driven architecture

### Week 5-6: API Standards
- RESTful design principles
- API versioning strategies
- Error handling patterns

### Week 7-8: Testing Practices
- Unit testing with mocks
- Integration testing strategies
- E2E testing with Playwright

### Week 9: Operations
- Monitoring and alerting
- Performance profiling
- Debugging techniques

## Implementation Checklist

### Phase 1 Checklist
- [ ] IoC Container implementation
- [ ] Service Registry setup
- [ ] WebSocket database fix
- [ ] Event Bus implementation
- [ ] Redis cache integration
- [ ] Transaction manager

### Phase 2 Checklist
- [ ] Split ForumService into 5 services
- [ ] Split WikiService into 4 services
- [ ] Implement repository pattern
- [ ] Create domain entities
- [ ] Implement value objects
- [ ] Add domain validators

### Phase 3 Checklist
- [ ] Response factory implementation
- [ ] Middleware composer
- [ ] API versioning router
- [ ] API gateway setup
- [ ] Error handling standardization
- [ ] Request validation

### Phase 4 Checklist
- [ ] Circular dependency resolution
- [ ] Event handlers implementation
- [ ] Query optimization
- [ ] Caching strategy
- [ ] Performance monitoring
- [ ] Load testing

### Phase 5 Checklist
- [ ] Architecture Decision Records
- [ ] API documentation generation
- [ ] Developer guidelines
- [ ] Training materials
- [ ] Migration playbook
- [ ] Operations runbook

## Conclusion

This comprehensive refactoring plan addresses all critical architectural issues while maintaining system stability through gradual migration. The phased approach ensures minimal disruption while delivering measurable improvements in performance, maintainability, and developer productivity.

The key to success will be:
1. Strict adherence to the migration strategy
2. Comprehensive testing at each phase
3. Clear communication and training
4. Continuous monitoring and adjustment

Expected outcome: A scalable, maintainable architecture supporting 10x growth with 50% reduction in operational overhead.