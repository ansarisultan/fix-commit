/**
 * Password Detector Module
 * @module scanner/detectors/passwords
 */

import { calculateEntropy } from '../../utils/entropy.js';

/**
 * Password patterns
 */
const PASSWORD_PATTERNS = {
  password_in_code: {
    pattern: /(password|passwd|pwd|secret)\s*[:=]\s*['"]([^'"]{8,})['"]/gi,
    description: 'Hardcoded Password',
    minLength: 8
  },
  password_var: {
    pattern: /(password|passwd|pwd|secret)\s*=\s*['"]([^'"]{8,})['"]/gi,
    description: 'Password Variable Assignment',
    minLength: 8
  },
  inline_password: {
    pattern: /(password|passwd|pwd)['"]?\s*:\s*['"]([^'"]{8,})['"]/gi,
    description: 'Inline Password',
    minLength: 8
  },
  url_password: {
    pattern: /:\/\/[^:]+:([^@]+)@/g,
    description: 'URL Password',
    minLength: 4
  },
  connection_string: {
    pattern: /(mongodb|mysql|postgresql|redis|amqp):\/\/[^:]*:([^@]+)@/gi,
    description: 'Connection String Password',
    minLength: 4
  }
};

/**
 * Common weak passwords to exclude
 */
const COMMON_PASSWORDS = new Set([
  'password',
  '12345678',
  'qwerty123',
  'admin123',
  'letmein',
  'welcome1',
  'monkey123',
  'dragon123',
  'sunshine',
  'iloveyou',
  'princess',
  'rockstar'
]);

/**
 * Detect passwords in text content
 * @param {string} content - File content
 * @param {Object} options - Detection options
 * @param {number} options.minEntropy - Minimum entropy threshold
 * @param {boolean} options.checkCommon - Check common passwords
 * @returns {Promise<Array<{type: string, value: string, line: number, column: number, confidence: number}>>}
 */
export async function detectPasswords(content, options = {}) {
  const { minEntropy = 3.0, checkCommon = true } = options;

  const findings = [];

  for (const [type, config] of Object.entries(PASSWORD_PATTERNS)) {
    config.pattern.lastIndex = 0;
    let match;

    while ((match = config.pattern.exec(content)) !== null) {
      let value = match[2] || match[1] || match[0];

      value = value.replace(/^['"]|['"]$/g, '');

      if (value.length < (config.minLength || 4)) {
        continue;
      }

      if (checkCommon && COMMON_PASSWORDS.has(value.toLowerCase())) {
        continue;
      }

      const entropy = calculateEntropy(value);

      if (entropy < minEntropy) {
        continue;
      }

      const index = match.index;
      const beforeMatch = content.substring(0, index);
      const lineNumber = beforeMatch.split('\n').length;
      const lastNewLine = beforeMatch.lastIndexOf('\n');
      const column = index - lastNewLine;

      let confidence = 0.6;

      const contextStart = Math.max(0, index - 30);
      const contextEnd = Math.min(content.length, index + value.length + 30);
      const context = content.substring(contextStart, contextEnd);

      if (context.includes('config') || context.includes('settings')) {
        confidence += 0.1;
      }
      if (context.includes('test') || context.includes('example') || context.includes('demo')) {
        confidence -= 0.2;
      }
      if (context.includes('TODO') || context.includes('FIXME')) {
        confidence -= 0.1;
      }

      if (entropy > 4.0) {
        confidence += 0.2;
      }
      if (entropy > 5.0) {
        confidence += 0.1;
      }

      confidence = Math.max(0, Math.min(1, confidence));

      findings.push({
        type,
        value,
        line: lineNumber,
        column,
        confidence,
        description: config.description,
        context: context.trim()
      });
    }
  }

  return findings;
}

/**
 * Check if a string is likely a password
 * @param {string} value - Value to check
 * @param {number} minEntropy - Minimum entropy
 * @returns {boolean}
 */
export function looksLikePassword(value, minEntropy = 3.0) {
  if (value.length < 8) {
    return false;
  }

  if (COMMON_PASSWORDS.has(value.toLowerCase())) {
    return false;
  }

  const entropy = calculateEntropy(value);
  return entropy >= minEntropy;
}
