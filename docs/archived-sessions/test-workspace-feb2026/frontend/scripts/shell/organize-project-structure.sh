#!/bin/bash

# Script to organize project structure without breaking functionality
# This creates a cleaner structure by moving migration scripts to appropriate directories

echo "Creating organized directory structure..."

# Create directories if they don't exist
mkdir -p scripts/migration
mkdir -p scripts/analysis
mkdir -p scripts/fixes
mkdir -p scripts/create
mkdir -p scripts/update
mkdir -p scripts/cleanup

# Move files based on their purpose (using patterns to identify file types)
echo "Organizing migration and utility scripts..."

# Analysis scripts
for file in analyze-*.js audit-*.js check-*.js compare-*.js debug-*.js investigate-*.js identify-*.js; do
    if [ -f "$file" ]; then
        echo "Moving $file to scripts/analysis/"
        mv "$file" scripts/analysis/ 2>/dev/null
    fi
done

# Creation scripts
for file in create-*.js import-*.js populate-*.js add-*.js; do
    if [ -f "$file" ]; then
        echo "Moving $file to scripts/create/"
        mv "$file" scripts/create/ 2>/dev/null
    fi
done

# Fix scripts
for file in fix-*.js cleanup-*.js remove-*.js proper-*.js correct-*.js; do
    if [ -f "$file" ]; then
        echo "Moving $file to scripts/fixes/"
        mv "$file" scripts/fixes/ 2>/dev/null
    fi
done

# Update scripts
for file in update-*.js enhance-*.js migrate-*.js merge-*.js rename-*.js reorganize-*.js; do
    if [ -f "$file" ]; then
        echo "Moving $file to scripts/update/"
        mv "$file" scripts/update/ 2>/dev/null
    fi
done

# Other migration scripts
for file in *.js; do
    # Skip config files
    if [[ ! "$file" =~ (babel|jest|next|postcss|prettier|tailwind)\.config\.js$ ]] && \
       [[ ! "$file" =~ middleware\.ts$ ]] && \
       [[ "$file" != "next-env.d.js" ]]; then
        if [ -f "$file" ]; then
            echo "Moving $file to scripts/migration/"
            mv "$file" scripts/migration/ 2>/dev/null
        fi
    fi
done

# Move markdown documentation to docs directory
mkdir -p docs/technical
mkdir -p docs/project-notes

echo "Moving documentation files..."
for file in *.md; do
    # Skip essential README files
    if [[ "$file" != "README.md" ]] && [[ "$file" != "CLAUDE.md" ]]; then
        if [ -f "$file" ]; then
            echo "Moving $file to docs/project-notes/"
            mv "$file" docs/project-notes/ 2>/dev/null
        fi
    fi
done

echo ""
echo "Project structure organization complete!"
echo ""
echo "New structure:"
echo "  scripts/"
echo "    ├── migration/  (general migration scripts)"
echo "    ├── analysis/   (analysis and audit scripts)"
echo "    ├── fixes/      (fix and cleanup scripts)"
echo "    ├── create/     (creation and import scripts)"
echo "    ├── update/     (update and enhancement scripts)"
echo "    └── cleanup/    (cleanup and removal scripts)"
echo "  docs/"
echo "    ├── technical/  (technical documentation)"
echo "    └── project-notes/ (project notes and plans)"
echo ""
echo "Note: Configuration files remain in root directory"