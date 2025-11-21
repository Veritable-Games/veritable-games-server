# Docker Infrastructure Inventory

**Server:** veritable-games-server (192.168.1.15)
**Last Updated:** November 21, 2025
**Purpose:** Complete inventory of Docker networks, volumes, and containers for disaster recovery and infrastructure understanding

---

## Table of Contents

1. [Docker Networks](#docker-networks)
2. [Docker Volumes](#docker-volumes)
3. [Running Containers](#running-containers)
4. [Container Dependencies](#container-dependencies)
5. [Port Mappings](#port-mappings)
6. [Data Flow Diagram](#data-flow-diagram)

---

## Docker Networks

### Production Application Network

**Network:** `veritable-games-network`
- **ID:** 51b4db5acfab
- **Driver:** bridge
- **Scope:** local
- **Purpose:** Isolates Veritable Games application containers
- **Connected Containers:**
  - `veritable-games-postgres` (PostgreSQL database)
  - `veritable-games-pgadmin` (pgAdmin web interface)
- **Subnet:** Auto-assigned by Docker
- **Created:** November 2025 (initial deployment)

**Creation Command:**
```bash
docker network create veritable-games-network
```

---

### Coolify Infrastructure Network

**Network:** `coolify`
- **ID:** b33f84c0db4e
- **Driver:** bridge
- **Scope:** local
- **Purpose:** Coolify platform infrastructure and deployed applications
- **Connected Containers:**
  - `coolify` (Coolify main application)
  - `coolify-db` (PostgreSQL database for Coolify)
  - `coolify-redis` (Redis cache for Coolify)
  - `coolify-realtime` (Real-time updates)
  - `coolify-proxy` (Traefik reverse proxy)
  - `coolify-sentinel` (Health monitoring)
  - `m4s0kwo4kc4oooocck4sswc4` (Veritable Games app container)
  - `veritable-games-postgres` (Dual-network container)
  - `uptime-kuma` (Uptime monitoring)
  - `generated_btcpayserver_1` (BTCPay Server)
- **Subnet:** Auto-assigned by Docker
- **Created:** Initial Coolify installation

**Note:** Coolify automatically connects deployed applications to this network for reverse proxy routing.

---

### BTCPayServer Infrastructure Network

**Network:** `generated_default`
- **ID:** 2f279a7efaf2
- **Driver:** bridge
- **Scope:** local
- **Purpose:** BTCPayServer application stack networking
- **Connected Containers:**
  - `generated_btcpayserver_1` (BTCPay main app) - **Dual-network** (also on coolify)
  - `btcpayserver_clightning_bitcoin` (Lightning Network node)
  - `btcpayserver_bitcoind` (Bitcoin Core node)
  - `generated-bitcoin_rtl-1` (Ride The Lightning - LN management UI)
  - `generated_nbxplorer_1` (NBXplorer - blockchain indexer)
  - `tor-gen` (Tor configuration generator)
  - `tor` (Tor proxy for privacy)
  - `generated_postgres_1` (BTCPay PostgreSQL database)
- **Subnet:** Auto-assigned by Docker Compose
- **Created:** BTCPayServer docker-compose deployment

---

### Default Docker Networks

**Network:** `bridge` (ID: 13f8f146b03e)
- **Purpose:** Default Docker bridge network
- **Connected:** coolify-sentinel
- **Scope:** local

**Network:** `host` (ID: 5d11d4cd565f)
- **Purpose:** Host network mode (no isolation)
- **Connected:** None currently
- **Scope:** local

**Network:** `none` (ID: c1c15200e291)
- **Purpose:** No networking
- **Connected:** None
- **Scope:** local

---

## Docker Volumes

### Production Application Volumes (Veritable Games)

#### Anarchist Library Content

**Volume:** `m4s0kwo4kc4oooocck4sswc4-anarchist-library`
- **Driver:** local
- **Purpose:** Anarchist Library markdown documents and media (24,643 texts)
- **Size:** ~1.3 GB
- **Mounted In:** m4s0kwo4kc4oooocck4sswc4 (Veritable Games app)
- **Mount Path:** `/app/frontend/public/content/anarchist/` (inferred)
- **Backup Priority:** **HIGH** - User-generated content archive
- **Backup Frequency:** Weekly

**Volume:** `m4s0kwo4kc4oooocck4sswc4-marxists-library`
- **Driver:** local
- **Purpose:** Marxists.org library documents
- **Size:** ~236 MB (6,584 texts, scraping in progress)
- **Mounted In:** m4s0kwo4kc4oooocck4sswc4
- **Mount Path:** `/app/frontend/public/content/marxists/` (inferred)
- **Backup Priority:** **HIGH** - Growing content archive
- **Backup Frequency:** Weekly

**Volume:** `m4s0kwo4kc4oooocck4sswc4-veritable-gallery`
- **Driver:** local
- **Purpose:** User-uploaded gallery images
- **Mounted In:** m4s0kwo4kc4oooocck4sswc4
- **Mount Path:** `/app/frontend/public/uploads/gallery/` (inferred)
- **Backup Priority:** **CRITICAL** - User-generated content
- **Backup Frequency:** Daily

**Volume:** `m4s0kwo4kc4oooocck4sswc4-veritable-news`
- **Driver:** local
- **Purpose:** News article images and media
- **Mounted In:** m4s0kwo4kc4oooocck4sswc4
- **Mount Path:** `/app/frontend/public/uploads/news/` (inferred)
- **Backup Priority:** **CRITICAL** - User-generated content
- **Backup Frequency:** Daily

**Volume:** `m4s0kwo4kc4oooocck4sswc4-veritable-user-uploads`
- **Driver:** local
- **Purpose:** General user uploads (avatars, attachments, etc.)
- **Mounted In:** m4s0kwo4kc4oooocck4sswc4
- **Mount Path:** `/app/frontend/public/uploads/` (inferred)
- **Backup Priority:** **CRITICAL** - User-generated content
- **Backup Frequency:** Daily

**Volume:** `m4s0kwo4kc4oooocck4sswc4-veritable-wiki`
- **Driver:** local
- **Purpose:** Wiki markdown files and media
- **Mounted In:** m4s0kwo4kc4oooocck4sswc4
- **Mount Path:** `/app/frontend/content/wiki/` (inferred)
- **Backup Priority:** **HIGH** - Wiki content (also in git)
- **Backup Frequency:** Weekly (git has source of truth)

---

### Local Development Volumes (Not in Coolify)

**Volume:** `anarchist-library`
- **Purpose:** Local development anarchist library content
- **Used By:** Local docker-compose development environment
- **Note:** Bind mount to `/home/user/projects/veritable-games/resources/data/converted-markdown`

**Volume:** `marxists-library`
- **Purpose:** Local development Marxists.org content
- **Used By:** Local docker-compose development environment

**Volume:** `veritable-gallery`, `veritable-news`, `veritable-user-uploads`, `veritable-wiki`
- **Purpose:** Local development user uploads
- **Used By:** Local docker-compose development environment
- **Note:** These are OLD local dev volumes, not used in production

---

### Database Volumes

**Volume:** `user_postgres_data`
- **Driver:** local
- **Purpose:** Local development PostgreSQL database data
- **Size:** Variable
- **Used By:** Local docker-compose postgres container
- **Backup Priority:** **LOW** - Development only

**Volume:** `user_pgadmin_data`
- **Driver:** local
- **Purpose:** pgAdmin configuration and saved connections
- **Size:** Small (<50 MB)
- **Used By:** veritable-games-pgadmin container
- **Backup Priority:** **LOW** - Recreatable configuration

**Note:** Production PostgreSQL data is stored OUTSIDE Docker volumes - see POSTGRES_PRODUCTION_CONFIG.md

---

### Coolify Infrastructure Volumes

**Volume:** `coolify-db`
- **Driver:** local
- **Purpose:** Coolify PostgreSQL database (applications, settings, users)
- **Mounted In:** coolify-db container
- **Backup Priority:** **CRITICAL** - Contains all Coolify configuration
- **Backup Frequency:** Daily
- **Recovery Impact:** Losing this means reconfiguring all deployments

**Volume:** `coolify-redis`
- **Driver:** local
- **Purpose:** Coolify Redis cache (sessions, queues, cache)
- **Mounted In:** coolify-redis container
- **Backup Priority:** **LOW** - Ephemeral data, auto-regenerates
- **Backup Frequency:** Not needed

**Volume:** `uptime-kuma-data`
- **Driver:** local
- **Purpose:** Uptime monitoring configuration and history
- **Mounted In:** uptime-kuma container
- **Backup Priority:** **MEDIUM** - Useful but recreatable
- **Backup Frequency:** Weekly

---

### BTCPayServer Volumes

**Volume:** `generated_bitcoin_datadir`
- **Purpose:** Bitcoin Core blockchain data
- **Size:** ~600+ GB (full blockchain)
- **Mounted In:** btcpayserver_bitcoind
- **Backup Priority:** **LOW** - Can re-sync from network
- **Note:** Takes days to re-sync, but not unique data

**Volume:** `generated_bitcoin_wallet_datadir`
- **Purpose:** Bitcoin Core wallet data
- **Mounted In:** btcpayserver_bitcoind
- **Backup Priority:** **CRITICAL** - Contains wallet keys
- **Backup Frequency:** After every transaction

**Volume:** `generated_btcpay_datadir`
- **Purpose:** BTCPayServer application data (stores, invoices, users)
- **Mounted In:** generated_btcpayserver_1
- **Backup Priority:** **CRITICAL** - Contains business data
- **Backup Frequency:** Daily

**Volume:** `generated_btcpay_pluginsdir`
- **Purpose:** BTCPayServer plugins
- **Mounted In:** generated_btcpayserver_1
- **Backup Priority:** **LOW** - Can be reinstalled

**Volume:** `generated_clightning_bitcoin_datadir`
- **Purpose:** C-Lightning (Lightning Network) node data
- **Mounted In:** btcpayserver_clightning_bitcoin
- **Backup Priority:** **CRITICAL** - Contains LN channel state
- **Backup Frequency:** After every channel change

**Volume:** `generated_clightning_bitcoin_rtl_datadir`
- **Purpose:** Ride The Lightning UI configuration
- **Mounted In:** generated-bitcoin_rtl-1
- **Backup Priority:** **LOW** - UI config only

**Volume:** `generated_nbxplorer_datadir`
- **Purpose:** NBXplorer blockchain index
- **Mounted In:** generated_nbxplorer_1
- **Backup Priority:** **LOW** - Can be reindexed
- **Note:** Takes hours to reindex, but not unique data

**Volume:** `generated_postgres_datadir`
- **Purpose:** BTCPayServer PostgreSQL database
- **Mounted In:** generated_postgres_1
- **Backup Priority:** **CRITICAL** - Contains BTCPay configuration
- **Backup Frequency:** Daily

**Volume:** `generated_tor_datadir`, `generated_tor_servicesdir`, `generated_tor_torrcdir`
- **Purpose:** Tor configuration and onion services
- **Mounted In:** tor container
- **Backup Priority:** **HIGH** - Contains onion service keys
- **Backup Frequency:** Weekly
- **Note:** Losing this means new .onion addresses

---

## Running Containers

### Veritable Games Application Stack

#### Application Container

**Container:** `m4s0kwo4kc4oooocck4sswc4`
- **ID:** 283893f766e3
- **Image:** `m4s0kwo4kc4oooocck4sswc4:fa1a8aa5e57ec13e929057c15b453c3baa69a61d`
- **Status:** Up 14 seconds (healthy)
- **Networks:** coolify
- **Ports:** Exposed internally, routed through coolify-proxy
- **Volumes:**
  - `m4s0kwo4kc4oooocck4sswc4-anarchist-library`
  - `m4s0kwo4kc4oooocck4sswc4-marxists-library`
  - `m4s0kwo4kc4oooocck4sswc4-veritable-gallery`
  - `m4s0kwo4kc4oooocck4sswc4-veritable-news`
  - `m4s0kwo4kc4oooocck4sswc4-veritable-user-uploads`
  - `m4s0kwo4kc4oooocck4sswc4-veritable-wiki`
- **Environment:** Managed by Coolify (DATABASE_URL, secrets, etc.)
- **Health Check:** `/api/health` endpoint
- **Build:** Nixpacks (Node.js 20, Next.js standalone)
- **Restart Policy:** Always
- **Managed By:** Coolify auto-deployment
- **Public URL:** https://www.veritablegames.com

**Deployment Trigger:** Git push to `main` branch → GitHub webhook → Coolify rebuild

#### PostgreSQL Database

**Container:** `veritable-games-postgres`
- **ID:** 71595bf31622
- **Image:** `postgres:15-alpine`
- **Status:** Up 6 days (healthy)
- **Networks:** coolify, veritable-games-network (DUAL-NETWORK)
- **Ports:** 5432 (internal only, no external exposure)
- **Volumes:** None (data in `/var/lib/docker/volumes/` - needs verification)
- **Database:** `veritable_games`
- **Schemas:** 13 schemas (public, anarchist, shared, library, auth, wiki, forums, etc.)
- **Environment:**
  - POSTGRES_USER=postgres
  - POSTGRES_PASSWORD=postgres (⚠️ Should be changed for production)
  - POSTGRES_DB=veritable_games
- **Health Check:** `pg_isready -U postgres`
- **Restart Policy:** Always
- **Backup:** See POSTGRES_PRODUCTION_CONFIG.md

**Important:** This container is on TWO networks:
1. `coolify` - Allows Coolify-deployed apps to connect
2. `veritable-games-network` - Allows local development tools to connect

#### pgAdmin Web Interface

**Container:** `veritable-games-pgadmin`
- **ID:** b099870d39e9
- **Image:** `dpage/pgadmin4:latest`
- **Status:** Up 6 days
- **Networks:** veritable-games-network
- **Ports:** 5050:80 (accessible at http://192.168.1.15:5050)
- **Volume:** user_pgadmin_data
- **Environment:**
  - PGADMIN_DEFAULT_EMAIL=admin@veritablegames.com
  - PGADMIN_DEFAULT_PASSWORD=admin (⚠️ Weak password)
- **Purpose:** Database administration UI
- **Access:** Local network only (not publicly exposed)

---

### Coolify Platform Containers

#### Coolify Main Application

**Container:** `coolify`
- **ID:** 19a8d5795f39
- **Image:** `ghcr.io/coollabsio/coolify:4.0.0-beta.444`
- **Status:** Up 4 days (healthy)
- **Networks:** coolify
- **Ports:** 8000:80 (accessible at http://192.168.1.15:8000)
- **Purpose:** Deployment platform UI and API
- **Environment:** Complex Coolify configuration
- **Health Check:** HTTP endpoint check
- **Restart Policy:** Always

#### Coolify Database

**Container:** `coolify-db`
- **ID:** 88ba5ba4f716
- **Image:** `postgres:15-alpine`
- **Status:** Up 4 days (healthy)
- **Networks:** coolify
- **Volume:** coolify-db
- **Purpose:** Stores Coolify applications, settings, users, deployments
- **Backup Priority:** CRITICAL
- **Restart Policy:** Always

#### Coolify Redis Cache

**Container:** `coolify-redis`
- **ID:** 49fdb455b33d
- **Image:** `redis:7-alpine`
- **Status:** Up 4 days (healthy)
- **Networks:** coolify
- **Volume:** coolify-redis
- **Purpose:** Session storage, queue management, cache
- **Restart Policy:** Always

#### Coolify Realtime

**Container:** `coolify-realtime`
- **ID:** d819cca45f8b
- **Image:** `ghcr.io/coollabsio/coolify-realtime:1.0.10`
- **Status:** Up 4 days (healthy)
- **Networks:** coolify
- **Purpose:** WebSocket server for real-time UI updates
- **Restart Policy:** Always

#### Coolify Reverse Proxy (Traefik)

**Container:** `coolify-proxy`
- **ID:** 791c775a9f28
- **Image:** `traefik:v3.1`
- **Status:** Up 6 days (healthy)
- **Networks:** coolify
- **Ports:** 80:80, 443:443, 8080:8080
- **Purpose:** Reverse proxy, SSL termination, routing
- **Config:** Dynamic configuration from Coolify
- **Restart Policy:** Always
- **Manages:** All public-facing HTTPS traffic

#### Coolify Sentinel

**Container:** `coolify-sentinel`
- **ID:** 3efc8246ee9a
- **Image:** `ghcr.io/coollabsio/sentinel:0.0.16`
- **Status:** Up 38 minutes (healthy)
- **Networks:** bridge
- **Purpose:** Health monitoring and alerting
- **Restart Policy:** Always

---

### Uptime Monitoring

**Container:** `uptime-kuma`
- **ID:** 189898ac5764
- **Image:** `louislam/uptime-kuma:latest`
- **Status:** Up 6 days (healthy)
- **Networks:** coolify
- **Volume:** uptime-kuma-data
- **Ports:** Exposed via coolify-proxy
- **Purpose:** Service uptime monitoring and status pages
- **Restart Policy:** Always

---

### BTCPayServer Stack (8 Containers)

#### BTCPayServer Application

**Container:** `generated_btcpayserver_1`
- **ID:** 32d1c4622c89
- **Image:** `btcpayserver/btcpayserver:2.2.1`
- **Status:** Up 26 hours
- **Networks:** coolify, generated_default (DUAL-NETWORK)
- **Volumes:** generated_btcpay_datadir, generated_btcpay_pluginsdir
- **Purpose:** Bitcoin payment processor UI and API
- **Public URL:** Routed through coolify-proxy
- **Restart Policy:** Always

#### Bitcoin Core Node

**Container:** `btcpayserver_bitcoind`
- **ID:** 471b6a74fbc7
- **Image:** `btcpayserver/bitcoin:29.1`
- **Status:** Up 26 hours
- **Networks:** generated_default
- **Volume:** generated_bitcoin_datadir (~600 GB blockchain)
- **Purpose:** Full Bitcoin node (validation, mempool, wallet)
- **Ports:** 8332 (RPC), 8333 (P2P)
- **Restart Policy:** Always

#### C-Lightning Node

**Container:** `btcpayserver_clightning_bitcoin`
- **ID:** 51e73c6d2af2
- **Image:** `btcpayserver/lightning:v25.05`
- **Status:** Up 26 hours
- **Networks:** generated_default
- **Volume:** generated_clightning_bitcoin_datadir
- **Purpose:** Lightning Network node (instant payments)
- **Restart Policy:** Always

#### Ride The Lightning (LN Management UI)

**Container:** `generated-bitcoin_rtl-1`
- **ID:** 4bce598094f4
- **Image:** `shahanafarooqui/rtl:v0.15.4`
- **Status:** Up 26 hours
- **Networks:** generated_default
- **Volume:** generated_clightning_bitcoin_rtl_datadir
- **Purpose:** Web UI for managing Lightning channels
- **Restart Policy:** Always

#### NBXplorer (Blockchain Indexer)

**Container:** `generated_nbxplorer_1`
- **ID:** a79074653a23
- **Image:** `nicolasdorier/nbxplorer:2.5.30-1`
- **Status:** Up 26 hours
- **Networks:** generated_default
- **Volume:** generated_nbxplorer_datadir
- **Purpose:** Indexes blockchain for BTCPay queries (addresses, transactions)
- **Restart Policy:** Always

#### Tor Proxy

**Container:** `tor`
- **ID:** afe11e529c19
- **Image:** `btcpayserver/tor:0.4.8.10`
- **Status:** Up 26 hours
- **Networks:** generated_default
- **Volumes:** generated_tor_datadir, generated_tor_servicesdir, generated_tor_torrcdir
- **Purpose:** Provides .onion addresses for privacy
- **Restart Policy:** Always

#### Tor Configuration Generator

**Container:** `tor-gen`
- **ID:** 751d6e575354
- **Image:** `btcpayserver/docker-gen:0.10.7`
- **Status:** Up 26 hours
- **Networks:** generated_default
- **Purpose:** Generates Tor configuration from templates
- **Restart Policy:** Always

#### BTCPay PostgreSQL Database

**Container:** `generated_postgres_1`
- **ID:** b0649fece28e
- **Image:** `btcpayserver/postgres:13.18`
- **Status:** Up 26 hours
- **Networks:** generated_default
- **Volume:** generated_postgres_datadir
- **Purpose:** Stores BTCPay application data (stores, invoices, users)
- **Backup Priority:** CRITICAL
- **Restart Policy:** Always

---

## Container Dependencies

### Veritable Games Dependency Chain

```
coolify-proxy (Traefik)
  └─> m4s0kwo4kc4oooocck4sswc4 (VG App)
        └─> veritable-games-postgres (Database)
              └─> [No dependencies]
        └─> [Volumes: anarchist, marxists, gallery, news, uploads, wiki]

veritable-games-pgadmin (Admin UI)
  └─> veritable-games-postgres (Database)
```

**Start Order:**
1. veritable-games-postgres (database first)
2. m4s0kwo4kc4oooocck4sswc4 (app depends on database)
3. veritable-games-pgadmin (admin tool, optional)
4. coolify-proxy (already running, routes traffic)

### Coolify Platform Dependency Chain

```
coolify-db (PostgreSQL) ─┐
coolify-redis (Cache)    ├─> coolify (Main App)
                         │     └─> coolify-realtime (WebSocket)
                         │           └─> [Deployed apps get routed]
                         │
coolify-proxy (Traefik) ─┘
  └─> [Routes all HTTPS traffic to apps]

coolify-sentinel (Monitor)
  └─> [Monitors all containers]
```

**Start Order:**
1. coolify-db, coolify-redis (data stores first)
2. coolify (main platform)
3. coolify-realtime (WebSocket server)
4. coolify-proxy (reverse proxy)
5. coolify-sentinel (monitoring)

### BTCPayServer Dependency Chain

```
generated_postgres_1 (Database) ─┐
                                 │
btcpayserver_bitcoind (Bitcoin)  ├─> generated_btcpayserver_1 (BTCPay)
  └─> generated_nbxplorer_1 (Indexer)   └─> coolify-proxy (Routing)
        └─> [Indexes blockchain]
                                 │
btcpayserver_clightning_bitcoin ─┤
  └─> generated-bitcoin_rtl-1 (UI)
                                 │
tor-gen (Config) ────────────────┤
  └─> tor (Proxy) ───────────────┘
```

**Start Order:**
1. generated_postgres_1 (BTCPay database)
2. btcpayserver_bitcoind (Bitcoin node)
3. generated_nbxplorer_1 (blockchain indexer, needs bitcoind)
4. btcpayserver_clightning_bitcoin (Lightning node, needs bitcoind)
5. tor-gen, tor (Tor services)
6. generated-bitcoin_rtl-1 (Lightning UI, needs clightning)
7. generated_btcpayserver_1 (BTCPay main app, needs all services)

---

## Port Mappings

### Publicly Exposed Ports (via coolify-proxy / Traefik)

| Port | Protocol | Service | Access | Notes |
|------|----------|---------|--------|-------|
| 80 | HTTP | coolify-proxy | Public | Redirects to HTTPS |
| 443 | HTTPS | coolify-proxy | Public | All public sites route here |
| 8080 | HTTP | Traefik Dashboard | Internal | Monitoring only |

**Routed Domains** (all via port 443):
- `www.veritablegames.com` → m4s0kwo4kc4oooocck4sswc4
- `veritablegames.com` → (redirect to www)
- BTCPay domain → generated_btcpayserver_1
- Uptime Kuma domain → uptime-kuma
- (Coolify manages routing dynamically)

### Local Network Ports (192.168.1.15:PORT)

| Port | Service | Container | Access | Notes |
|------|---------|-----------|--------|-------|
| 8000 | Coolify UI | coolify | LAN | Deployment platform |
| 5050 | pgAdmin | veritable-games-pgadmin | LAN | Database admin |
| 5432 | PostgreSQL | veritable-games-postgres | LAN | Database access |

### Internal Container Ports (No External Access)

| Port | Service | Container | Notes |
|------|---------|-----------|-------|
| 5432 | PostgreSQL | coolify-db | Coolify's database |
| 6379 | Redis | coolify-redis | Coolify's cache |
| 3000 | Next.js | m4s0kwo4kc4oooocck4sswc4 | Proxied by Traefik |
| 5432 | PostgreSQL | generated_postgres_1 | BTCPay database |
| 8332 | Bitcoin RPC | btcpayserver_bitcoind | Bitcoin Core RPC |
| 8333 | Bitcoin P2P | btcpayserver_bitcoind | Blockchain sync |
| 9735 | Lightning | btcpayserver_clightning_bitcoin | LN network |
| 9050 | SOCKS5 Proxy | tor | Tor proxy |

---

## Data Flow Diagram

### Veritable Games Application Flow

```
User (Browser)
  │
  ├─> HTTPS (443) → coolify-proxy (Traefik)
  │                     │
  │                     └─> TLS Termination
  │                           │
  │                           └─> Route: www.veritablegames.com
  │                                 │
  └───────────────────────────────> m4s0kwo4kc4oooocck4sswc4
                                      │  (Next.js App)
                                      │
                                      ├─> Read/Write PostgreSQL
                                      │     │
                                      │     └─> veritable-games-postgres
                                      │           (13 schemas, 170+ tables)
                                      │
                                      └─> Read/Write File Volumes
                                            ├─> anarchist-library (24,643 texts)
                                            ├─> marxists-library (6,584 texts)
                                            ├─> gallery uploads
                                            ├─> news uploads
                                            ├─> user uploads
                                            └─> wiki files
```

### Coolify Deployment Flow

```
Developer (Local)
  │
  └─> git push origin main
        │
        └─> GitHub (remote repository)
              │
              └─> Webhook → http://192.168.1.15:8000/webhooks/...
                              │
                              └─> coolify (receives webhook)
                                    │
                                    ├─> Clone repo
                                    ├─> Nixpacks build (Node.js 20)
                                    ├─> Create Docker image
                                    ├─> Tag: m4s0kwo4kc4oooocck4sswc4:COMMIT_HASH
                                    └─> Deploy container
                                          │
                                          └─> m4s0kwo4kc4oooocck4sswc4
                                                │
                                                └─> Health check /api/health
                                                      │
                                                      ├─> Success → Route traffic
                                                      └─> Failure → Keep old container
```

---

## Recovery Procedures

### Critical Container Recovery

**If `m4s0kwo4kc4oooocck4sswc4` (VG App) crashes:**
1. Check logs: `docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100`
2. Check database connection: `docker exec veritable-games-postgres psql -U postgres -c "SELECT 1;"`
3. Redeploy via Coolify: `coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4`
4. Or push to GitHub to trigger webhook deployment

**If `veritable-games-postgres` (Database) crashes:**
1. ⚠️ **CRITICAL** - This takes down the entire application
2. Check logs: `docker logs veritable-games-postgres --tail 100`
3. Restart container: `docker restart veritable-games-postgres`
4. Verify data integrity: See POSTGRES_PRODUCTION_CONFIG.md
5. Check `/home/user/backups/` for recent database backups
6. If data corruption, restore from backup: See POSTGRES_PRODUCTION_CONFIG.md

**If `coolify` (Platform) crashes:**
1. Check logs: `docker logs coolify --tail 100`
2. Restart: `docker restart coolify coolify-db coolify-redis`
3. Verify web UI accessible: http://192.168.1.15:8000
4. Check deployed applications still running
5. If database corrupted, restore from backup: See VOLUME_BACKUP_STRATEGY.md

---

## Maintenance Commands

### View All Infrastructure

```bash
# Networks
docker network ls

# Volumes
docker volume ls

# Containers (running)
docker ps

# Containers (all, including stopped)
docker ps -a

# Container details
docker inspect <container_name>

# Volume details
docker volume inspect <volume_name>

# Network details
docker network inspect <network_name>
```

### Health Checks

```bash
# Check all container health
docker ps --format "table {{.Names}}\t{{.Status}}"

# Check specific container logs
docker logs <container_name> --tail 100 --follow

# Check container resource usage
docker stats

# Check disk usage
docker system df
docker system df -v  # Verbose (shows all volumes)
```

### Network Troubleshooting

```bash
# Test container-to-container connectivity
docker exec m4s0kwo4kc4oooocck4sswc4 ping veritable-games-postgres

# Check which containers are on a network
docker network inspect veritable-games-network | grep -A 10 "Containers"

# Test database connection from app container
docker exec m4s0kwo4kc4oooocck4sswc4 \
  psql postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games -c "SELECT 1;"
```

---

## Notes

- Container IDs and image SHAs change with each deployment
- Volume names prefixed with `m4s0kwo4kc4oooocck4sswc4-` are Coolify-managed production volumes
- Volume names prefixed with `generated_` are BTCPayServer docker-compose volumes
- Volumes without prefixes are local development volumes
- The `veritable-games-postgres` container is unique in being on TWO networks simultaneously
- Coolify automatically manages container lifecycle, DNS, SSL certificates, and routing
- All public HTTPS traffic flows through coolify-proxy (Traefik)

---

## See Also

- [POSTGRES_PRODUCTION_CONFIG.md](./POSTGRES_PRODUCTION_CONFIG.md) - PostgreSQL setup and backup
- [VOLUME_BACKUP_STRATEGY.md](./VOLUME_BACKUP_STRATEGY.md) - Volume backup procedures
- [/home/user/CLAUDE.md](../../CLAUDE.md) - Server-level documentation
- [Coolify Documentation](https://coolify.io/docs)
- [Traefik Documentation](https://doc.traefik.io/traefik/)
