# Testing Documentation Index

**Updated**: December 2025

---

## Quick Navigation

### Main Testing Guide

**[docs/guides/TESTING.md](../guides/TESTING.md)** - Complete testing guide
- Jest configuration and commands
- Test organization patterns
- Writing unit and integration tests
- Coverage reports
- Best practices

---

## Available Test Documentation

1. **[TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md)**
   - Pre-deployment verification checklist
   - All features and integration points

2. **[INDIVIDUAL_PRODUCTIVITY_TESTING.md](./INDIVIDUAL_PRODUCTIVITY_TESTING.md)**
   - Testing individual productivity features
   - API coverage and edge cases

---

## Quick Commands

```bash
cd frontend

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test
npm test -- ComponentName

# Watch mode
npm test -- --watch
```

---

## Test File Locations

- Unit tests: `src/**/__tests__/*.test.{ts,tsx}`
- Config: `jest.config.js`
- Setup: `jest.setup.js`

---

**See also**: [CLAUDE.md](../../CLAUDE.md) - Main development guide
