# Staging Environment Deployment

## Prerequisites

Before deploying to staging, ensure:

```bash
# 1. Check working directory
pwd  # Should be: /home/user/Projects/veritable-games-main

# 2. Verify git status
git status
# Expected: On branch main, no uncommitted changes

# 3. Verify database access
psql $DATABASE_URL -c "SELECT version();"

# 4. Verify Node.js version
node --version  # Should be v20.x or later

# 5. Verify npm is available
npm --version
```

## Staging Configuration

Create `.env.staging` for staging environment:

```bash
cat > frontend/mcp-servers/godot-router/.env.staging << 'EOF'
# Environment
NODE_ENV=staging
LOG_LEVEL=debug
LOG_FORMAT=json

# MCP Configuration
MCP_IDLE_TIMEOUT=1800000
ENABLE_METRICS=true

# Alerting (disable in staging)
ALERTING_ENABLED=false

# Database (staging database)
DATABASE_URL=postgresql://staging_user:staging_pass@staging-db.internal:5432/veritable_games_staging
DATABASE_POOL_SIZE=10

# API
API_BASE_URL=https://staging-api.internal
GODOT_PROJECTS_PATH=/mnt/staging/godot-projects

# Testing
ENABLE_CHAOS_TESTS=true
CHAOS_TEST_TIMEOUT=10000
EOF

chmod 600 frontend/mcp-servers/godot-router/.env.staging
```

## Step 1: Prepare Build

```bash
cd frontend/mcp-servers/godot-router

# 1. Clean previous builds
rm -rf dist node_modules

# 2. Install dependencies
npm ci

# 3. Run type check
npx tsc --noEmit

# 4. Run linting
npm run lint

# 5. Run all tests
npm test -- --coverage

# Expected: All tests pass
```

## Step 2: Build Application

```bash
# 1. Build TypeScript
npm run build

# 2. Verify build output
ls -lh dist/
# Expected: router.js, instance.js, resilience/, utils/, etc.

# 3. Check bundle size
du -sh dist/
# Expected: <10MB total

# 4. Test build runs
export NODE_ENV=staging
node dist/router.js --version
```

## Step 3: Database Migrations

```bash
# 1. Load staging environment
source .env.staging

# 2. Back up staging database
pg_dump $DATABASE_URL > backup_staging_$(date +%Y%m%d_%H%M%S).sql

# 3. Run migrations
npm run db:migrate

# 4. Verify migrations applied
psql $DATABASE_URL -c "
  SELECT migration_version, applied_at
  FROM schema_migrations
  WHERE migration_version LIKE 'phase-5%'
  ORDER BY applied_at DESC LIMIT 5;"

# Expected: Phase 5 migrations shown
```

## Step 4: Deploy to Staging

### Option A: Docker Deployment

```bash
# 1. Load staging environment
source .env.staging

# 2. Build Docker image
docker build \
  --tag godot-mcp-router:staging \
  --build-arg NODE_ENV=staging \
  -f Dockerfile .

# 3. Run staging container
docker run -d \
  --name godot-mcp-router-staging \
  --env-file .env.staging \
  --publish 3002:3002 \
  --mount type=volume,source=godot-projects,target=/mnt/staging/godot-projects \
  godot-mcp-router:staging

# 4. Verify container running
docker ps | grep godot-mcp-router-staging

# 5. View logs
docker logs -f godot-mcp-router-staging
```

### Option B: Direct Server Deployment

```bash
# 1. Create staging directory
mkdir -p /opt/staging/godot-mcp-router
cd /opt/staging/godot-mcp-router

# 2. Copy built application
cp -r /home/user/Projects/veritable-games-main/frontend/mcp-servers/godot-router/dist ./
cp -r /home/user/Projects/veritable-games-main/frontend/mcp-servers/godot-router/node_modules ./
cp .env.staging .env

# 3. Create systemd service
sudo tee /etc/systemd/system/godot-mcp-router-staging.service > /dev/null << 'SYSTEMD'
[Unit]
Description=Godot MCP Router (Staging)
After=network.target postgresql.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/staging/godot-mcp-router
EnvironmentFile=/opt/staging/godot-mcp-router/.env
ExecStart=/usr/bin/node /opt/staging/godot-mcp-router/dist/router.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SYSTEMD

# 4. Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable godot-mcp-router-staging
sudo systemctl start godot-mcp-router-staging

# 5. Check status
sudo systemctl status godot-mcp-router-staging

# 6. View logs
sudo journalctl -u godot-mcp-router-staging -n 50 -f
```

