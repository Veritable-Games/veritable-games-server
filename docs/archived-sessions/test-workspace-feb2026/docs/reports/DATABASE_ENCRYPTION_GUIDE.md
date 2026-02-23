# Database Encryption at Rest - Implementation Guide

## Overview

This guide covers the implementation of enterprise-grade database encryption at rest for the Veritable Games platform using SQLCipher. The solution provides transparent encryption with zero-downtime migration, automated key rotation, and comprehensive monitoring.

## Features

- **Enterprise-Grade Encryption**: AES-256 encryption using SQLCipher
- **Zero-Downtime Migration**: Seamless migration from unencrypted to encrypted databases
- **Automated Key Rotation**: Configurable key rotation with compliance tracking
- **Performance Monitoring**: <5% performance overhead with real-time monitoring
- **Health Monitoring**: Comprehensive encryption status and compliance tracking
- **Secure Key Management**: Environment-based key derivation with PBKDF2
- **Audit Logging**: Complete audit trail for compliance requirements

## Quick Start

### 1. Environment Configuration

Add encryption configuration to your `.env.local`:

```bash
# Enable database encryption
DATABASE_ENCRYPTION_ENABLED=true

# Generate master key (64+ hex characters)
DATABASE_MASTER_KEY=$(openssl rand -hex 32)

# Optional: Configure rotation policy
KEY_ROTATION_CRITICAL_DAYS=30
KEY_ROTATION_NORMAL_DAYS=90
KEY_ROTATION_LOW_DAYS=180

# Enable monitoring
ENCRYPTION_HEALTH_MONITORING=true
```

### 2. Install Dependencies

The required dependencies are already included:

```bash
npm install @journeyapps/sqlcipher node-forge
```

### 3. Migrate Existing Databases

Run the migration script to encrypt existing databases:

```bash
# Encrypt all databases
node scripts/encrypt-existing-databases.js --all --verbose

# Encrypt specific database
node scripts/encrypt-existing-databases.js --database=users --verbose

# Dry run to see what would be done
node scripts/encrypt-existing-databases.js --all --dry-run
```

### 4. Verify Encryption Status

Check encryption status via API or monitoring:

```bash
# Verify all databases are encrypted
node scripts/encrypt-existing-databases.js --verify-only

# Check via admin API (requires authentication)
curl -H "Authorization: Bearer <token>" \
     http://localhost:3000/api/admin/security/encryption/status
```

## Architecture Overview

### Component Structure

```
src/lib/security/encryption/
├── key-manager.ts          # Secure key derivation and management
├── health-monitor.ts       # Real-time monitoring and alerting
└── pool-adapter.ts         # Transparent database pool integration

src/lib/database/
├── pool.ts                 # Original unencrypted pool
├── encrypted-pool.ts       # SQLCipher-enabled pool
└── pool-adapter.ts         # Unified adapter with encryption support

scripts/
├── encrypt-existing-databases.js  # Migration script
└── rotate-encryption-keys.js      # Key rotation script

api/admin/security/encryption/
├── status/route.ts         # Encryption status endpoint
└── rotate/route.ts         # Key rotation endpoint
```

### Key Management System

The encryption system uses a hierarchical key derivation approach:

1. **Master Key**: Derived from `DATABASE_MASTER_KEY` or `SESSION_SECRET`
2. **Database Keys**: Derived using PBKDF2 with database-specific salts
3. **Key Versioning**: Support for multiple key versions for rotation
4. **Secure Storage**: Keys stored encrypted with AES-256-GCM

#### Key Derivation Process

```typescript
// Master key from environment
const masterKey = Buffer.from(process.env.DATABASE_MASTER_KEY, 'hex');

// Database-specific salt
const salt = crypto.createHash('sha256')
  .update(`${databaseName}:${version}:veritable-games`)
  .digest()
  .slice(0, 16);

// Derive database key using PBKDF2
const databaseKey = crypto.pbkdf2Sync(
  masterKey,
  salt,
  100000,    // NIST recommended iterations
  32,        // 256-bit key
  'sha256'
);
```

## Database Migration

### Migration Process

The migration script provides safe, automated migration from unencrypted to encrypted databases:

1. **Backup Creation**: Automatic backup before migration
2. **Verification**: Integrity checks before and after migration
3. **Atomic Operation**: All-or-nothing migration with rollback
4. **Performance Tracking**: Migration time and size impact reporting

### Migration Options

```bash
# Migrate all databases with progress tracking
node scripts/encrypt-existing-databases.js \
  --all \
  --verbose \
  --backup-dir=/path/to/backups

# Migrate specific database with force option
node scripts/encrypt-existing-databases.js \
  --database=forums \
  --force \
  --verbose

# Dry run to preview migration
node scripts/encrypt-existing-databases.js \
  --all \
  --dry-run
```

