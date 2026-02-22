# Machine Identification Guide

**BEFORE running ANY commands, determine which machine you're on:**

```bash
hostname && hostname -I | awk '{print $1}'
```

---

## Machine Overview

| Machine | Hostname | IP | Git Repo Path | SSH To Other Machine |
|---------|----------|-----|---------------|---------------------|
| **Laptop** | remote | 192.168.1.175 | `/home/user/Projects/veritable-games-main` | `ssh user@192.168.1.15` |
| **Server** | veritable-games-server | 192.168.1.15 | `/home/user/veritable-games-site` | `ssh user@192.168.1.175` |

**Password for both machines**: `Atochastertl25!` (sudo and SSH)

---

## Quick Validation Command

```bash
# Run this to see where you are:
if [ "$(hostname)" = "remote" ]; then
  echo "📱 LAPTOP (192.168.1.175)"
  echo "   Git: /home/user/Projects/veritable-games-main"
  echo "   SSH to server: ssh user@192.168.1.15"
elif [ "$(hostname)" = "veritable-games-server" ]; then
  echo "🖥️  SERVER (192.168.1.15)"
  echo "   Git: /home/user/veritable-games-site"
  echo "   SSH to laptop: ssh user@192.168.1.175"
  echo "   Container: m4s0kwo4kc4oooocck4sswc4"
fi
```

---

## Laptop Configuration (192.168.1.175)

### System Information

- **Hostname**: `remote`
- **IP Address**: `192.168.1.175`
- **Operating System**: Linux (Ubuntu/Debian-based)
- **Primary Use**: Development and testing

### Git Repository

- **Location**: `/home/user/Projects/veritable-games-main`
- **Remote**: `https://github.com/Veritable-Games/veritable-games-site.git` (HTTPS via GitHub CLI)
- **Authentication**: GitHub CLI (`gh auth`)

### Development Environment

- **Node.js**: For frontend development
- **npm**: Package manager
- **SQLite**: Development database (file-based)
- **Working Directory**: `/home/user/Projects/veritable-games-main/frontend/`

### Tools Installed

- **Coolify CLI**: `~/.local/bin/coolify`
- **GitHub CLI**: `gh`
- **Docker**: Available for local testing (optional)

### Command Execution Rules

**If you're on the LAPTOP:**
- ✅ Run commands directly
- ✅ Git repo: `/home/user/Projects/veritable-games-main`
- ✅ Database: SQLite in `frontend/data/*.db`
- ✅ Access server: `ssh user@192.168.1.15`
- ✅ Coolify CLI configured
- ✅ Development workflow: `npm run dev` → test → commit → push

### Environment Variables (Development)

```bash
# Location: frontend/.env.local
NODE_ENV=development
DATABASE_URL=file:./data/database.db  # SQLite for dev
SESSION_SECRET=<generated>
CSRF_SECRET=<generated>
ENCRYPTION_KEY=<generated>
```

---

## Server Configuration (192.168.1.15)

### System Information

- **Hostname**: `veritable-games-server`
- **IP Address**: `192.168.1.15`
- **Operating System**: Linux (Ubuntu/Debian-based)
- **Primary Use**: Production hosting and deployment

### Git Repository

- **Location**: `/home/user/veritable-games-site`
- **Remote**: `git@github.com:Veritable-Games/veritable-games-site.git` (SSH)
- **Authentication**: SSH key (`~/.ssh/id_ed25519`)

### Production Environment

- **PostgreSQL**: Production database (Docker container)
- **Coolify**: Deployment platform (port 8000)
- **Application Container**: `m4s0kwo4kc4oooocck4sswc4`
- **Public Access**: http://192.168.1.15:3000

### Tools Installed

- **Coolify CLI**: `~/.local/bin/coolify`
- **Docker**: Container runtime
- **PostgreSQL Client**: For database access

### Command Execution Rules

**If you're on the SERVER:**
- ✅ Run commands directly
- ✅ Git repo: `/home/user/veritable-games-site`
- ✅ Database: PostgreSQL (container)
- ✅ Access laptop: `ssh user@192.168.1.175`
- ✅ Coolify CLI configured
- ✅ Production database: PostgreSQL (container)
- ✅ Production app: Docker container `m4s0kwo4kc4oooocck4sswc4`
- ✅ Deployment workflow: commit → push → Coolify auto-deploy

### Environment Variables (Production)

```bash
# Stored in Coolify (http://192.168.1.15:8000)
NODE_ENV=production
POSTGRES_URL=postgresql://user:pass@postgres:5432/veritable_games
DATABASE_URL=postgresql://user:pass@postgres:5432/veritable_games
SESSION_SECRET=<production-secret>
CSRF_SECRET=<production-secret>
ENCRYPTION_KEY=<production-secret>
```

### Container Information

**Application Container**:
- **ID**: `m4s0kwo4kc4oooocck4sswc4`
- **Port**: 3000
- **Managed by**: Coolify

**Database Container**:
- **Type**: PostgreSQL 15
- **Port**: 5432 (internal)
- **Managed by**: Coolify

---

## Network Topology

```
                  Home Network (192.168.1.0/24)
                            |
            +---------------+----------------+
            |                                |
    Laptop (remote)                Server (veritable-games-server)
    192.168.1.175                   192.168.1.15
            |                                |
            +--------> SSH <-----------------+
            |                                |
            +----> WireGuard VPN <-----------+
            |    (10.100.0.0/24)             |
            |                                |
    Development Repo               Production Repo
    SQLite Database               PostgreSQL Database
                                  Docker Containers
                                  Coolify Platform
```

---

