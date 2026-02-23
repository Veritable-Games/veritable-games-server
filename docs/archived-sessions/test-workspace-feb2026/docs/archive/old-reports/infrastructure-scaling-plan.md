# Infrastructure Scaling Plan: 50 to 5,000+ Concurrent Users

## Executive Summary

This plan outlines a 4-month transformation from a single-server SQLite application to a cloud-native, highly available platform capable of supporting 5,000+ concurrent users with 99.95% uptime SLA and sub-100ms global latency.

**Current State Analysis:**
- Single SQLite database with file-based storage
- No horizontal scaling capability
- Redis integration coded but not deployed
- No monitoring or observability
- Single point of failure architecture
- Manual deployment processes

**Target Architecture:**
- Multi-region Kubernetes clusters
- PostgreSQL with read replicas
- Redis cluster for caching/sessions
- CDN for global content delivery
- Comprehensive monitoring stack
- Automated CI/CD pipeline

## Month 1: Foundation & Standardization

### Week 1-2: Development Environment Standardization

#### Docker Containerization
```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.prod
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/veritable
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    ports:
      - "3000:3000"

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=veritable
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

#### Dockerfile Optimization
```dockerfile
# Dockerfile.prod
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

### Week 2-3: Kubernetes Setup

#### Local Development with Kind/Minikube
```yaml
# k8s/base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: veritable-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: veritable
  template:
    metadata:
      labels:
        app: veritable
    spec:
      containers:
      - name: app
        image: veritable:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: redis-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

#### Horizontal Pod Autoscaler
```yaml
# k8s/base/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: veritable-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: veritable-app
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Week 3-4: CI/CD Pipeline

#### GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '20'
        cache: 'npm'
    - run: npm ci
    - run: npm run lint
    - run: npm run type-check
    - run: npm test
    - run: npm run test:e2e

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
    - name: Login to Container Registry
      uses: docker/login-action@v2
      with:
        registry: ${{ secrets.REGISTRY_URL }}
        username: ${{ secrets.REGISTRY_USERNAME }}
        password: ${{ secrets.REGISTRY_PASSWORD }}
    - name: Build and push
      uses: docker/build-push-action@v4
      with:
        push: true
        tags: |
          ${{ secrets.REGISTRY_URL }}/veritable:${{ github.sha }}
          ${{ secrets.REGISTRY_URL }}/veritable:latest
        cache-from: type=registry,ref=${{ secrets.REGISTRY_URL }}/veritable:buildcache
        cache-to: type=registry,ref=${{ secrets.REGISTRY_URL }}/veritable:buildcache,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
    - uses: actions/checkout@v3
    - name: Deploy to Kubernetes
      run: |
        # Install kubectl
        curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
        chmod +x kubectl

        # Configure kubectl
        echo "${{ secrets.KUBE_CONFIG }}" | base64 -d > kubeconfig
        export KUBECONFIG=kubeconfig

        # Apply new image
        kubectl set image deployment/veritable-app app=${{ secrets.REGISTRY_URL }}/veritable:${{ github.sha }}
        kubectl rollout status deployment/veritable-app
```

## Month 2: Core Infrastructure

### Week 1-2: Database Migration to PostgreSQL

#### Database Architecture
```sql
-- PostgreSQL Cluster Configuration
-- Primary: Write operations
-- Read Replicas: Read operations (3 replicas minimum)

-- Connection pooling with PgBouncer
-- Max connections: 100 per instance
-- Pool mode: transaction
```

#### Migration Strategy
```typescript
// lib/database/migration.ts
import { Pool } from 'pg';
import Database from 'better-sqlite3';

export class DatabaseMigrator {
  private pgPool: Pool;
  private sqliteDb: Database.Database;

  async migrate() {
    // 1. Create PostgreSQL schema
    await this.createSchema();

    // 2. Migrate data in batches
    await this.migrateUsers(1000); // batch size
    await this.migrateForums(1000);
    await this.migrateWiki(1000);

    // 3. Verify data integrity
    await this.verifyMigration();

    // 4. Setup replication
    await this.setupReplication();
  }

