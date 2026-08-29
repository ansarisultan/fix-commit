/**
 * Token Detector Module
 * @module scanner/detectors/tokens
 */

import { calculateEntropy } from '../../utils/entropy.js';

/**
 * Token patterns
 */
const TOKEN_PATTERNS = {
  jwt: {
    pattern: /eyJ[A-Za-z0-9-_]{10,}\.eyJ[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{10,}/g,
    description: 'JWT Token',
    minEntropy: 4.0
  },
  refresh_token: {
    pattern: /refresh_token=[A-Za-z0-9+/]{32,}={0,2}/g,
    description: 'Refresh Token',
    minEntropy: 3.5
  },
  access_token: {
    pattern: /access_token=[A-Za-z0-9+/]{32,}={0,2}/g,
    description: 'Access Token',
    minEntropy: 3.5
  },
  session_token: {
    pattern: /session(_|\.)token=[A-Za-z0-9+/]{32,}={0,2}/g,
    description: 'Session Token',
    minEntropy: 3.5
  },
  oauth_token: {
    pattern: /oauth_token=[A-Za-z0-9+/]{32,}={0,2}/g,
    description: 'OAuth Token',
    minEntropy: 3.5
  },
  bearer_token: {
    pattern: /Bearer\s+[A-Za-z0-9+/]{32,}={0,2}/g,
    description: 'Bearer Token',
    minEntropy: 3.5
  }
};

/**
 * Detect tokens in text content
 * @param {string} content - File content
 * @param {Object} options - Detection options
 * @param {number} options.minEntropy - Minimum entropy threshold
 * @returns {Promise<Array<{type: string, value: string, line: number, column: number, confidence: number}>>}
 */
export async function detectTokens(content, options = {}) {
  const { minEntropy = 3.5 } = options;

  const findings = [];

  for (const [type, config] of Object.entries(TOKEN_PATTERNS)) {
    config.pattern.lastIndex = 0;
    let match;

    while ((match = config.pattern.exec(content)) !== null) {
      const value = match[0];
      const tokenMatch = match[1] || value;

      if (tokenMatch.length < 16) {
        continue;
      }

      const entropy = calculateEntropy(tokenMatch);
      const threshold = config.minEntropy || minEntropy;

      if (entropy < threshold) {
        continue;
      }

      const index = match.index;
      const beforeMatch = content.substring(0, index);
      const lineNumber = beforeMatch.split('\n').length;
      const lastNewLine = beforeMatch.lastIndexOf('\n');
      const column = index - lastNewLine;

      let confidence = 0.7;

      const contextStart = Math.max(0, index - 30);
      const contextEnd = Math.min(content.length, index + value.length + 30);
      const context = content.substring(contextStart, contextEnd);

      if (context.includes('secret') || context.includes('token') || context.includes('auth')) {
        confidence += 0.2;
      }
      if (context.includes('test') || context.includes('example') || context.includes('demo')) {
        confidence -= 0.3;
      }

      if (type === 'jwt') {
        const parts = value.split('.');
        if (parts.length === 3) {
          try {
            const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
            if (header.alg) {
              confidence += 0.1;
            }
          } catch {
            confidence -= 0.3;
          }
        }
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
