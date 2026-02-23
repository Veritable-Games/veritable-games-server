# Maintenance Scripts

One-off scripts for fixing specific issues or performing maintenance tasks.

## Scripts

### Code Fix Scripts

- `fix-braces.sh` - Fix brace syntax issues
- `fix-final-braces.sh` - Final brace corrections
- `fix-styled-jsx.sh` - Fix styled-jsx issues
- `fix-with-security.sh` - Apply security fixes

### Database Fix Scripts

- `fix-fts-triggers.js` - Fix full-text search triggers

## Usage

These scripts are typically run once to fix specific issues. Always review the
script contents before running.

```bash
# Example: Run database fix
cd frontend
node scripts/maintenance/fix-fts-triggers.js

# Example: Run shell script
cd frontend
./scripts/maintenance/fix-braces.sh
```

## Note

Most of these scripts are historical fixes that have already been applied. They
are kept for reference and in case similar issues arise.
