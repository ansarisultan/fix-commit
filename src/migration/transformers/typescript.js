/**
 * TypeScript Transformer Module
 * @module migration/transformers/typescript
 */

import { JavaScriptTransformer } from './javascript.js';
import { createLogger } from '../../cli/ui/logger.js';

const logger = createLogger();

/**
 * TypeScript AST Transformer
 * Extends JavaScript transformer with TypeScript-specific handling
 */
export class TypeScriptTransformer extends JavaScriptTransformer {
  /**
   * Transform TypeScript code to migrate secrets to environment variables
   * @param {string} content - Source code content
   * @param {Object} mappings - Secret to variable mappings
   * @param {Object} options - Transformation options
   * @returns {Promise<{content: string, changes: Array}>}
   */
  async transform(content, mappings, options = {}) {
    const { dryRun = false, envPrefix = 'process.env.' } = options;

    try {
      const result = await super.transform(content, mappings, {
        dryRun,
        envPrefix
      });

      const tsChanges = await this.transformTypeScriptSpecific(content, mappings, {
        dryRun,
        envPrefix
      });

      return {
        content: result.content,
        changes: [...result.changes, ...tsChanges]
      };
    } catch (error) {
      logger.debug(`TypeScript transformation failed: ${error.message}`);
      return this.transformWithRegex(content, mappings, options);
    }
  }

  /**
   * Transform TypeScript-specific patterns
   * @param {string} content - Source code content
   * @param {Object} mappings - Secret to variable mappings
   * @param {Object} options - Transformation options
   * @returns {Promise<Array>} Changes
   */
  async transformTypeScriptSpecific(content, mappings, options = {}) {
    const { dryRun = false, envPrefix = 'process.env.' } = options;
    const changes = [];
    let newContent = content;

    for (const mapping of mappings) {
      const value = mapping.matchedValue || mapping.value;
      const key = mapping.key || `SECRET_${mapping.type.toUpperCase()}`;
      const replacement = `${envPrefix}${key}`;

      const patterns = [
        new RegExp(`(['"])${escapeRegex(value)}\\1\\s+as\\s+const`, 'g'),
        new RegExp(`(['"])${escapeRegex(value)}\\1\\s*:\\s*string`, 'g'),
        new RegExp(`:\\s+['"]${escapeRegex(value)}['"]`, 'g'),
        new RegExp(`=\\s+['"]${escapeRegex(value)}['"]`, 'g')
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(newContent)) !== null) {
          changes.push({
            type: 'replace-ts',
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

    return changes;
  }

  /**
   * Detect TypeScript files
   * @param {string} filePath - File path
   * @returns {boolean} Whether this is a TypeScript file
   */
  static isTypeScriptFile(filePath) {
    return /\.(ts|tsx)$/i.test(filePath);
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default TypeScriptTransformer;
