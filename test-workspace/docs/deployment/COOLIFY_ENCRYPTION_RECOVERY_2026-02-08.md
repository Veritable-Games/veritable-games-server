# Coolify Encryption Recovery - February 8, 2026

**Status**: Resolved
**Duration**: ~4 hours
**Severity**: Critical (all encrypted data lost)

---

## Executive Summary

After a Coolify upgrade, all encrypted data became unreadable due to a missing `APP_KEY`. This document details the recovery process, mistakes made, and lessons learned for future reference.

---

## Timeline of Events

### 1. Initial Problem: "The MAC is invalid"

After upgrading Coolify, all pages with encrypted data displayed:
```
The MAC is invalid
```

**Root Cause**: The `APP_KEY` in `/data/coolify/source/.env` was regenerated during the upgrade, making all previously encrypted data unreadable.

### 2. Recovery Attempt #1: Clear Encrypted Data

Since we couldn't recover the old APP_KEY, we cleared all encrypted fields:
- `private_keys.private_key` → Set to NULL
- `environment_variables.value` → Set to NULL
- Various other encrypted columns

**Result**: MAC error resolved, but now all secrets were gone.

### 3. Recovery Attempt #2: SSH Key Encryption (FAILED)

Tried to restore the localhost SSH key for server connectivity.

**Mistake #1**: Used `Crypt::encryptString()` for the private key.

```php
// WRONG - encryptString() doesn't serialize
$encrypted = Crypt::encryptString($privateKey);
```

**Result**: "The payload is invalid" error when Coolify tried to decrypt.

**Reason**: The `PrivateKey` model uses Laravel's `'encrypted'` cast, which expects:
- Encryption: `encrypt()` → serialize THEN encrypt
- Decryption: `decrypt()` → decrypt THEN unserialize

But `encryptString()` skips serialization, so `decrypt()` fails when trying to unserialize.

### 4. Recovery Attempt #3: SSH Key Format (FAILED)

After fixing the encryption method, SSH connections still failed:
```
Load key "...": error in libcrypto
```

**Mistake #2**: SSH private key was missing trailing newline.

```php
// WRONG - 410 bytes, missing final newline
$key = "-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----";

// CORRECT - 411 bytes, has trailing newline
$key = "-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
";  // Note: newline after closing delimiter
```

**Result**: After adding the trailing newline, SSH connections worked.

### 5. Recovery Attempt #4: Environment Variables (FAILED)

Repopulated all 54 environment variables via direct SQL updates.

**Mistake #3**: Used `Crypt::encryptString()` again instead of `encrypt()`.

```php
// WRONG
$encrypted = Crypt::encryptString($value);
DB::table('environment_variables')->where('id', $id)->update(['value' => $encrypted]);
```

**Result**: `unserialize(): Error at offset 0 of 24 bytes` when viewing configuration.

### 6. Final Fix: Re-encrypt Everything

Had to re-encrypt all values using the correct method:

```php
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

$envVars = DB::table('environment_variables')
    ->where('resourceable_type', 'App\\Models\\Application')
    ->whereNotNull('value')
    ->get();

foreach ($envVars as $env) {
    // Decrypt with decryptString (what we incorrectly used to encrypt)
    $plainValue = Crypt::decryptString($env->value);

    // Re-encrypt with encrypt() (which serializes first)
    $properlyEncrypted = encrypt($plainValue);

    DB::table('environment_variables')
        ->where('id', $env->id)
        ->update(['value' => $properlyEncrypted]);
}
```

**Result**: All 54 environment variables now decrypt correctly.

---

## Key Lessons Learned

### 1. Laravel's 'encrypted' Cast vs Crypt Methods

| Method | Serializes? | Use Case |
|--------|-------------|----------|
| `encrypt($value)` | Yes | For Laravel model `'encrypted'` cast |
| `Crypt::encryptString($value)` | No | For raw string encryption only |
| `decrypt($value)` | Yes (unserializes) | For values encrypted with `encrypt()` |
| `Crypt::decryptString($value)` | No | For values encrypted with `encryptString()` |

**Rule**: If a Laravel model uses the `'encrypted'` cast, you MUST use `encrypt()` / `decrypt()`, NOT `encryptString()` / `decryptString()`.

### 2. SSH Private Key Format Requirements

- Must have trailing newline after `-----END OPENSSH PRIVATE KEY-----`
- Without it: `error in libcrypto` or `invalid format`
- File should be 411+ bytes for ED25519, not 410

