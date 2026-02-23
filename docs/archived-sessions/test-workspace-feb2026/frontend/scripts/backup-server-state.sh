#!/bin/bash
# Backup script for Veritable Games production server
# Run this regularly to backup everything not in git

BACKUP_DIR="$HOME/veritable-games-backups/$(date +%Y-%m-%d_%H-%M-%S)"
mkdir -p "$BACKUP_DIR"

echo "=== Veritable Games Server Backup ==="
echo "Backup location: $BACKUP_DIR"
echo ""

# 1. Backup Coolify environment variables
echo "1. Backing up Coolify environment variables..."
ssh user@192.168.1.15 "docker exec coolify-db pg_dump -U coolify -d coolify -t environment_variables --data-only --column-inserts" > "$BACKUP_DIR/coolify-env-vars.sql"
echo "   ✓ Saved to coolify-env-vars.sql"

# 2. Backup PostgreSQL database
echo "2. Backing up PostgreSQL database..."
ssh user@192.168.1.15 "docker exec veritable-games-postgres pg_dump -U postgres veritable_games" > "$BACKUP_DIR/postgres-database.sql"
echo "   ✓ Saved to postgres-database.sql"

# 3. Backup environment variables as readable text
echo "3. Exporting environment variables (readable format)..."
ssh user@192.168.1.15 "docker exec coolify-db psql -U coolify -d coolify -c \"SELECT key, value, is_buildtime, is_runtime FROM environment_variables WHERE resourceable_type LIKE '%Application' AND resourceable_id = 1 ORDER BY key;\"" > "$BACKUP_DIR/env-vars-readable.txt"
echo "   ✓ Saved to env-vars-readable.txt"

# 4. Backup secrets (encrypted values need to be decrypted on restore)
echo "4. Extracting critical secrets..."
cat > "$BACKUP_DIR/SECRETS.txt" << 'EOF'
⚠️ CRITICAL SECRETS ⚠️

These values are stored encrypted in Coolify's database.
You MUST extract the actual decrypted values from the running container:

To get actual values, run on the production server:
  docker inspect m4s0kwo4kc4oooocck4sswc4 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E 'SESSION_SECRET|ENCRYPTION_KEY|CSRF_SECRET|DATABASE_URL|POSTGRES_URL'

Store these values in a secure password manager!
EOF
echo "   ✓ Created SECRETS.txt with instructions"

# 5. Backup uploaded files (if they exist)
echo "5. Backing up uploaded files..."
if ssh user@192.168.1.15 "docker volume ls | grep -q veritable-games-uploads"; then
    ssh user@192.168.1.15 "docker run --rm -v veritable-games-uploads:/data -v /tmp:/backup alpine tar czf /backup/uploads.tar.gz /data"
    scp user@192.168.1.15:/tmp/uploads.tar.gz "$BACKUP_DIR/"
    echo "   ✓ Saved to uploads.tar.gz"
else
    echo "   ⚠️  No uploads volume found (files may be in container)"
fi

# 6. Backup Coolify configuration
echo "6. Backing up Coolify configuration..."
ssh user@192.168.1.15 "docker exec coolify-db pg_dump -U coolify -d coolify -t applications -t sources --data-only --column-inserts" > "$BACKUP_DIR/coolify-config.sql"
echo "   ✓ Saved to coolify-config.sql"

# 7. Create restore instructions
cat > "$BACKUP_DIR/RESTORE_INSTRUCTIONS.md" << 'EOF'
# Restore Instructions

## Prerequisites
- New server with Coolify installed
- PostgreSQL 15 container running
- Git repository cloned

## Steps to Restore

### 1. Restore PostgreSQL Database
```bash
# Copy backup to new server
scp postgres-database.sql user@NEW_SERVER:/tmp/

# Restore database
ssh user@NEW_SERVER "docker exec -i veritable-games-postgres psql -U postgres -d veritable_games < /tmp/postgres-database.sql"
```

### 2. Restore Environment Variables in Coolify
```bash
# Copy backup to new server
scp coolify-env-vars.sql user@NEW_SERVER:/tmp/

# Restore to Coolify database
ssh user@NEW_SERVER "docker exec -i coolify-db psql -U coolify -d coolify < /tmp/coolify-env-vars.sql"
```

### 3. Create PostgreSQL container with same credentials
```bash
docker run -d \
  --name veritable-games-postgres \
  --network coolify \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=veritable_games \
  -p 5432:5432 \
  postgres:15-alpine
```

### 4. Configure Coolify Application
- Create new application in Coolify
- Point to GitHub repository: Veritable-Games/veritable-games-site
- Set base directory: `frontend`
- Environment variables will be restored from backup

### 5. Deploy
Click "Deploy" in Coolify - it will use restored environment variables.

## Critical Notes
- SESSION_SECRET, ENCRYPTION_KEY must match exactly or users can't log in
- DATABASE_URL must point to the restored PostgreSQL container
- Check SECRETS.txt for actual decrypted values
EOF

echo ""
echo "=== Backup Complete ==="
echo "Location: $BACKUP_DIR"
echo ""
echo "⚠️  CRITICAL: Extract actual secret values from running container:"
echo "   ssh user@192.168.1.15 \"docker inspect m4s0kwo4kc4oooocck4sswc4 --format '{{range .Config.Env}}{{println .}}{{end}}'\" > $BACKUP_DIR/actual-env-vars.txt"
echo ""
echo "Store these in a secure password manager!"
