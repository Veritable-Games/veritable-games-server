#!/bin/bash
# Map entire server infrastructure - Phase 1: Data Collection
# Collects comprehensive metadata about /home/user and /data directories

set -e

OUTPUT_DIR="/tmp/infrastructure-map"
mkdir -p "$OUTPUT_DIR"

echo "🗺️  Starting infrastructure mapping..."
echo "Output directory: $OUTPUT_DIR"
echo ""

# ==================================================
# 1. Collect /home/user directory tree (JSON)
# ==================================================
echo "📊 Collecting /home/user structure..."
if command -v tree &> /dev/null; then
    tree -L 4 -J -D --dirsfirst \
        -I 'node_modules|.git|__pycache__|.docker|.npm|.cache|.local|docker-ssd|.venv|venv' \
        /home/user > "$OUTPUT_DIR/home-user.json" 2>/dev/null || true
    echo "✅ /home/user tree saved"
else
    echo "⚠️  tree command not found, skipping JSON tree"
fi

# ==================================================
# 2. Collect /data directory tree (JSON)
# ==================================================
echo "📊 Collecting /data structure..."
if command -v tree &> /dev/null; then
    tree -L 3 -J -D --dirsfirst \
        -I 'node_modules|.git|*.iso|*.dmg|*.pkg|*.tar.gz' \
        /data > "$OUTPUT_DIR/data.json" 2>/dev/null || true
    echo "✅ /data tree saved"
fi

# ==================================================
# 3. Collect directory sizes
# ==================================================
echo "📊 Collecting /home/user sizes..."
du -sh /home/user/* 2>/dev/null | sort -rh > "$OUTPUT_DIR/home-sizes.txt"
echo "✅ /home/user sizes saved"

echo "📊 Collecting /data sizes..."
du -sh /data/* 2>/dev/null | sort -rh > "$OUTPUT_DIR/data-sizes.txt"
echo "✅ /data sizes saved"

# ==================================================
# 4. Collect symlink information
# ==================================================
echo "📊 Collecting symlinks..."
find /home/user -maxdepth 3 -type l -printf "%l -> %p\n" 2>/dev/null > "$OUTPUT_DIR/symlinks.txt"
echo "✅ Symlinks saved"

# ==================================================
# 5. Collect git information
# ==================================================
echo "📊 Collecting git repository info..."
cat > "$OUTPUT_DIR/git-info.txt" << 'EOF'
# Git Repositories Found

## Main Repositories
EOF

# Find all git repos
find /home/user -maxdepth 4 -type d -name ".git" 2>/dev/null | while read gitdir; do
    repodir=$(dirname "$gitdir")
    echo "" >> "$OUTPUT_DIR/git-info.txt"
    echo "### $repodir" >> "$OUTPUT_DIR/git-info.txt"
    cd "$repodir"
    echo "Remote: $(git remote get-url origin 2>/dev/null || echo 'N/A')" >> "$OUTPUT_DIR/git-info.txt"
    echo "Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'N/A')" >> "$OUTPUT_DIR/git-info.txt"
    echo "Commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'N/A')" >> "$OUTPUT_DIR/git-info.txt"
done

echo "✅ Git info saved"

# ==================================================
# 6. Collect Docker information
# ==================================================
echo "📊 Collecting Docker container info..."
docker ps -a --format "{{.Names}}\t{{.Image}}\t{{.Status}}" > "$OUTPUT_DIR/docker-containers.txt" 2>/dev/null || echo "Docker not available" > "$OUTPUT_DIR/docker-containers.txt"
echo "✅ Docker info saved"

# ==================================================
# 7. Generate summary statistics
# ==================================================
echo "📊 Generating summary statistics..."
cat > "$OUTPUT_DIR/summary-stats.txt" << EOF
# Server Infrastructure Summary
Generated: $(date '+%Y-%m-%d %H:%M:%S')

## Storage Overview

### /home/user
Total Size: $(du -sh /home/user 2>/dev/null | cut -f1)
Directory Count: $(find /home/user -type d 2>/dev/null | wc -l)
File Count: $(find /home/user -type f 2>/dev/null | wc -l)

### /data
Total Size: $(du -sh /data 2>/dev/null | cut -f1)
Directory Count: $(find /data -type d 2>/dev/null | wc -l)
File Count: $(find /data -type f 2>/dev/null | wc -l)

### Total
Combined: $(du -sh /home/user /data 2>/dev/null | tail -1 | cut -f1)

## Top-Level Breakdown

### /home/user Top 10
$(du -sh /home/user/* 2>/dev/null | sort -rh | head -10)

### /data Top 10
$(du -sh /data/* 2>/dev/null | sort -rh | head -10)

## Git Repositories
$(grep "^###" "$OUTPUT_DIR/git-info.txt" 2>/dev/null | wc -l) repositories found

## Docker Containers
$(wc -l < "$OUTPUT_DIR/docker-containers.txt") containers

## Symlinks
$(wc -l < "$OUTPUT_DIR/symlinks.txt") symlinks found
EOF

echo "✅ Summary stats saved"

# ==================================================
# 8. Display results
# ==================================================
echo ""
echo "═══════════════════════════════════════════════════"
echo "📈 Infrastructure Mapping Complete!"
echo "═══════════════════════════════════════════════════"
echo ""
cat "$OUTPUT_DIR/summary-stats.txt"
echo ""
echo "📁 Output files:"
ls -lh "$OUTPUT_DIR"
echo ""
echo "Next steps:"
echo "  1. Run: python3 /home/user/scripts/infrastructure/analyze-relationships.py"
echo "  2. Run: python3 /home/user/scripts/infrastructure/generate-graphviz.py"
echo "  3. Run: bash /home/user/scripts/infrastructure/render-all-formats.sh"
