/**
 * API Key Detector Module
 * @module scanner/detectors/api-keys
 */

import { calculateEntropy } from '../../utils/entropy.js';

/**
 * API Key patterns for various services
 */
const API_KEY_PATTERNS = {
  openai: {
    pattern: /sk-[A-Za-z0-9_-]{32,60}/g,
    description: 'OpenAI API Key'
  },
  github: {
    pattern: /(ghp_[A-Za-z0-9]{36,40})|(gho_[A-Za-z0-9]{36,40})|(ghu_[A-Za-z0-9]{36,40})/g,
    description: 'GitHub Personal Access Token'
  },
  aws: {
    pattern: /AKIA[0-9A-Z]{16}/g,
    description: 'AWS Access Key ID'
  },
  aws_secret: {
    pattern: /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/g,
    description: 'AWS Secret Access Key'
  },
  google: {
    pattern: /AIza[0-9A-Za-z\-_]{35}/g,
    description: 'Google API Key'
  },
  stripe: {
    pattern: /sk_live_[A-Za-z0-9]{24}/g,
    description: 'Stripe Secret Key'
  },
  stripe_publishable: {
    pattern: /pk_live_[A-Za-z0-9]{24}/g,
    description: 'Stripe Publishable Key'
  },
  slack: {
    pattern: /xoxb-[0-9]{12}-[0-9]{12}-[A-Za-z0-9]{24}/g,
    description: 'Slack Bot Token'
  },
  discord: {
    pattern: /[A-Za-z0-9-]{24}\.[A-Za-z0-9-]{6}\.[A-Za-z0-9-]{27}/g,
    description: 'Discord Bot Token'
  },
  twilio: {
    pattern: /SK[0-9a-fA-F]{32}/g,
    description: 'Twilio API Key'
  },
  heroku: {
    pattern: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
    description: 'Heroku API Key'
  }
};

/**
 * Detect API keys in text content
 * @param {string} content - File content
 * @param {Object} options - Detection options
 * @param {number} options.minEntropy - Minimum entropy threshold
 * @param {string[]} options.enabledServices - Services to check
 * @returns {Promise<Array<{type: string, value: string, line: number, column: number, confidence: number}>>}
 */
export async function detectApiKeys(content, options = {}) {
  const { minEntropy = 3.5, enabledServices = Object.keys(API_KEY_PATTERNS) } = options;

  const findings = [];

  for (const [service, config] of Object.entries(API_KEY_PATTERNS)) {
    if (!enabledServices.includes(service)) {
      continue;
    }

    config.pattern.lastIndex = 0;
    let match;

    while ((match = config.pattern.exec(content)) !== null) {
      const value = match[0];

      if (value.length < 8) {
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

      let confidence = 0.8;

      const contextStart = Math.max(0, index - 20);
      const contextEnd = Math.min(content.length, index + value.length + 20);
      const context = content.substring(contextStart, contextEnd);

      if (context.includes('secret') || context.includes('key') || context.includes('token')) {
        confidence += 0.1;
      }
      if (context.includes('sample') || context.includes('example') || context.includes('test')) {
        confidence -= 0.2;
      }
      if (context.includes('console.log') || context.includes('print')) {
        confidence -= 0.1;
      }

      confidence = Math.max(0, Math.min(1, confidence));

      findings.push({
        type: service,
        value: value,
        line: lineNumber,
        column: column,
        confidence: confidence,
        description: API_KEY_PATTERNS[service].description,
        context: context.trim()
      });
    }
  }

  return findings;
}

/**
 * Check if a value looks like an API key
 * @param {string} value - Value to check
 * @param {number} minEntropy - Minimum entropy
 * @returns {boolean}
 */
export function looksLikeApiKey(value, minEntropy = 3.5) {
  for (const config of Object.values(API_KEY_PATTERNS)) {
    const pattern = new RegExp(config.pattern.source, 'g');
    if (pattern.test(value)) {
      const entropy = calculateEntropy(value);
      return entropy >= minEntropy;
    }
  }
  return false;
}