  private async createSchema() {
    // Create tables with proper indexes
    await this.pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_users_username ON users(username);
      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_users_created_at ON users(created_at);
    `);
  }
}
```

#### Connection Pool Configuration
```typescript
// lib/database/postgres-pool.ts
import { Pool } from 'pg';

const config = {
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  max: 20, // maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statement_timeout: 5000,
  query_timeout: 10000,
};

// Read replica pool for read operations
export const readPool = new Pool({
  ...config,
  host: process.env.POSTGRES_READ_HOST,
});

// Primary pool for write operations
export const writePool = new Pool(config);
```

### Week 2-3: Redis Cluster Deployment

#### Redis Configuration
```yaml
# k8s/redis/redis-cluster.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-config
data:
  redis.conf: |
    maxmemory 256mb
    maxmemory-policy allkeys-lru
    save 900 1
    save 300 10
    save 60 10000
    appendonly yes
    appendfsync everysec
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis-cluster
spec:
  serviceName: redis-cluster
  replicas: 6
  selector:
    matchLabels:
      app: redis-cluster
  template:
    metadata:
      labels:
        app: redis-cluster
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        command: ["redis-server"]
        args: ["/conf/redis.conf", "--cluster-enabled", "yes"]
        ports:
        - containerPort: 6379
        - containerPort: 16379
        volumeMounts:
        - name: conf
          mountPath: /conf
        - name: data
          mountPath: /data
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "200m"
      volumes:
      - name: conf
        configMap:
          name: redis-config
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

#### Redis Client Implementation
```typescript
// lib/cache/redis-client.ts
import Redis from 'ioredis';

const cluster = new Redis.Cluster([
  { host: 'redis-0.redis-cluster', port: 6379 },
  { host: 'redis-1.redis-cluster', port: 6379 },
  { host: 'redis-2.redis-cluster', port: 6379 },
], {
  redisOptions: {
    password: process.env.REDIS_PASSWORD,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
  },
  clusterRetryStrategy: (times) => Math.min(100 * times, 2000),
});

export class CacheService {
  async get<T>(key: string): Promise<T | null> {
    const value = await cluster.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, ttl = 3600): Promise<void> {
    await cluster.setex(key, ttl, JSON.stringify(value));
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await cluster.keys(pattern);
    if (keys.length > 0) {
      await cluster.del(...keys);
    }
  }
}
```

### Week 3-4: Load Balancer & CDN

#### NGINX Ingress Configuration
```yaml
# k8s/ingress/nginx-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: veritable-ingress
  annotations:
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/limit-rps: "10"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, PUT, DELETE, OPTIONS"
    nginx.ingress.kubernetes.io/cors-allow-headers: "DNT,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization"
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - veritable-games.com
    - www.veritable-games.com
    secretName: veritable-tls
  rules:
  - host: veritable-games.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: veritable-service
            port:
              number: 80
```

#### CloudFlare CDN Configuration
```javascript
// cloudflare-worker.js
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  // Cache static assets
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff2?)$/)) {
    const cache = caches.default;
    let response = await cache.match(request);

    if (!response) {
      response = await fetch(request);
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('X-Content-Type-Options', 'nosniff');

      response = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers
      });

      event.waitUntil(cache.put(request, response.clone()));
    }

    return response;
  }

  // Dynamic content with edge caching
  const cacheKey = new Request(url.toString(), request);
  const cache = caches.default;

  let response = await cache.match(cacheKey);

  if (!response) {
    response = await fetch(request, {
      cf: {
        cacheTtl: 300,
        cacheEverything: true,
        cacheTtlByStatus: { "200-299": 300, 404: 1, "500-599": 0 }
      }
    });

    if (response.status === 200) {
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');

      response = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers
      });

      event.waitUntil(cache.put(cacheKey, response.clone()));
    }
  }

  return response;
}
```

## Month 3: Reliability & Monitoring

### Week 1-2: High Availability Setup

#### Multi-Region Deployment
```yaml
# terraform/main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# EKS Cluster - Primary Region (us-east-1)
module "eks_primary" {
  source = "./modules/eks"

  cluster_name = "veritable-primary"
  region = "us-east-1"