### Option C: Kubernetes Deployment (Staging Cluster)

```bash
# 1. Create namespace
kubectl create namespace godot-mcp-staging

# 2. Create secrets
kubectl create secret generic godot-mcp-secrets \
  --from-literal=DATABASE_URL=$DATABASE_URL \
  -n godot-mcp-staging

# 3. Create ConfigMap for non-sensitive config
kubectl create configmap godot-mcp-config \
  --from-literal=LOG_LEVEL=debug \
  --from-literal=LOG_FORMAT=json \
  --from-literal=NODE_ENV=staging \
  -n godot-mcp-staging

# 4. Deploy to staging
cat > k8s/deployment-staging.yaml << 'K8S'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: godot-mcp-router-staging
  namespace: godot-mcp-staging
spec:
  replicas: 1  # Single instance in staging
  selector:
    matchLabels:
      app: godot-mcp-router-staging
  template:
    metadata:
      labels:
        app: godot-mcp-router-staging
    spec:
      containers:
      - name: router
        image: godot-mcp-router:staging
        ports:
        - containerPort: 3002
        envFrom:
        - configMapRef:
            name: godot-mcp-config
        - secretRef:
            name: godot-mcp-secrets
        livenessProbe:
          httpGet:
            path: /api/health/liveness
            port: 3002
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/health/readiness
            port: 3002
          initialDelaySeconds: 5
          periodSeconds: 10
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
K8S

kubectl apply -f k8s/deployment-staging.yaml

# 5. Verify rollout
kubectl rollout status deployment/godot-mcp-router-staging -n godot-mcp-staging
kubectl get pods -n godot-mcp-staging

# 6. Check health
kubectl port-forward -n godot-mcp-staging \
  svc/godot-mcp-router-staging 3002:3002 &
curl http://localhost:3002/api/health/readiness
```

## Step 5: Verify Staging Deployment

```bash
# 1. Check if service is running
curl -i http://localhost:3002/api/health/liveness

# Expected:
# HTTP/1.1 200 OK
# {"status":"healthy"}

# 2. Check readiness
curl http://localhost:3002/api/health/readiness | jq .

# Expected:
# {
#   "status": "healthy",
#   "database": "connected",
#   "uptime": 5432,
#   "timestamp": "2025-01-01T00:00:00Z"
# }

# 3. Check metrics endpoint
curl http://localhost:3002/api/metrics/prometheus | head -20

# Expected: Prometheus metrics in text format

# 4. Check MCP instance status
curl http://localhost:3002/api/health/mcp | jq '.'

# Expected:
# {
#   "summary": {
#     "totalInstances": 0,
#     "healthyInstances": 0,
#     "unhealthyInstances": 0,
#     "crashLoopInstances": 0
#   },
#   "instances": []
# }
```

## Step 6: Run Staging Tests

```bash
# 1. Run unit tests
npm test -- --coverage

# Expected: 150+ tests pass

# 2. Run integration tests
npm test -- --testPathPattern=integration

# Expected: 30+ integration tests pass

# 3. Run chaos engineering tests (in debug mode)
npm test -- --testPathPattern=chaos --verbose

# Expected: 20+ chaos scenarios pass

# 4. Check test coverage
npm test -- --coverage --collectCoverageFrom='src/**/*.ts'

# Expected: >90% coverage on critical paths
```

## Step 7: Performance Validation

```bash
# 1. Spawn test instance
curl -X POST http://localhost:3002/api/instances/1/spawn

# 2. Monitor spawn latency
time curl -X POST http://localhost:3002/api/instances/2/spawn

# Expected: <1000ms

# 3. Check instance health
sleep 5
curl http://localhost:3002/api/health/mcp | jq '.summary'

# Expected: totalInstances > 0, healthyInstances > 0

# 4. Test rapid requests
for i in {1..10}; do
  curl -s http://localhost:3002/api/health/readiness | jq .status
done

# Expected: All return "healthy"

# 5. Monitor resource usage
# Check memory
ps aux | grep "node dist/router.js"

# Check connections
psql $DATABASE_URL -c "
  SELECT count(*) as connections FROM pg_stat_activity
  WHERE datname = 'veritable_games_staging';"

# Expected: <20 connections
```

## Step 8: Staging Test Suite

