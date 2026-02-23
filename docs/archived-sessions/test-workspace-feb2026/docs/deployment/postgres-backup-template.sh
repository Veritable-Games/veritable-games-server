#!/bin/bash

################################################################################
# PostgreSQL Backup Script for Veritable Games
#
# This script backs up the PostgreSQL database running in Docker and manages
# retention of backups.
#
# Installation:
#   sudo cp postgres-backup-template.sh /opt/veritable-games-backup.sh
#   sudo chmod +x /opt/veritable-games-backup.sh
#   sudo chown root:root /opt/veritable-games-backup.sh
#
# Schedule with cron (daily at 2 AM):
#   sudo crontab -e
#   Add: 0 2 * * * /opt/veritable-games-backup.sh >> /var/log/veritable-games-backup.log 2>&1
#
# Manual run:
#   sudo /opt/veritable-games-backup.sh
#
################################################################################

set -euo pipefail

# Configuration
BACKUP_DIR="/var/backups/veritable-games"
CONTAINER_NAME="veritable-games-postgres"
DATABASE_NAME="veritable_games"
POSTGRES_USER="postgres"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/veritable-games-${TIMESTAMP}.sql.gz"
LOG_FILE="/var/log/veritable-games-backup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Error handler
error_exit() {
    log_error "$1"
    exit 1
}

################################################################################
# Pre-flight Checks
################################################################################

log "Starting PostgreSQL backup for Veritable Games"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   error_exit "This script must be run as root (use sudo)"
fi

# Check if Docker is running
if ! systemctl is-active --quiet docker; then
    error_exit "Docker daemon is not running"
fi

# Check if PostgreSQL container exists
if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    error_exit "PostgreSQL container '${CONTAINER_NAME}' not found"
fi

# Check if PostgreSQL container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    error_exit "PostgreSQL container '${CONTAINER_NAME}' is not running"
fi

# Create backup directory if it doesn't exist
if [[ ! -d "$BACKUP_DIR" ]]; then
    log "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR" || error_exit "Failed to create backup directory"
    chmod 700 "$BACKUP_DIR"
fi

################################################################################
# Database Health Check
################################################################################

log "Checking PostgreSQL health..."

if ! docker exec "$CONTAINER_NAME" pg_isready -U "$POSTGRES_USER" > /dev/null 2>&1; then
    error_exit "PostgreSQL is not ready to accept connections"
fi

# Get database size
DB_SIZE=$(docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$DATABASE_NAME" -t -c "SELECT pg_size_pretty(pg_database_size('${DATABASE_NAME}'));" 2>/dev/null | xargs)

if [[ -z "$DB_SIZE" ]]; then
    error_exit "Failed to get database size - database may not exist"
fi

log "Database size: $DB_SIZE"

################################################################################
# Perform Backup
################################################################################

log "Starting backup to: $BACKUP_FILE"

# Perform backup with pg_dump
if docker exec "$CONTAINER_NAME" pg_dump -U "$POSTGRES_USER" "$DATABASE_NAME" 2>/dev/null | gzip > "$BACKUP_FILE"; then
    log_success "Backup completed successfully"
else
    error_exit "Backup failed"
fi

# Verify backup file was created and has content
if [[ ! -f "$BACKUP_FILE" ]]; then
    error_exit "Backup file was not created"
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
BACKUP_SIZE_BYTES=$(stat -c%s "$BACKUP_FILE")

if [[ $BACKUP_SIZE_BYTES -lt 1000 ]]; then
    log_error "Backup file is suspiciously small (${BACKUP_SIZE})"
    log_error "This may indicate a backup failure"
    exit 1
fi

log_success "Backup file size: $BACKUP_SIZE"

# Set permissions
chmod 600 "$BACKUP_FILE"

################################################################################
# Verify Backup Integrity
################################################################################

log "Verifying backup integrity..."

if gunzip -t "$BACKUP_FILE" 2>/dev/null; then
    log_success "Backup file integrity verified (gzip valid)"
else
    error_exit "Backup file is corrupted (gzip test failed)"
fi

# Check if backup contains data
BACKUP_LINES=$(gunzip -c "$BACKUP_FILE" 2>/dev/null | wc -l)

if [[ $BACKUP_LINES -lt 100 ]]; then
    log_warning "Backup file has only $BACKUP_LINES lines - may be incomplete"
else
    log_success "Backup contains $BACKUP_LINES lines"
fi

################################################################################
# Cleanup Old Backups
################################################################################

log "Cleaning up backups older than $RETENTION_DAYS days..."

# Find and delete old backups
OLD_BACKUPS=$(find "$BACKUP_DIR" -name "veritable-games-*.sql.gz" -type f -mtime +$RETENTION_DAYS)

if [[ -n "$OLD_BACKUPS" ]]; then
    DELETED_COUNT=0
    while IFS= read -r backup; do
        log "Deleting old backup: $(basename "$backup")"
        rm -f "$backup"
        ((DELETED_COUNT++))
    done <<< "$OLD_BACKUPS"
    log_success "Deleted $DELETED_COUNT old backup(s)"
else
    log "No old backups to delete"
fi

################################################################################
# Backup Summary
################################################################################

TOTAL_BACKUPS=$(find "$BACKUP_DIR" -name "veritable-games-*.sql.gz" -type f | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)

log "========================================="
log "Backup Summary:"
log "  Latest backup: $(basename "$BACKUP_FILE")"
log "  Backup size: $BACKUP_SIZE"
log "  Database size: $DB_SIZE"
log "  Total backups: $TOTAL_BACKUPS"
log "  Total backup storage: $TOTAL_SIZE"
log "  Retention policy: $RETENTION_DAYS days"
log "========================================="

log_success "Backup completed successfully"

exit 0
