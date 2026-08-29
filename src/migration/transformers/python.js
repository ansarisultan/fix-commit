/**
 * Python Transformer Module
 * @module migration/transformers/python
 */

/**
 * Python Transformer
 */
export class PythonTransformer {
  /**
   * Transform Python code to migrate secrets to environment variables
   * @param {string} content - Source code content
   * @param {Object} mappings - Secret to variable mappings
   * @param {Object} options - Transformation options
   * @returns {Promise<{content: string, changes: Array}>}
   */
  async transform(content, mappings, options = {}) {
    const { dryRun = false, envPrefix = 'os.environ.get' } = options;
    const changes = [];
    let newContent = content;

    for (const mapping of mappings) {
      const value = mapping.matchedValue || mapping.value;
      const key = mapping.key || `SECRET_${mapping.type.toUpperCase()}`;
      const replacement = `${envPrefix}('${key}')`;

      const patterns = [
        new RegExp(`(['"])${escapeRegex(value)}\\1`, 'g'),
        new RegExp(`:\\s+['"]${escapeRegex(value)}['"]`, 'g'),
        new RegExp(`([(,]\\s*)['"]${escapeRegex(value)}['"]`, 'g'),
        new RegExp(`f(['"])[^'"]*${escapeRegex(value)}[^'"]*\\1`, 'g')
      ];

      if (!newContent.includes('import os') && !dryRun) {
        const importRegex = /^import\s+os|^from\s+os\s+import/;
        if (!importRegex.test(newContent)) {
          const lines = newContent.split('\n');
          lines.splice(0, 0, 'import os');
          newContent = lines.join('\n');
          changes.push({
            type: 'import-add',
            line: 1,
            original: '',
            replacement: 'import os',
            key: 'os',
            mapping: null
          });
        }
      }

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
   * Detect Python files
   * @param {string} filePath - File path
   * @returns {boolean} Whether this is a Python file
   */
  static isPythonFile(filePath) {
    return /\.py$/i.test(filePath);
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

export default PythonTransformer;
