/**
 * False Positive Detection Module
 * @module scanner/false-positive
 */

/**
 * Common false positive patterns
 */
const FALSE_POSITIVE_PATTERNS = [
  // Example/demo values
  /example|sample|demo|test|placeholder|dummy/i,
  // Copyright/URLs
  /www\.|\.com|\.org|\.net|\.io/,
  // Version numbers
  /\d+\.\d+\.\d+/,
  // Dates
  /\d{4}-\d{2}-\d{2}/,
  // Common UUIDs
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  // Image data
  /data:image\/(png|jpeg|gif|svg|webp)/,
  // File paths
  /\/[a-zA-Z0-9-_]+\/[a-zA-Z0-9-_]+\.[a-zA-Z0-9]+/,
  // Documentation URLs
  /http[s]?:\/\/[a-zA-Z0-9]+\.(com|org|net)\/[a-zA-Z0-9/-]+/,
  // Git URLs
  /git@[a-zA-Z0-9.-]+:[a-zA-Z0-9/-]+\.git/,
  // NPM package names
  /@[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+/,
  // Version specifiers
  /[\^~]?\d+\.\d+\.\d+/,
  // Common variable names
  /(password|secret|key|token|auth)_(example|sample|demo|test)/i
];

/**
 * Common false positive values
 */
const FALSE_POSITIVE_VALUES = new Set([
  'password',
  'secret',
  'key',
  'token',
  'api_key',
  'api-key',
  'apikey',
  'secret_key',
  'private_key',
  'public_key',
  'auth_token',
  'access_token',
  'refresh_token',
  '1234567890',
  'abcdefghijklmnopqrstuvwxyz',
  'qwertyuiopasdfghjklzxcvbnm',
  '00000000-0000-0000-0000-000000000000'
]);

/**
 * Check if a finding is a false positive
 * @param {Object} finding - Finding to check
 * @param {Object} context - Additional context
 * @returns {boolean} True if likely a false positive
 */
export function isFalsePositive(finding, context = {}) {
  const { value, context: findingContext, type } = finding;

  if (FALSE_POSITIVE_VALUES.has(value?.toLowerCase())) {
    return true;
  }

  for (const pattern of FALSE_POSITIVE_PATTERNS) {
    if (pattern.test(value) || pattern.test(findingContext || '')) {
      return true;
    }
  }

  if (
    context.filePath?.includes('test/') ||
    context.filePath?.includes('__tests__/') ||
    context.filePath?.endsWith('.test.js') ||
    context.filePath?.endsWith('.spec.js')
  ) {
    return true;
  }

  if (
    context.filePath?.endsWith('.md') ||
    context.filePath?.endsWith('.txt') ||
    context.filePath?.endsWith('.rst')
  ) {
    return true;
  }

  if (context.filePath?.endsWith('.example') || context.filePath?.endsWith('.sample')) {
    return true;
  }

  if (type === 'jwt' && value?.startsWith('eyJ')) {
    try {
      const parts = value.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        if (payload.test || payload.example || payload.demo) {
          return true;
        }
      }
    } catch {
      return false;
    }
  }

  if (finding.entropy && finding.entropy < 3.0) {
    return true;
  }

  return false;
}

/**
 * Filter out false positives from findings
 * @param {Array} findings - Findings to filter
 * @param {Object} context - Additional context
 * @returns {Array} Filtered findings
 */
export function filterFalsePositives(findings, context = {}) {
  return findings.filter(finding => !isFalsePositive(finding, context));
}

/**
 * Get a confidence score for a finding
 * @param {Object} finding - Finding to score
 * @param {Object} context - Additional context
 * @returns {number} Confidence score (0-1)
 */
export function getConfidenceScore(finding, context = {}) {
  let score = finding.confidence || 0.5;

  if (isFalsePositive(finding, context)) {
    score = Math.max(0, score - 0.3);
  }

  if (finding.type?.includes('key') || finding.type?.includes('token')) {
    score = Math.min(1, score + 0.1);
  }

  if (finding.entropy && finding.entropy > 4.5) {
    score = Math.min(1, score + 0.1);
  }

  if (FALSE_POSITIVE_VALUES.has(finding.value?.toLowerCase())) {
    score = Math.max(0, score - 0.2);
  }

  return Math.max(0, Math.min(1, score));
}