## WireGuard VPN Connectivity

### Private VPN Tunnel (10.100.0.0/24)

Both machines are connected via a private WireGuard tunnel for secure communication.

**Server VPN**:
- Interface: `wg0`
- VPN IP: `10.100.0.1/24`
- Port: `51820`

**Laptop VPN**:
- Interface: `wg0_laptop`
- VPN IP: `10.100.0.2/24`
- Port: `44780`

### SSH Access via VPN

```bash
# Server → Laptop (via VPN)
ssh user@10.100.0.2

# Laptop → Server (via VPN)
ssh user@10.100.0.1
```

**See**: [WIREGUARD_PROTECTION_AND_RECOVERY.md](../server/WIREGUARD_PROTECTION_AND_RECOVERY.md) for complete VPN documentation.

---

## Determining Current Machine

### Method 1: hostname

```bash
hostname
# Laptop: remote
# Server: veritable-games-server
```

### Method 2: IP Address

```bash
hostname -I | awk '{print $1}'
# Laptop: 192.168.1.175
# Server: 192.168.1.15
```

### Method 3: Check for Production Container

```bash
docker ps | grep m4s0k
# If output: You're on the SERVER
# If error: You're on the LAPTOP (or Docker not running)
```

### Method 4: Check Git Remote

```bash
git remote -v
# HTTPS remote: Likely LAPTOP
# SSH remote (git@github.com): Likely SERVER
```

### Method 5: Check Repository Path

```bash
pwd
# Contains /Projects/veritable-games-main: LAPTOP
# Contains /veritable-games-site: SERVER
```

---

## Common Commands by Machine

### Laptop-Specific Commands

```bash
# Start development server
cd ~/Projects/veritable-games-main/frontend
npm run dev

# Run type checks
npm run type-check

# Database health check (SQLite)
npm run db:health

# SSH to server
ssh user@192.168.1.15

# Deploy via Coolify CLI
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4
```

### Server-Specific Commands

```bash
# Check production container
docker ps | grep m4s0k

# View production logs
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100

# Check deployed commit
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep SOURCE_COMMIT

# Access PostgreSQL database
docker exec -it <postgres-container-id> psql -U user -d veritable_games

# SSH to laptop
ssh user@192.168.1.175

# Deploy via Coolify CLI
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4
```

---

## Database Differences

| Aspect | Laptop (Development) | Server (Production) |
|--------|---------------------|---------------------|
| **Type** | SQLite (file-based) | PostgreSQL 15 (container) |
| **Location** | `frontend/data/*.db` | Docker container |
| **Access** | Direct file access | via Docker exec or psql client |
| **Schema** | 10 separate databases | 13 PostgreSQL schemas |
| **Persistence** | Local files | Container volumes |
| **Users** | Test accounts | Production accounts |

**Important**: Passwords set on laptop do NOT sync to production automatically.

**See**: [DATABASE_ENVIRONMENTS.md](../database/DATABASE_ENVIRONMENTS.md) for complete database documentation.

---

## File Paths Reference

### Laptop File Paths

```
/home/user/
├── Projects/
│   └── veritable-games-main/         # Git repository
│       ├── frontend/                 # Development work here
│       │   ├── data/                # SQLite databases
│       │   ├── src/                 # Source code
│       │   ├── package.json
│       │   └── .env.local           # Environment variables
│       ├── docs/                    # Documentation
│       └── CLAUDE.md                # This guide
└── .local/bin/coolify              # Coolify CLI
```

### Server File Paths

```
/home/user/
├── veritable-games-site/            # Git repository
│   ├── frontend/                    # Deployed code
│   └── docs/
├── wireguard-backups/               # WireGuard config backups
│   ├── verify-wg-tunnel.sh
│   └── backup-wg-config.sh
└── .local/bin/coolify              # Coolify CLI
```

---

## Troubleshooting

### Can't determine which machine

```bash
# Run comprehensive check
echo "Hostname: $(hostname)"
echo "IP: $(hostname -I | awk '{print $1}')"
echo "Repo path: $(pwd)"
echo "Git remote: $(git remote -v | head -n 1)"
echo "Docker: $(docker ps &>/dev/null && echo 'Available' || echo 'Not available')"
```

### Wrong machine for task

**Symptoms**: Command fails because you're on the wrong machine

**Solution**:
1. Identify current machine: `hostname`
2. SSH to correct machine:
   - From laptop: `ssh user@192.168.1.15`
   - From server: `ssh user@192.168.1.175`
3. Navigate to correct repository
4. Run command again

### SSH connection refused

**Symptoms**: `ssh: connect to host ... port 22: Connection refused`

**Diagnostic Steps**:

```bash
# Check network connectivity
ping 192.168.1.15  # or 192.168.1.175

# Try VPN connection instead
ping 10.100.0.1   # Server via VPN
ping 10.100.0.2   # Laptop via VPN
ssh user@10.100.0.1  # or 10.100.0.2
```

---

## Related Documentation

- **[DUAL_MACHINE_DEVELOPMENT.md](./DUAL_MACHINE_DEVELOPMENT.md)** - Git workflow between machines
- **[COOLIFY_CLI_GUIDE.md](../deployment/COOLIFY_CLI_GUIDE.md)** - Deployment commands
- **[DATABASE_ENVIRONMENTS.md](../database/DATABASE_ENVIRONMENTS.md)** - Database differences
- **[WIREGUARD_PROTECTION_AND_RECOVERY.md](../server/WIREGUARD_PROTECTION_AND_RECOVERY.md)** - VPN configuration

---

**Last Updated**: November 16, 2025
