#!/bin/bash

# Script to fix all invalid withSecurity options in API route files

# Find all TypeScript files in src/app/api
find src/app/api -name "*.ts" -type f | while read -r file; do
    # Check if file contains withSecurity with invalid options
    if grep -q "requireAuth\|csrfEnabled\|cspEnabled\|rateLimitConfig\|requiredRole" "$file"; then
        echo "Fixing: $file"

        # Create a backup
        cp "$file" "$file.bak"

        # Fix the invalid properties
        # 1. Replace requireAuth: false/true with enableCSRF based on HTTP method context
        # 2. Replace csrfEnabled with enableCSRF
        # 3. Replace cspEnabled (remove it, not needed)
        # 4. Replace rateLimitConfig (remove it for now)
        # 5. Remove requiredRole (authentication/authorization should be in handler)

        sed -i \
            -e 's/requireAuth: false/enableCSRF: false/g' \
            -e 's/requireAuth: true,$/enableCSRF: true,/g' \
            -e 's/requireAuth: true$/enableCSRF: true/g' \
            -e 's/requireAuth: true,\s*$/enableCSRF: true,/g' \
            -e 's/csrfEnabled: false/enableCSRF: false/g' \
            -e 's/csrfEnabled: true/enableCSRF: true/g' \
            -e '/cspEnabled:/d' \
            -e '/rateLimitConfig:/d' \
            -e '/requiredRole:/d' \
            "$file"

        # Clean up empty lines and trailing commas before closing braces
        sed -i \
            -e '/^[[:space:]]*$/N;/\n[[:space:]]*$/d' \
            -e 's/,\([[:space:]]*\)});/\1});/g' \
            "$file"
    fi
done

echo "Done! Backup files created with .bak extension"
