/**
 * Custom Patterns Detector Module
 * @module scanner/detectors/patterns
 */

import { calculateEntropy } from '../../utils/entropy.js';

/**
 * Additional security-related patterns
 */
const SECURITY_PATTERNS = {
  // Private keys
  private_key: {
    pattern:
      /-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----[\s\S]+?-----END \1 PRIVATE KEY-----/g,
    description: 'Private Key',
    minEntropy: 5.0
  },
  // SSH keys
  ssh_key: {
    pattern: /ssh-(rsa|dss|ed25519)\s+[A-Za-z0-9+/]{32,}={0,2}/g,
    description: 'SSH Key',
    minEntropy: 4.0
  },
  // PGP keys
  pgp_key: {
    pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----[\s\S]+?-----END PGP PRIVATE KEY BLOCK-----/g,
    description: 'PGP Private Key',
    minEntropy: 5.0
  },
  // Environment variables with sensitive data
  env_secret: {
    pattern: /(SECRET|KEY|TOKEN|PASSWORD|API_KEY|CREDENTIALS)=['"]?([A-Za-z0-9+/=]{16,})['"]?/g,
    description: 'Environment Variable Secret',
    minEntropy: 3.0
  },
  // Database connection strings
  db_connection: {
    pattern: /(mongodb|mysql|postgresql|redis|sqlite):\/\/[^'"\s]+/g,
    description: 'Database Connection String',
    minEntropy: 3.0
  },
  // Cloud provider credentials
  cloud_credential: {
    pattern: /(AZURE|AWS|GCP|GCS|S3)_[A-Z_]+_KEY\s*=\s*['"]?([A-Za-z0-9+/=]{16,})['"]?/g,
    description: 'Cloud Provider Credential',
    minEntropy: 3.5
  }
};

/**
 * Detect security-related patterns in text content
 * @param {string} content - File content
 * @param {Object} options - Detection options
 * @param {number} options.minEntropy - Minimum entropy threshold
 * @param {string[]} options.enabledPatterns - Patterns to enable
 * @returns {Promise<Array<{type: string, value: string, line: number, column: number, confidence: number}>>}
 */
export async function detectPatterns(content, options = {}) {
  const { minEntropy = 3.0, enabledPatterns = Object.keys(SECURITY_PATTERNS) } = options;

  const findings = [];

  for (const [type, config] of Object.entries(SECURITY_PATTERNS)) {
    if (!enabledPatterns.includes(type)) {
      continue;
    }

    config.pattern.lastIndex = 0;
    let match;

    while ((match = config.pattern.exec(content)) !== null) {
      const value = match[0];

      // Extract the actual secret if in capture groups
      let secretValue = value;
      for (let i = 1; i < match.length; i++) {
        if (match[i] && match[i].length > 8) {
          secretValue = match[i];
          break;
        }
      }

      // Calculate entropy
      const entropy = calculateEntropy(secretValue);
      const threshold = config.minEntropy || minEntropy;

      if (entropy < threshold) {
        continue;
      }

      // Find line and column
      const index = match.index;
      const beforeMatch = content.substring(0, index);
      const lineNumber = beforeMatch.split('\n').length;
      const lastNewLine = beforeMatch.lastIndexOf('\n');
      const column = index - lastNewLine;

      // Determine confidence
      let confidence = 0.8;

      // Check for test/sample indicators
      const contextStart = Math.max(0, index - 30);
      const contextEnd = Math.min(content.length, index + secretValue.length + 30);
      const context = content.substring(contextStart, contextEnd);

      if (context.includes('test') || context.includes('example') || context.includes('sample')) {
        confidence -= 0.2;
      }
      if (
        context.includes('TODO') ||
        context.includes('FIXME') ||
        context.includes('placeholder')
      ) {
        confidence -= 0.3;
      }

      // Boost confidence for private keys
      if (type === 'private_key' || type === 'pgp_key') {
        confidence = Math.min(1, confidence + 0.1);
      }

      confidence = Math.max(0, Math.min(1, confidence));

      findings.push({
        type,
        value,
        secretValue,
        line: lineNumber,
        column,
        confidence,
        description: config.description,
        context: context.trim(),
        entropy
      });
    }
  }

  return findings;
}

/**
 * Register custom patterns for detection
 * @param {Object} customPatterns - Custom patterns to register
 */
export function registerCustomPatterns(customPatterns) {
  for (const [name, pattern] of Object.entries(customPatterns)) {
    SECURITY_PATTERNS[name] = {
      pattern: new RegExp(pattern, 'g'),
      description: `Custom Pattern: ${name}`,
      minEntropy: 3.0
    };
  }
}