### 3. Always Backup APP_KEY

The `APP_KEY` is critical for Coolify. Without it, ALL encrypted data is permanently lost.

**Backup Location**: `docs/deployment/COOLIFY_APP_KEY_BACKUP.md`

Current APP_KEY:
```
APP_KEY=base64:v51PzU1C3wLDfBJG50MXOs+35oc9W4FR4tQQW61ybh4=
```

### 4. Testing Encryption Before Bulk Updates

Always test encryption/decryption on a single record before bulk updating:

```php
// Test encryption
$testValue = 'test-value';
$encrypted = encrypt($testValue);
$decrypted = decrypt($encrypted);
assert($decrypted === $testValue, 'Encryption roundtrip failed!');

// Test through model
$model = EnvironmentVariable::find($testId);
$model->value = $testValue;
$model->save();
$model->refresh();
assert($model->value === $testValue, 'Model encryption failed!');
```

---

## Recovery Commands Reference

### Check for Plaintext Values
```sql
SELECT id, key, left(value, 50)
FROM environment_variables
WHERE value NOT LIKE 'eyJ%'
AND value IS NOT NULL;
```

### Re-encrypt Values (if encrypted with wrong method)
```php
docker exec coolify php artisan tinker --execute="
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

\$envVars = DB::table('environment_variables')
    ->whereNotNull('value')
    ->get();

foreach (\$envVars as \$env) {
    try {
        \$plain = Crypt::decryptString(\$env->value);
        \$proper = encrypt(\$plain);
        DB::table('environment_variables')
            ->where('id', \$env->id)
            ->update(['value' => \$proper]);
        echo 'Fixed: ' . \$env->key . PHP_EOL;
    } catch (Exception \$e) {
        // Already properly encrypted
    }
}
"
```

### Generate New SSH Key for Coolify
```bash
# Generate ED25519 key
ssh-keygen -t ed25519 -C "coolify-localhost" -f /tmp/coolify_key -N ""

# Add public key to server
cat /tmp/coolify_key.pub >> /root/.ssh/authorized_keys

# Encrypt and store private key (note the trailing newline!)
docker exec coolify php artisan tinker --execute="
\$key = file_get_contents('/tmp/coolify_key');
\$encrypted = encrypt(\$key);
DB::table('private_keys')->where('id', 0)->update(['private_key' => \$encrypted]);
echo 'Done';
"
```

### Clear Coolify Caches
```bash
docker exec coolify php artisan cache:clear
docker exec coolify php artisan config:clear
```

---

## Files Modified During Recovery

| File/Table | Change |
|------------|--------|
| `private_keys` table | Regenerated SSH keys with proper encryption |
| `environment_variables` table | Re-encrypted all 54 values |
| `server_settings` table | Set `is_reachable=true`, `is_usable=true` |
| `/root/.ssh/authorized_keys` | Added new Coolify public key |
| GitHub deploy keys | Updated to match new private key in Coolify |

---

## GitHub Deploy Key Recovery

When Coolify's deploy key is regenerated, you must also update GitHub:

### 1. Get Public Key from Coolify's Private Key
```bash
docker exec coolify php artisan tinker --execute="
\$key = App\Models\PrivateKey::find(2);
file_put_contents('/tmp/deploy_key', \$key->private_key);
chmod('/tmp/deploy_key', 0600);
"
docker exec coolify ssh-keygen -y -f /tmp/deploy_key
```

### 2. Update GitHub Deploy Key
```bash
# List existing keys
gh api repos/OWNER/REPO/keys

# Delete old key
gh api -X DELETE repos/OWNER/REPO/keys/KEY_ID

# Add new key
gh api repos/OWNER/REPO/keys \
  -f title="Coolify Production Deploy" \
  -f key="ssh-ed25519 AAAA... comment" \
  -F read_only=true
```

### 3. Trigger Deployment
```bash
/home/user/.local/bin/coolify deploy uuid APP_UUID
```

---

## Prevention Checklist

- [ ] Backup `APP_KEY` before any Coolify upgrade
- [ ] Test backup restoration procedure periodically
- [ ] Document all environment variables externally (`.env.local`)
- [ ] Use `encrypt()` not `encryptString()` for model-backed encryption
- [ ] Verify SSH key files have trailing newlines
- [ ] Test encryption roundtrip before bulk updates

---

**Document Created**: February 9, 2026
**Last Updated**: February 9, 2026