  node_groups = {
    general = {
      desired_capacity = 3
      max_capacity     = 10
      min_capacity     = 3
      instance_types   = ["t3.medium"]
    }
  }

  enable_cluster_autoscaler = true
  enable_metrics_server     = true
}

# EKS Cluster - Secondary Region (eu-west-1)
module "eks_secondary" {
  source = "./modules/eks"

  cluster_name = "veritable-secondary"
  region = "eu-west-1"

  node_groups = {
    general = {
      desired_capacity = 2
      max_capacity     = 8
      min_capacity     = 2
      instance_types   = ["t3.medium"]
    }
  }

  enable_cluster_autoscaler = true
  enable_metrics_server     = true
}

# RDS PostgreSQL Multi-AZ
resource "aws_db_instance" "postgres_primary" {
  identifier = "veritable-postgres-primary"

  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.r6g.large"

  allocated_storage     = 100
  storage_encrypted     = true
  storage_type         = "gp3"
  iops                 = 3000

  multi_az               = true
  publicly_accessible    = false
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  performance_insights_enabled = true
  monitoring_interval         = 60

  enabled_cloudwatch_logs_exports = ["postgresql"]
}

# Read Replicas
resource "aws_db_instance" "postgres_read_replica" {
  count = 3

  identifier = "veritable-postgres-replica-${count.index}"
  replicate_source_db = aws_db_instance.postgres_primary.identifier

  instance_class = "db.t4g.large"
  publicly_accessible = false

  performance_insights_enabled = true
}

# ElastiCache Redis Cluster
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "veritable-redis"
  replication_group_description = "Redis cluster for caching and sessions"

  engine               = "redis"
  node_type           = "cache.r6g.large"
  number_cache_clusters = 3
  parameter_group_name = "default.redis7.cluster.on"

  automatic_failover_enabled = true
  multi_az_enabled          = true

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  snapshot_retention_limit = 7
  snapshot_window         = "03:00-05:00"

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis.name
    destination_type = "cloudwatch-logs"
    log_format      = "json"
    log_type        = "slow-log"
  }
}
```

### Week 2-3: Monitoring Stack

#### Prometheus & Grafana Setup
```yaml
# k8s/monitoring/prometheus.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s

    scrape_configs:
    - job_name: 'kubernetes-apiservers'
      kubernetes_sd_configs:
      - role: endpoints
      scheme: https
      tls_config:
        ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
      bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
      relabel_configs:
      - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
        action: keep
        regex: default;kubernetes;https

    - job_name: 'kubernetes-nodes'
      kubernetes_sd_configs:
      - role: node
      scheme: https
      tls_config:
        ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
      bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
      relabel_configs:
      - action: labelmap
        regex: __meta_kubernetes_node_label_(.+)

    - job_name: 'kubernetes-pods'
      kubernetes_sd_configs:
      - role: pod
      relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__

    - job_name: 'veritable-app'
      static_configs:
      - targets: ['veritable-service:3000']
      metrics_path: '/api/metrics'
```

#### Application Metrics
```typescript
// lib/monitoring/metrics.ts
import { register, Counter, Histogram, Gauge } from 'prom-client';

// Request metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});

// Database metrics
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

export const dbConnectionPool = new Gauge({
  name: 'db_connection_pool_size',
  help: 'Number of connections in the pool',
  labelNames: ['state'] // active, idle, waiting
});

// Cache metrics
export const cacheHitRate = new Gauge({
  name: 'cache_hit_rate',
  help: 'Cache hit rate percentage',
  labelNames: ['cache_type']
});

// Business metrics
export const activeUsers = new Gauge({
  name: 'active_users_total',
  help: 'Number of active users'
});

export const forumPosts = new Counter({
  name: 'forum_posts_total',
  help: 'Total number of forum posts created'
});

// WebSocket metrics
export const wsConnections = new Gauge({
  name: 'websocket_connections',
  help: 'Number of active WebSocket connections'
});