### Migration Safety Features

- **Automatic Backups**: Created before each migration
- **Integrity Verification**: Table and data integrity checks
- **Rollback Support**: Automatic restoration on failure
- **Progress Tracking**: ETA calculation and progress reporting
- **Size Optimization**: Encryption with compression benefits

## Key Rotation

### Automated Key Rotation

The system supports automated key rotation based on configurable policies:

```bash
# Rotate keys for all databases
node scripts/rotate-encryption-keys.js --all

# Rotate specific database key
node scripts/rotate-encryption-keys.js --database=users

# Check rotation status
node scripts/rotate-encryption-keys.js --verify-only

# Schedule automatic rotation
node scripts/rotate-encryption-keys.js --schedule
```

### Rotation Policies

Database sensitivity determines rotation frequency:

- **Critical** (auth, users, messaging): 30 days
- **Normal** (forums, wiki, content): 90 days
- **Low** (library, system): 180 days

### Zero-Downtime Rotation

Key rotation uses SQLCipher's `PRAGMA rekey` for seamless transitions:

1. **Key Generation**: New key derived with incremented version
2. **Database Rekey**: SQLCipher performs in-place re-encryption
3. **Verification**: New key tested with sample queries
4. **Schedule Update**: Rotation tracking updated

## Performance Monitoring

### Performance Metrics

The system tracks encryption performance impact:

- **Query Time**: Average query execution time
- **Encryption Overhead**: Performance impact percentage
- **Throughput**: Operations per second
- **Connection Pool**: Utilization and efficiency

### Performance Optimization

SQLCipher configuration optimized for performance:

```sql
PRAGMA cipher_compatibility = sqlcipher_4_5_x;
PRAGMA cipher_page_size = 4096;
PRAGMA kdf_iter = 256000;
PRAGMA cache_size = 10000;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
```

### Target Performance Impact

- **Encryption Overhead**: <5% query time increase
- **Storage Overhead**: ~10% size increase (varies by data)
- **Connection Startup**: ~50ms additional time for key derivation
- **Memory Usage**: ~10MB additional per connection

## Health Monitoring

### Real-Time Monitoring

The health monitoring system provides:

- **Encryption Status**: Real-time encryption verification
- **Key Age Tracking**: Rotation compliance monitoring
- **Performance Impact**: Continuous performance analysis
- **Integrity Checks**: Database integrity verification
- **Alert System**: Automated alerting for issues

### Monitoring Endpoints

```bash
# Get comprehensive encryption status
GET /api/admin/security/encryption/status

# Trigger key rotation
POST /api/admin/security/encryption/rotate
{
  "database": "users",  // or "all": true
  "force": false
}

# Health check
GET /api/admin/security/encryption/rotate
```

### Alert Conditions

The system generates alerts for:

- **Key Rotation Overdue**: Keys exceeding rotation policy
- **Performance Degradation**: Overhead exceeding thresholds
- **Integrity Failures**: Database corruption or access issues
- **Configuration Issues**: Misconfigured encryption settings

## Security Considerations

### Threat Model

The encryption implementation addresses:

- **Data at Rest**: Protection against disk/backup theft
- **Memory Dumps**: Secure key handling in memory
- **Unauthorized Access**: Database file access without keys
- **Compliance**: GDPR, CCPA, SOC 2 requirements

### Security Best Practices

1. **Key Management**:
   - Store master key securely (HSM, vault, or secure environment)
   - Regular key rotation based on sensitivity
   - Secure key derivation with high iteration counts

2. **Operational Security**:
   - Monitor encryption status continuously
   - Audit all key operations
   - Implement principle of least privilege
   - Regular security assessments

3. **Backup Security**:
   - Encrypt backup files
   - Secure backup key management
   - Test restore procedures regularly

### Compliance Features

- **Audit Logging**: Complete operation audit trail
- **Key Rotation**: Automated compliance with policies
- **Data Encryption**: AES-256 encryption at rest
- **Access Controls**: Role-based encryption management
- **Monitoring**: Real-time compliance dashboards

## Troubleshooting

### Common Issues

#### 1. Encryption Not Working

```bash
# Check environment configuration
echo $DATABASE_ENCRYPTION_ENABLED
echo $DATABASE_MASTER_KEY

# Verify SQLCipher installation
node -e "const db = require('@journeyapps/sqlcipher'); console.log('SQLCipher available');"

# Check database status
node scripts/encrypt-existing-databases.js --verify-only
```

#### 2. Performance Issues

