/**
 * JavaScript Transformer Module
 * @module migration/transformers/javascript
 */

import { createLogger } from '../../cli/ui/logger.js';

const logger = createLogger();

/**
 * JavaScript AST Transformer
 */
export class JavaScriptTransformer {
  /**
   * Transform JavaScript code to migrate secrets to environment variables
   * @param {string} content - Source code content
   * @param {Object} mappings - Secret to variable mappings
   * @param {Object} options - Transformation options
   * @returns {Promise<{content: string, changes: Array}>}
   */
  async transform(content, mappings, options = {}) {
    try {
      return await this.transformWithRegex(content, mappings, options);
    } catch (error) {
      logger.debug(`Transformation failed: ${error.message}`);
      return { content, changes: [] };
    }
  }

  /**
   * Transform using regex
   * @param {string} content - Source code content
   * @param {Object} mappings - Secret to variable mappings
   * @param {Object} options - Transformation options
   * @returns {Promise<{content: string, changes: Array}>}
   */
  async transformWithRegex(content, mappings, options = {}) {
    const { dryRun = false, envPrefix = 'process.env.' } = options;
    const changes = [];
    let newContent = content;

    for (const mapping of mappings) {
      const value = mapping.matchedValue || mapping.value;
      const key = mapping.key || `SECRET_${mapping.type.toUpperCase()}`;
      const replacement = `${envPrefix}${key}`;

      const patterns = [
        new RegExp(`(['"])${escapeRegex(value)}\\1`, 'g'),
        new RegExp(`(\`${escapeRegex(value)}\`)`, 'g'),
        new RegExp(`(["'])${escapeRegex(value)}["']\\s*[:=]`, 'g')
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(newContent)) !== null) {
          changes.push({
            type: 'replace',
            line: this.findLineNumber(newContent, match.index),
            column: 0,
            original: match[0],
            replacement: replacement,
            key,
            mapping
          });

          if (!dryRun) {
            newContent = newContent.replace(pattern, replacement);
          }
        }
      }
    }

    return { content: newContent, changes };
  }

  /**
   * Find line number at position
   * @param {string} content - Source code
   * @param {number} position - Character position
   * @returns {number} Line number
   */
  findLineNumber(content, position) {
    const before = content.substring(0, position);
    return before.split('\n').length;
  }

  /**
   * Detect JavaScript files
   * @param {string} filePath - File path
   * @returns {boolean} Whether this is a JavaScript file
   */
  static isJavaScriptFile(filePath) {
    return /\.(js|jsx|mjs|cjs)$/i.test(filePath);
  }
}

/**
 * Escape regex special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default JavaScriptTransformer;