// Export metrics endpoint
export async function metricsHandler() {
  return register.metrics();
}
```

### Week 3-4: Log Aggregation & Alerting

#### ELK Stack Configuration
```yaml
# k8s/logging/elasticsearch.yaml
apiVersion: elasticsearch.k8s.elastic.co/v1
kind: Elasticsearch
metadata:
  name: veritable-elasticsearch
spec:
  version: 8.11.1
  nodeSets:
  - name: masters
    count: 3
    config:
      node.roles: ["master"]
    podTemplate:
      spec:
        containers:
        - name: elasticsearch
          resources:
            requests:
              memory: 2Gi
              cpu: 1
            limits:
              memory: 2Gi
              cpu: 2
    volumeClaimTemplates:
    - metadata:
        name: elasticsearch-data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 10Gi

  - name: data
    count: 3
    config:
      node.roles: ["data", "ingest"]
    podTemplate:
      spec:
        containers:
        - name: elasticsearch
          resources:
            requests:
              memory: 4Gi
              cpu: 2
            limits:
              memory: 4Gi
              cpu: 4
    volumeClaimTemplates:
    - metadata:
        name: elasticsearch-data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 100Gi
```

#### Fluentd Configuration
```yaml
# k8s/logging/fluentd-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluentd-config
data:
  fluent.conf: |
    <source>
      @type tail
      path /var/log/containers/*.log
      pos_file /var/log/fluentd-containers.log.pos
      tag kubernetes.*
      <parse>
        @type json
        time_format %Y-%m-%dT%H:%M:%S.%NZ
      </parse>
    </source>

    <filter kubernetes.**>
      @type kubernetes_metadata
      @id filter_kube_metadata
      kubernetes_url "#{ENV['FLUENT_FILTER_KUBERNETES_URL'] || 'https://' + ENV.fetch('KUBERNETES_SERVICE_HOST') + ':' + ENV.fetch('KUBERNETES_SERVICE_PORT') + '/api'}"
      verify_ssl "#{ENV['KUBERNETES_VERIFY_SSL'] || true}"
    </filter>

    <filter kubernetes.var.log.containers.veritable-**.log>
      @type parser
      key_name log
      <parse>
        @type json
      </parse>
    </filter>

    <match kubernetes.**>
      @type elasticsearch
      @id out_es
      @log_level info
      include_tag_key true
      host "#{ENV['FLUENT_ELASTICSEARCH_HOST']}"
      port "#{ENV['FLUENT_ELASTICSEARCH_PORT']}"
      path "#{ENV['FLUENT_ELASTICSEARCH_PATH']}"
      scheme "#{ENV['FLUENT_ELASTICSEARCH_SCHEME'] || 'http'}"
      ssl_verify "#{ENV['FLUENT_ELASTICSEARCH_SSL_VERIFY'] || 'true'}"
      ssl_version "#{ENV['FLUENT_ELASTICSEARCH_SSL_VERSION'] || 'TLSv1_2'}"
      user "#{ENV['FLUENT_ELASTICSEARCH_USER']}"
      password "#{ENV['FLUENT_ELASTICSEARCH_PASSWORD']}"
      reload_connections "#{ENV['FLUENT_ELASTICSEARCH_RELOAD_CONNECTIONS'] || 'false'}"
      reconnect_on_error true
      reload_on_failure true
      log_es_400_reason false
      logstash_prefix "#{ENV['FLUENT_ELASTICSEARCH_LOGSTASH_PREFIX'] || 'logstash'}"
      logstash_format true
      index_name logstash
      type_name fluentd
      <buffer>
        @type file
        path /var/log/fluentd-buffers/kubernetes.system.buffer
        flush_mode interval
        retry_type exponential_backoff
        flush_thread_count 2
        flush_interval 5s
        retry_forever
        retry_max_interval 30
        chunk_limit_size "#{ENV['FLUENT_ELASTICSEARCH_BUFFER_CHUNK_LIMIT_SIZE'] || '2M'}"
        queue_limit_length "#{ENV['FLUENT_ELASTICSEARCH_BUFFER_QUEUE_LIMIT_LENGTH'] || '8'}"
        overflow_action block
      </buffer>
    </match>
```

#### AlertManager Configuration
```yaml
# k8s/alerting/alertmanager-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: alertmanager-config
data:
  alertmanager.yml: |
    global:
      resolve_timeout: 5m
      slack_api_url: 'YOUR_SLACK_WEBHOOK_URL'
      pagerduty_url: 'https://events.pagerduty.com/v2/enqueue'

    route:
      group_by: ['alertname', 'cluster', 'service']
      group_wait: 10s
      group_interval: 10s
      repeat_interval: 12h
      receiver: 'default'
      routes:
      - match:
          severity: critical
        receiver: pagerduty
      - match:
          severity: warning
        receiver: slack

    receivers:
    - name: 'default'
      slack_configs:
      - channel: '#alerts'
        title: 'Veritable Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'

    - name: 'pagerduty'
      pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_SERVICE_KEY'
        description: '{{ .GroupLabels.alertname }}'

    - name: 'slack'
      slack_configs:
      - channel: '#alerts'
        send_resolved: true
        title: 'Alert: {{ .GroupLabels.alertname }}'
        text: '{{ .CommonAnnotations.description }}'
```

#### Alert Rules
```yaml
# k8s/alerting/alert-rules.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-rules
data:
  alerts.yml: |
    groups:
    - name: application
      interval: 30s
      rules:
      - alert: HighRequestLatency
        expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High request latency detected"
          description: "95th percentile request latency is above 500ms (current: {{ $value }}s)"

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is above 5% (current: {{ $value | humanizePercentage }})"

      - alert: DatabaseConnectionPoolExhausted
        expr: db_connection_pool_size{state="waiting"} > 10
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool exhausted"
          description: "More than 10 connections waiting in pool"

      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"
          description: "Container memory usage is above 90%"

      - alert: PodCrashLooping
        expr: rate(kube_pod_container_status_restarts_total[15m]) > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Pod is crash looping"
          description: "Pod {{ $labels.namespace }}/{{ $labels.pod }} is crash looping"
```

## Month 4: Security & Compliance

### Week 1-2: Web Application Firewall & DDoS Protection

#### AWS WAF Configuration
```json
{
  "Name": "VeritableWAF",
  "Scope": "CLOUDFRONT",
  "DefaultAction": {
    "Allow": {}
  },
  "Rules": [
    {
      "Name": "RateLimitRule",
      "Priority": 1,
      "Statement": {
        "RateBasedStatement": {
          "Limit": 2000,
          "AggregateKeyType": "IP"
        }
      },
      "Action": {
        "Block": {}
      }
    },
    {
      "Name": "SQLInjectionRule",
      "Priority": 2,
      "Statement": {
        "SqliMatchStatement": {
          "FieldToMatch": {
            "AllQueryArguments": {}
          },
          "TextTransformations": [
            {
              "Priority": 0,
              "Type": "URL_DECODE"
            },
            {
              "Priority": 1,
              "Type": "HTML_ENTITY_DECODE"
            }
          ]
        }
      },
      "Action": {
        "Block": {}
      }
    },
    {
      "Name": "XSSProtectionRule",
      "Priority": 3,
      "Statement": {
        "XssMatchStatement": {
          "FieldToMatch": {
            "AllQueryArguments": {}
          },
          "TextTransformations": [
            {
              "Priority": 0,
              "Type": "URL_DECODE"
            },
            {
              "Priority": 1,
              "Type": "HTML_ENTITY_DECODE"
            }
          ]
        }
      },
      "Action": {
        "Block": {}
      }
    },
    {
      "Name": "GeoBlockingRule",
      "Priority": 4,
      "Statement": {
        "GeoMatchStatement": {
          "CountryCodes": ["CN", "RU", "KP"]
        }
      },
      "Action": {
        "Block": {}
      }
    }
  ]
}
```

#### CloudFlare DDoS Protection
```javascript
// CloudFlare Worker for DDoS mitigation
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const ip = request.headers.get('CF-Connecting-IP');

  // Rate limiting per IP
  const rateLimitKey = `rate_limit:${ip}`;
  const requests = await RATE_LIMIT.get(rateLimitKey);

  if (requests && parseInt(requests) > 100) {
    return new Response('Too Many Requests', { status: 429 });
  }

  await RATE_LIMIT.put(rateLimitKey, (parseInt(requests || 0) + 1).toString(), {
    expirationTtl: 60
  });

  // Challenge suspicious traffic
  if (request.cf && request.cf.threatScore > 30) {
    return fetch(request, {
      cf: {
        mirage: true,
        polish: "lossless",
        cacheTtl: 0,
        apps: false,
        minify: {
          javascript: true,
          css: true,
          html: true
        },
        rocket: true
      }
    });
  }

  // Normal traffic
  return fetch(request);
}
```

### Week 2-3: Backup & Disaster Recovery

#### Automated Backup Strategy
```yaml
# k8s/backup/velero-schedule.yaml
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: daily-backup
  namespace: velero
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  template:
    ttl: 720h  # 30 days retention
    includedNamespaces:
    - default
    - production
    includedResources:
    - '*'
    storageLocation: aws-backup
    volumeSnapshotLocations:
    - aws-snapshots
---
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: hourly-backup
  namespace: velero
spec:
  schedule: "0 * * * *"  # Hourly
  template:
    ttl: 168h  # 7 days retention
    includedNamespaces:
    - production
    includedResources:
    - persistentvolumeclaims
    - persistentvolumes
    storageLocation: aws-backup
```

#### Database Backup Script
```bash
#!/bin/bash
# backup-postgres.sh

# Configuration
BACKUP_DIR="/backups/postgres"
S3_BUCKET="veritable-backups"
DB_HOST="${POSTGRES_HOST}"
DB_NAME="${POSTGRES_DB}"
DB_USER="${POSTGRES_USER}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

# Create backup directory
mkdir -p ${BACKUP_DIR}

# Perform backup
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h ${DB_HOST} \
  -U ${DB_USER} \
  -d ${DB_NAME} \
  --no-owner \
  --no-acl \
  --verbose \
  | gzip > ${BACKUP_FILE}

# Upload to S3
aws s3 cp ${BACKUP_FILE} s3://${S3_BUCKET}/postgres/ \
  --storage-class GLACIER \
  --server-side-encryption AES256

# Clean up old local backups (keep 7 days)
find ${BACKUP_DIR} -type f -mtime +7 -delete

# Verify backup integrity
gunzip -t ${BACKUP_FILE}
if [ $? -eq 0 ]; then
  echo "Backup successful: ${BACKUP_FILE}"

  # Send success notification
  curl -X POST ${SLACK_WEBHOOK_URL} \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"Database backup successful: ${BACKUP_FILE}\"}"
else
  echo "Backup verification failed!"

  # Send failure alert
  curl -X POST ${PAGERDUTY_WEBHOOK_URL} \
    -H 'Content-Type: application/json' \
    -d "{\"event_action\":\"trigger\",\"payload\":{\"summary\":\"Database backup failed\",\"severity\":\"critical\"}}"

  exit 1
fi
```

#### Disaster Recovery Runbook
```markdown
# Disaster Recovery Procedures

## RTO: 15 minutes | RPO: 1 hour

### Scenario 1: Primary Region Failure

1. **Detection** (0-2 minutes)
   - CloudWatch alarms trigger
   - PagerDuty alert sent to on-call engineer

2. **Assessment** (2-5 minutes)
   ```bash
   # Check primary region status
   aws eks describe-cluster --name veritable-primary --region us-east-1

   # Check database status
   aws rds describe-db-instances --region us-east-1
   ```

3. **Failover Initiation** (5-10 minutes)
   ```bash
   # Promote read replica to primary
   aws rds promote-read-replica \
     --db-instance-identifier veritable-postgres-replica-0 \
     --region eu-west-1

   # Update DNS to point to secondary region
   aws route53 change-resource-record-sets \
     --hosted-zone-id $ZONE_ID \
     --change-batch file://failover-dns.json
   ```

4. **Verification** (10-15 minutes)
   ```bash
   # Verify application health
   curl -f https://veritable-games.com/api/health

   # Check metrics
   kubectl top nodes
   kubectl top pods
   ```

### Scenario 2: Data Corruption

1. **Stop writes immediately**
   ```bash
   kubectl scale deployment veritable-app --replicas=0
   ```

2. **Identify corruption point**
   ```sql
   SELECT * FROM pg_stat_activity WHERE state = 'active';
   SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100;
   ```

3. **Restore from backup**
   ```bash
   # Restore from point-in-time
   aws rds restore-db-instance-to-point-in-time \
     --source-db-instance-identifier veritable-postgres-primary \
     --target-db-instance-identifier veritable-postgres-restored \
     --restore-time 2024-01-15T03:00:00.000Z
   ```

4. **Verify data integrity**
   ```sql
   -- Run integrity checks
   SELECT COUNT(*) FROM users;
   SELECT COUNT(*) FROM forums_topics;
   SELECT COUNT(*) FROM wiki_pages;
   ```
```

### Week 3-4: Security Scanning & Compliance

#### Container Security Scanning
```yaml
# .github/workflows/security-scan.yml
name: Security Scanning

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 0 * * *'  # Daily

jobs:
  trivy-scan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: 'veritable:latest'
        format: 'sarif'
        output: 'trivy-results.sarif'
        severity: 'CRITICAL,HIGH'

    - name: Upload Trivy results to GitHub Security
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'

  snyk-scan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Run Snyk security scan
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      with:
        args: --severity-threshold=high

  sonarqube-scan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: SonarQube Scan
      uses: sonarsource/sonarqube-scan-action@master
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
        SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
```

#### Network Policies
```yaml
# k8s/security/network-policies.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: veritable-app-policy
spec:
  podSelector:
    matchLabels:
      app: veritable
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    - podSelector:
        matchLabels:
          app: nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
  - to:
    - namespaceSelector: {}
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
```

## Cost Optimization

### Infrastructure Cost Breakdown

#### Monthly Costs (AWS)
```
EKS Clusters (2 regions):
- Control Plane: $146/month (2 × $73)
- Worker Nodes (t3.medium): $300/month (5 instances)

RDS PostgreSQL:
- Primary (db.r6g.large, Multi-AZ): $460/month
- Read Replicas (3 × db.t4g.large): $390/month

ElastiCache Redis:
- 3 × cache.r6g.large: $520/month

Load Balancer:
- Application Load Balancer: $25/month
- Data transfer: ~$100/month

Storage:
- EBS volumes: $100/month
- S3 backups: $50/month

CloudWatch & Monitoring:
- Logs, metrics, dashboards: $150/month

Total: ~$2,241/month
```

### Cost Optimization Strategies

1. **Reserved Instances**
   - 1-year commitment: 30% savings
   - 3-year commitment: 50% savings
   - Estimated savings: $670-$1,120/month

2. **Spot Instances**
   - Non-critical workloads: 70% savings
   - Dev/staging environments: $200/month savings

3. **Auto-scaling Policies**
   - Scale down during low traffic: 40% compute savings
   - Estimated savings: $120/month

4. **S3 Lifecycle Policies**
   ```json
   {
     "Rules": [
       {
         "Id": "ArchiveOldBackups",
         "Status": "Enabled",
         "Transitions": [
           {
             "Days": 30,
             "StorageClass": "GLACIER"
           },
           {
             "Days": 90,
             "StorageClass": "DEEP_ARCHIVE"
           }
         ],
         "Expiration": {
           "Days": 365
         }
       }
     ]
   }
   ```

## Migration Strategy

### Phase 1: Development Environment (Week 1)
1. Set up Docker containers
2. Configure local Kubernetes
3. Migrate development database to PostgreSQL
4. Test application with new infrastructure

### Phase 2: Staging Environment (Week 2)
1. Deploy to cloud Kubernetes cluster
2. Configure CI/CD pipeline
3. Load testing with production-like data
4. Performance benchmarking

### Phase 3: Production Migration (Week 3-4)
1. **Database Migration**
   ```bash
   # Export from SQLite
   sqlite3 forums.db .dump > forums.sql

   # Convert to PostgreSQL format
   python sqlite_to_postgres.py forums.sql > forums_pg.sql

   # Import to PostgreSQL
   psql -h $PG_HOST -U $PG_USER -d $PG_DB < forums_pg.sql
   ```

2. **Blue-Green Deployment**
   - Deploy new infrastructure (Green)
   - Sync data in real-time
   - Switch traffic gradually (10% → 50% → 100%)
   - Monitor for issues
   - Keep blue environment for rollback

3. **Rollback Plan**
   - DNS switch back to old infrastructure: 2 minutes
   - Data sync from new to old: 10 minutes
   - Full restoration: 15 minutes

## Scaling Policies

### Horizontal Pod Autoscaler
```yaml
metrics:
- type: Resource
  resource:
    name: cpu
    target:
      type: Utilization
      averageUtilization: 70
- type: Resource
  resource:
    name: memory
    target:
      type: Utilization
      averageUtilization: 80
- type: Pods
  pods:
    metric:
      name: http_requests_per_second
    target:
      type: AverageValue
      averageValue: "1000"
```

### Database Scaling Triggers
- CPU > 80%: Add read replica
- Connections > 80%: Increase connection pool
- Storage > 80%: Expand volume
- IOPS > 80%: Upgrade instance class

### Cache Scaling Policies
- Memory usage > 75%: Add Redis node
- Evictions > 100/min: Increase cache size
- Hit rate < 80%: Review caching strategy

## Team Skill Requirements

### Core Team Structure
1. **DevOps Engineers (2)**
   - Kubernetes expertise
   - AWS/Cloud platform experience
   - Infrastructure as Code (Terraform)
   - CI/CD pipeline management

2. **Site Reliability Engineers (2)**
   - Monitoring and observability
   - Incident response
   - Performance optimization
   - Capacity planning

3. **Security Engineer (1)**
   - Container security
   - Network security
   - Compliance and auditing
   - Vulnerability management

4. **Database Administrator (1)**
   - PostgreSQL optimization
   - Replication and clustering
   - Backup and recovery
   - Query optimization

### Training Requirements
- Kubernetes certification (CKA/CKAD)
- AWS Solutions Architect
- PostgreSQL administration
- Prometheus/Grafana monitoring
- GitOps practices

## Success Metrics

### Performance KPIs
- Response time p95 < 100ms
- Availability > 99.95%
- Error rate < 0.1%
- Cache hit rate > 85%
- Database query time p95 < 50ms

### Operational KPIs
- Deploy frequency: Daily
- Lead time: < 1 hour
- MTTR: < 15 minutes
- Change failure rate: < 5%
- Backup success rate: 100%

### Business KPIs
- Concurrent users: 5,000+
- Page load time: < 2 seconds
- WebSocket connections: 10,000+
- API requests/sec: 1,000+
- Data processing: 100GB/day

## Risk Mitigation

### Technical Risks
1. **Migration failures**: Blue-green deployment with instant rollback
2. **Data loss**: Multiple backup strategies, point-in-time recovery
3. **Security breaches**: Defense in depth, regular audits
4. **Performance degradation**: Auto-scaling, performance monitoring
5. **Vendor lock-in**: Use of open standards, portable containers

### Operational Risks
1. **Team skill gaps**: Training programs, external consultants
2. **Budget overruns**: Reserved instances, cost monitoring
3. **Compliance issues**: Regular audits, automated scanning
4. **Communication failures**: Clear runbooks, incident response plan

## Conclusion

This comprehensive infrastructure scaling plan provides a clear path from the current single-server architecture to a cloud-native, highly available platform. The phased approach minimizes risk while ensuring continuous service availability.

Key deliverables:
- Month 1: Containerization and Kubernetes foundation
- Month 2: Database migration and core infrastructure
- Month 3: Full observability and reliability systems
- Month 4: Security hardening and compliance

Expected outcomes:
- Support for 5,000+ concurrent users
- 99.95% uptime SLA achievement
- Sub-100ms global latency
- Automated scaling and deployment
- Complete disaster recovery capability

Total investment: ~$2,241/month operational costs with optimization potential to reduce by 40-50% through reserved instances and auto-scaling.

The plan ensures the platform can scale beyond the initial 5,000 user target, with infrastructure capable of handling 10x growth without major architectural changes.