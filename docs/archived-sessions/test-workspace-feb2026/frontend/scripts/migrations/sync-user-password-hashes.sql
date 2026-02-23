-- Migration: Sync User Password Hashes from auth.users to users.users
-- Date: 2025-11-10
-- Issue: Duplicate user tables with different password hashes causing login failures
--
-- Problem: Users exist in both auth.users and users.users with DIFFERENT password hashes.
-- The authentication code queries users.users, but passwords were set in auth.users,
-- causing all login attempts to fail with "invalid username or password".
--
-- Root Cause: Data migration created duplicate user tables without syncing passwords.
--
-- Solution: Copy password hashes from auth.users (authoritative) to users.users (queried by code)

BEGIN;

-- Verify hashes are different before update
SELECT
  'BEFORE UPDATE' as stage,
  'auth.users' as source,
  id,
  username,
  SUBSTRING(password_hash, 1, 20) as hash_prefix
FROM auth.users
WHERE username = 'admin'
UNION ALL
SELECT
  'BEFORE UPDATE' as stage,
  'users.users' as source,
  id,
  username,
  SUBSTRING(password_hash, 1, 20) as hash_prefix
FROM users.users
WHERE username = 'admin';

-- Sync password hash for admin user (id=1)
UPDATE users.users
SET password_hash = (
  SELECT password_hash
  FROM auth.users
  WHERE auth.users.id = 1
)
WHERE users.users.id = 1;

-- Sync password hash for Test User (id=22 in auth.users, id=2 in users.users)
-- Note: IDs don't match, so we match by email
UPDATE users.users
SET password_hash = (
  SELECT password_hash
  FROM auth.users
  WHERE auth.users.email = users.users.email
)
WHERE users.users.email = 'test@veritablegames.com';

-- Verify hashes are now synchronized
SELECT
  'AFTER UPDATE' as stage,
  'auth.users' as source,
  id,
  username,
  SUBSTRING(password_hash, 1, 20) as hash_prefix
FROM auth.users
WHERE username = 'admin'
UNION ALL
SELECT
  'AFTER UPDATE' as stage,
  'users.users' as source,
  id,
  username,
  SUBSTRING(password_hash, 1, 20) as hash_prefix
FROM users.users
WHERE username = 'admin';

-- Update last modified timestamp
UPDATE users.users
SET updated_at = NOW()
WHERE email IN (
  SELECT email FROM auth.users
);

COMMIT;

-- Expected result:
-- Both auth.users and users.users should now have matching password hashes
-- Login should succeed with the password that works locally (SQLite auth.db)

-- Verification query:
-- SELECT
--   a.username,
--   a.password_hash = u.password_hash as hashes_match,
--   SUBSTRING(a.password_hash, 1, 20) as auth_hash,
--   SUBSTRING(u.password_hash, 1, 20) as users_hash
-- FROM auth.users a
-- JOIN users.users u ON a.email = u.email;