```bash
# Create comprehensive staging test script
cat > staging-test.sh << 'SCRIPT'
#!/bin/bash

set -e

echo "═══════════════════════════════════════════════════════"
echo "Staging Environment Test Suite"
echo "═══════════════════════════════════════════════════════"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS_COUNT=0
FAIL_COUNT=0

# Test function
run_test() {
  local test_name=$1
  local command=$2

  echo -e "\n${YELLOW}Testing: $test_name${NC}"

  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}: $test_name"
    ((PASS_COUNT++))
  else
    echo -e "${RED}✗ FAIL${NC}: $test_name"
    ((FAIL_COUNT++))
  fi
}

# Test health endpoints
run_test "Liveness check" \
  "curl -s http://localhost:3002/api/health/liveness | grep -q healthy"

run_test "Readiness check" \
  "curl -s http://localhost:3002/api/health/readiness | grep -q healthy"

run_test "MCP health check" \
  "curl -s http://localhost:3002/api/health/mcp | grep -q totalInstances"

# Test metrics
run_test "Metrics endpoint" \
  "curl -s http://localhost:3002/api/metrics/prometheus | grep -q mcp_"

# Test instance spawning
run_test "Spawn instance" \
  "curl -s -X POST http://localhost:3002/api/instances/1/spawn | grep -q pid"

# Test database connectivity
run_test "Database connectivity" \
  "psql $DATABASE_URL -c 'SELECT 1;' > /dev/null"

# Test logging
run_test "Structured logging" \
  "curl -s http://localhost:3002/api/health/readiness | jq . > /dev/null"

# Summary
echo -e "\n═══════════════════════════════════════════════════════"
echo -e "Test Results: ${GREEN}$PASS_COUNT passed${NC}, ${RED}$FAIL_COUNT failed${NC}"
echo "═══════════════════════════════════════════════════════"

if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed!${NC}"
  exit 1
fi
SCRIPT

chmod +x staging-test.sh
./staging-test.sh
```

## Step 9: Monitoring Setup

```bash
# 1. Start Prometheus scraper (local test)
curl -X POST http://localhost:3002/api/metrics/prometheus \
  -H "Accept: text/plain" \
  > metrics_staging_$(date +%Y%m%d_%H%M%S).txt

# 2. Monitor logs in real-time
if command -v docker &> /dev/null; then
  docker logs -f godot-mcp-router-staging
else
  journalctl -u godot-mcp-router-staging -f
fi

# 3. Set up alert monitoring (dummy example)
watch -n 5 'curl -s http://localhost:3002/api/health/mcp | jq ".summary"'
```

## Step 10: Load Testing (Optional)

```bash
# 1. Install Apache Bench if not available
# sudo apt-get install apache2-utils

# 2. Run load test
ab -n 1000 -c 10 http://localhost:3002/api/health/readiness

# 3. Analyze results
# Look for: Requests per second, Failed requests (should be 0)

# 4. Test concurrent instance spawning
for i in {1..5}; do
  curl -X POST http://localhost:3002/api/instances/$i/spawn &
done
wait

# 5. Verify all instances healthy
curl http://localhost:3002/api/health/mcp | jq '.summary'
```

## Rollback Procedure

If staging deployment fails:

```bash
# Option A: Docker rollback
docker stop godot-mcp-router-staging
docker rm godot-mcp-router-staging

# Option B: Systemd rollback
sudo systemctl stop godot-mcp-router-staging
sudo systemctl disable godot-mcp-router-staging

# Option C: Kubernetes rollback
kubectl rollout undo deployment/godot-mcp-router-staging \
  -n godot-mcp-staging

# Restore database from backup
psql $DATABASE_URL < backup_staging_20250101_120000.sql
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3002
lsof -i :3002

# Kill process
kill -9 <PID>
```

### Database Connection Errors

```bash
# Verify connection string
echo $DATABASE_URL

# Test with psql
psql $DATABASE_URL -c "SELECT 1;"

# Check firewall
telnet staging-db.internal 5432
```

### Memory Issues

```bash
# Increase memory limit
export NODE_OPTIONS="--max-old-space-size=2048"

# Restart service
systemctl restart godot-mcp-router-staging
```

### Build Failures

```bash
# Clean build
rm -rf dist node_modules
npm ci
npm run build

# Check TypeScript errors
npx tsc --noEmit
```

## Next Steps

Once staging deployment is verified:

1. ✅ Run full test suite
2. ✅ Verify all health checks pass
3. ✅ Monitor performance for 24 hours
4. ✅ Review logs for errors
5. ✅ Run chaos engineering tests
6. ✅ Load test with realistic traffic
7. ✅ Get team approval
8. ➡️ Schedule production deployment

---

**Staging Deployment Complete!**

The system is now running in staging and ready for validation before production
deployment.
