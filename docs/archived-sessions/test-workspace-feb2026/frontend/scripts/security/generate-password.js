#!/usr/bin/env node

/**
 * Cryptographic Password Generator
 *
 * Generates cryptographically secure passwords using Node.js crypto.randomBytes()
 * Compliant with NIST SP 800-90Ar1 and OWASP guidelines
 *
 * Usage:
 *   npm run security:generate-password           # 15-character password
 *   npm run security:generate-password -- 20     # 20-character password
 *   npm run security:generate-password -- 32     # 32-character password
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Alphanumeric character set (62 characters)
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const DEFAULT_LENGTH = 15;
const DEFAULT_COST = 12;

/**
 * Generate cryptographically secure random password
 * @param {number} length - Password length
 * @returns {string} - Random password
 */
function generatePassword(length) {
  const bytes = crypto.randomBytes(length * 2); // Get extra bytes for safety
  let password = '';

  for (let i = 0; i < length; i++) {
    // Use modulo bias mitigation
    const randomValue = bytes.readUInt16BE(i * 2) % CHARSET.length;
    password += CHARSET[randomValue];
  }

  return password;
}

/**
 * Validate password has good character distribution
 * @param {string} password - Password to validate
 * @returns {boolean} - True if distribution is acceptable
 */
function validateDistribution(password) {
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);

  // Check character frequency (no char should appear > 20% of the time)
  const charCounts = {};
  for (const char of password) {
    charCounts[char] = (charCounts[char] || 0) + 1;
  }
  const maxFrequency = Math.max(...Object.values(charCounts));
  const maxAllowed = Math.ceil(password.length * 0.2);

  return hasUpper && hasLower && hasDigit && maxFrequency <= maxAllowed;
}

/**
 * Generate password with validation
 * @param {number} length - Password length
 * @param {number} maxAttempts - Maximum generation attempts
 * @returns {string} - Validated password
 */
function generateValidatedPassword(length, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const password = generatePassword(length);
    if (validateDistribution(password)) {
      return password;
    }
  }

  // If we can't get good distribution after 10 tries, just return the last one
  // (This is extremely unlikely with crypto.randomBytes)
  return generatePassword(length);
}

/**
 * Calculate entropy
 * @param {number} length - Password length
 * @returns {number} - Entropy in bits
 */
function calculateEntropy(length) {
  return length * Math.log2(CHARSET.length);
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const length = args[0] ? parseInt(args[0], 10) : DEFAULT_LENGTH;

  // Validate length
  if (isNaN(length) || length < 8) {
    console.error('❌ Error: Password length must be at least 8 characters');
    console.error('Usage: npm run security:generate-password -- [length]');
    process.exit(1);
  }

  if (length < 15) {
    console.warn('⚠️  Warning: Passwords shorter than 15 characters are not recommended');
    console.warn('   NIST guidelines recommend 20+ characters for service accounts\n');
  }

  // Generate password
  console.log('🔐 Cryptographic Password Generator');
  console.log('━'.repeat(70));
  console.log('');

  const password = generateValidatedPassword(length);
  const entropy = calculateEntropy(length);

  console.log(`Generated Password (${length} characters):`);
  console.log(password);
  console.log('');
  console.log(`Entropy: ${entropy.toFixed(1)} bits`);
  console.log(`Character Set: Alphanumeric (${CHARSET.length} chars)`);
  console.log('Method: Node.js crypto.randomBytes() (CSPRNG)');
  console.log('');
  console.log('━'.repeat(70));
  console.log('');

  // Generate bcrypt hash
  console.log('Generating bcrypt hash (this may take a moment)...');
  const hash = await bcrypt.hash(password, DEFAULT_COST);

  console.log(`Bcrypt Hash (cost ${DEFAULT_COST}):`);
  console.log(hash);
  console.log('');
  console.log('━'.repeat(70));
  console.log('');

  // Generate SQL UPDATE statement
  console.log('SQL UPDATE Statement (users.users):');
  console.log(`UPDATE users.users`);
  console.log(`SET password_hash = '${hash}',`);
  console.log(`    updated_at = NOW()`);
  console.log(`WHERE username = 'admin';`);
  console.log('');
  console.log('━'.repeat(70));
  console.log('');

  // Security warnings
  console.log('⚠️  SAVE THIS PASSWORD IMMEDIATELY TO YOUR PASSWORD MANAGER');
  console.log('⚠️  Once you close this terminal, the password cannot be recovered');
  console.log('');

  // Recommendations
  if (length === 15) {
    console.log('💡 Tip: For admin/service accounts, use 20+ characters:');
    console.log('   npm run security:generate-password -- 20');
    console.log('');
  }
}

// Run
main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