```bash
# Check encryption overhead
curl http://localhost:3000/api/admin/security/encryption/status

# Analyze query performance
node -e "
const { dbPool } = require('./src/lib/database/pool-adapter');
console.log(dbPool.getStats());
"

# Monitor health metrics
tail -f logs/encryption-health.log
```

#### 3. Key Rotation Failures

```bash
# Check rotation status
node scripts/rotate-encryption-keys.js --verify-only

# Force rotation (if needed)
node scripts/rotate-encryption-keys.js --database=<name> --force

# Check rotation logs
tail -f logs/key-rotation.log
```

### Recovery Procedures

#### 1. Corrupted Database Recovery

```bash
# Restore from backup
cp data/backups/<database>_backup_<timestamp>.db data/<database>.db

# Verify restoration
node scripts/encrypt-existing-databases.js --database=<name> --verify-only
```

#### 2. Lost Master Key Recovery

If the master key is lost, databases cannot be decrypted. Prevention:

1. **Backup Master Key**: Store securely offline
2. **Key Escrow**: Use enterprise key management
3. **Documentation**: Document key recovery procedures

#### 3. Migration Rollback

```bash
# Automatic rollback on migration failure
# Manual rollback if needed:
mv data/<database>.db data/<database>.db.encrypted
mv data/<database>.db.original data/<database>.db
```

## Production Deployment

### Pre-Deployment Checklist

- [ ] Generate secure master key (64+ hex characters)
- [ ] Configure rotation policies based on compliance requirements
- [ ] Set up monitoring and alerting
- [ ] Test migration process in staging
- [ ] Document key management procedures
- [ ] Train operations team on encryption management

### Deployment Steps

1. **Environment Setup**:
   ```bash
   # Generate production master key
   export DATABASE_MASTER_KEY=$(openssl rand -hex 32)

   # Configure encryption
   export DATABASE_ENCRYPTION_ENABLED=true
   export ENCRYPTION_HEALTH_MONITORING=true
   ```

2. **Database Migration**:
   ```bash
   # Create comprehensive backups
   cp -r data/ data_backup_$(date +%Y%m%d_%H%M%S)/

   # Migrate databases
   node scripts/encrypt-existing-databases.js --all --verbose
   ```

3. **Verification**:
   ```bash
   # Verify all databases encrypted
   node scripts/encrypt-existing-databases.js --verify-only

   # Check health status
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
        $API_URL/api/admin/security/encryption/status
   ```

4. **Monitoring Setup**:
   - Configure alerting thresholds
   - Set up rotation schedules
   - Monitor performance metrics

### Production Monitoring

- **Health Checks**: Automated encryption status verification
- **Performance Monitoring**: Continuous overhead tracking
- **Compliance Reporting**: Regular compliance assessments
- **Key Rotation**: Automated rotation based on policies

## API Reference

### Encryption Status Endpoint

```typescript
GET /api/admin/security/encryption/status

Response: {
  enabled: boolean;
  overallHealth: 'healthy' | 'warning' | 'critical';
  databases: DatabaseEncryptionStatus[];
  metrics: {
    encryptionCoverage: number;
    averagePerformanceImpact: number;
    complianceScore: number;
    keyRotationCompliance: number;
  };
  recommendations: string[];
  lastHealthCheck: string;
  alerts: {
    active: number;
    resolved: number;
    recent: EncryptionAlert[];
  };
}
```

### Key Rotation Endpoint

```typescript
POST /api/admin/security/encryption/rotate

Request: {
  database?: string;  // Specific database
  all?: boolean;      // All databases
  force?: boolean;    // Force rotation
}

Response: {
  success: boolean;
  rotations: RotationResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    totalDuration: number;
  };
  errors?: string[];
}
```

## Support and Maintenance

### Regular Maintenance Tasks

1. **Weekly**:
   - Review encryption health status
   - Check performance metrics
   - Verify backup integrity

2. **Monthly**:
   - Review key rotation compliance
   - Analyze performance trends
   - Update rotation policies if needed

3. **Quarterly**:
   - Security assessment
   - Key management audit
   - Compliance reporting

### Getting Help

- **Logs**: Check `logs/encryption-health.log` and `logs/key-rotation.log`
- **Status**: Use admin API endpoints for real-time status
- **Performance**: Monitor encryption overhead and query performance
- **Documentation**: This guide and inline code documentation

### Version History

- **v1.0.0**: Initial implementation with SQLCipher integration
- **v1.1.0**: Added automated key rotation and health monitoring
- **v1.2.0**: Enhanced performance monitoring and compliance reporting

---

*This implementation provides enterprise-grade database encryption with minimal performance impact and comprehensive monitoring. Regular maintenance and monitoring ensure continued security and compliance.*