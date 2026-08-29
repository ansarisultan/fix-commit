/**
 * Fingerprint Module - Generate secure fingerprints for secrets
 * @module lifecycle/fingerprint
 */

import crypto from 'crypto';

/**
 * Generate a fingerprint for a secret value
 * @param {string} secret - Secret value to fingerprint
 * @param {string} algorithm - Hashing algorithm (default: sha256)
 * @param {string} salt - Optional salt for additional security
 * @returns {string} Fingerprint hash
 */
export function generateFingerprint(secret, algorithm = 'sha256', salt = '') {
  if (!secret) {
    throw new Error('Secret value is required for fingerprinting');
  }

  const content = salt ? `${salt}:${secret}` : secret;
  const hash = crypto.createHash(algorithm);
  hash.update(content, 'utf-8');
  return hash.digest('hex');
}

/**
 * Generate a fingerprint with HMAC
 * @param {string} secret - Secret value to fingerprint
 * @param {string} key - HMAC key
 * @param {string} algorithm - HMAC algorithm (default: sha256)
 * @returns {string} HMAC fingerprint
 */
export function generateHmacFingerprint(secret, key, algorithm = 'sha256') {
  if (!secret) {
    throw new Error('Secret value is required for fingerprinting');
  }
  if (!key) {
    throw new Error('HMAC key is required');
  }

  const hmac = crypto.createHmac(algorithm, key);
  hmac.update(secret, 'utf-8');
  return hmac.digest('hex');
}

/**
 * Generate a short fingerprint (first 8 characters)
 * @param {string} secret - Secret value
 * @param {string} algorithm - Hashing algorithm
 * @returns {string} Short fingerprint
 */
export function generateShortFingerprint(secret, algorithm = 'sha256') {
  const full = generateFingerprint(secret, algorithm);
  return full.substring(0, 8);
}

/**
 * Compare two fingerprints
 * @param {string} fingerprint1 - First fingerprint
 * @param {string} fingerprint2 - Second fingerprint
 * @returns {boolean} Whether fingerprints match
 */
export function compareFingerprints(fingerprint1, fingerprint2) {
  if (!fingerprint1 || !fingerprint2) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(fingerprint1, 'hex'),
      Buffer.from(fingerprint2, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Generate fingerprint from multiple attributes
 * @param {Object} attributes - Attributes to include in fingerprint
 * @param {string} algorithm - Hashing algorithm
 * @returns {string} Composite fingerprint
 */
export function generateCompositeFingerprint(attributes, algorithm = 'sha256') {
  const sortedKeys = Object.keys(attributes).sort();
  const parts = sortedKeys.map(key => `${key}:${attributes[key]}`);
  const combined = parts.join('|');

  return generateFingerprint(combined, algorithm);
}

/**
 * Generate a fingerprint for a file
 * @param {string} content - File content
 * @param {string} algorithm - Hashing algorithm
 * @returns {string} File fingerprint
 */
export function generateFileFingerprint(content, algorithm = 'sha256') {
  return generateFingerprint(content, algorithm);
}

/**
 * Generate a fingerprint for a secret context
 * @param {Object} context - Context information
 * @param {string} algorithm - Hashing algorithm
 * @returns {string} Context fingerprint
 */
export function generateContextFingerprint(context, algorithm = 'sha256') {
  const { file, line, column, type } = context;

  const normalized = [
    `file:${file || ''}`,
    `line:${line || 0}`,
    `column:${column || 0}`,
    `type:${type || 'unknown'}`
  ].join('|');

  return generateFingerprint(normalized, algorithm);
}

export default {
  generateFingerprint,
  generateHmacFingerprint,
  generateShortFingerprint,
  compareFingerprints,
  generateCompositeFingerprint,
  generateFileFingerprint,
  generateContextFingerprint
};
