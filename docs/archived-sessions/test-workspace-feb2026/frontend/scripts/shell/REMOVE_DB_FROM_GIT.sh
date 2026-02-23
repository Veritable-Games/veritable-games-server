#!/bin/bash

# CRITICAL: Script to remove database files from Git history
# WARNING: This will rewrite Git history!
# 
# BEFORE RUNNING:
# 1. Ensure all team members have pushed their changes
# 2. Make a complete backup of the repository
# 3. Notify all team members about the history rewrite
# 4. After running, all team members must re-clone the repository

echo "==================================="
echo "DATABASE REMOVAL FROM GIT HISTORY"
echo "==================================="
echo ""
echo "This script will permanently remove database files from Git history."
echo "This is necessary because sensitive data (passwords, sessions) are exposed."
echo ""
echo "Files to be removed:"
echo "  - data/*.db"
echo "  - data/*.db-shm"  
echo "  - data/*.db-wal"
echo "  - data/notebooks.db"
echo ""
read -p "Have you made a complete backup? (yes/no): " backup_confirm

if [ "$backup_confirm" != "yes" ]; then
    echo "Please backup first with: tar -czf ../web-backup-$(date +%Y%m%d).tar.gz ."
    exit 1
fi

read -p "Have all team members been notified? (yes/no): " team_confirm

if [ "$team_confirm" != "yes" ]; then
    echo "Please notify your team about the upcoming history rewrite."
    exit 1
fi

echo ""
echo "Starting database file removal from history..."
echo ""

# Create backup branch
git checkout -b backup/before-db-removal-$(date +%Y%m%d-%H%M%S)
git checkout -

# Remove files from history using filter-branch
echo "Removing database files from all commits..."
git filter-branch --force --index-filter \
    'git rm --cached --ignore-unmatch data/*.db data/*.db-shm data/*.db-wal data/notebooks.db' \
    --prune-empty --tag-name-filter cat -- --all

# Clean up refs
echo "Cleaning up references..."
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Verify files are gone
echo ""
echo "Verification:"
if git log --all --full-history -- data/*.db | grep -q .; then
    echo "WARNING: Database files may still be in history!"
else
    echo "✅ Database files removed from history"
fi

echo ""
echo "==================================="
echo "NEXT STEPS:"
echo "==================================="
echo ""
echo "1. Force push to remote (DANGEROUS - will rewrite remote history):"
echo "   git push origin --force --all"
echo "   git push origin --force --tags"
echo ""
echo "2. All team members must:"
echo "   - Delete their local repositories"
echo "   - Re-clone from remote"
echo "   - OR run: git fetch --all && git reset --hard origin/[branch-name]"
echo ""
echo "3. Rotate ALL credentials:"
echo "   - All user passwords"
echo "   - All API keys"
echo "   - All session tokens"
echo ""
echo "4. Consider using git-secrets to prevent future commits:"
echo "   https://github.com/awslabs/git-secrets"
echo ""
echo "Script complete. Review the above steps carefully."