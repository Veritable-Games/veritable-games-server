# Testing Scripts Organization

This directory contains all testing, validation, debugging, and health check scripts organized by purpose and domain.

## Directory Structure

### `/health/`

System health and monitoring scripts

- `health-check.js` - Comprehensive system health verification

### `/security/`

Security testing and validation

- `test-security.js` - Security validation tests

### `/integration/`

API and system integration tests

- `test-settings.js` - Settings system tests
- `test-social-apis.js` - Social features API tests
- `test-dashboard-api.js` - Dashboard API tests
- `test-soft-delete.js` - Soft delete functionality tests
- Various moderation and authentication tests

### `/validation/`

Data validation and schema checks

- `check-news-schema.js` - News data schema validation

### `/debug/`

Debugging utilities and diagnostic scripts

- `debug-conversation-detection.js` - Forum conversation debugging
- `debug-dashboard-data.js` - Dashboard data debugging
- `debug-headers.js` - HTTP headers debugging
- Various UI and rendering debug tools

### `/data/`

Domain-specific data validation and testing

#### `/data/wiki/`

Wiki system validation

- Schema validation scripts
- Link checking utilities
- Revision system tests

#### `/data/library/`

Content library validation

- Document validation scripts
- Schema and constraint checks
- Library functionality tests

#### `/data/forums/`

Forum system validation

- Reply tree testing
- Conversation flow validation
- Deep nesting tests

### `/automation/`

Test data creation and automation

- User creation scripts
- Avatar testing utilities
- Stress testing tools

### `/performance/`

Performance testing and benchmarking

- Load testing scripts
- Performance monitoring utilities

## Usage Guidelines

1. **Health Checks**: Run `testing/health/health-check.js` before major deployments
2. **Security**: Execute security tests before production releases
3. **Integration**: Run integration tests after API changes
4. **Data Validation**: Use domain-specific validators after schema changes
5. **Debug**: Leverage debug scripts during development troubleshooting

## Legacy Scripts

This organization consolidates previously scattered testing scripts from:

- Root `/scripts/` directory (33 scripts)
- `/scripts/debug/` directory
- `/scripts/tests/` directory

All functionality has been preserved while improving discoverability and maintainability.
