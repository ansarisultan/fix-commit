/**
 * Transformers Index Module
 * @module migration/transformers
 */

import { JavaScriptTransformer } from './javascript.js';
import { TypeScriptTransformer } from './typescript.js';
import { PythonTransformer } from './python.js';

/**
 * Get appropriate transformer for a file
 * @param {string} filePath - File path
 * @returns {Object|null} Transformer instance or null
 */
export function getTransformer(filePath) {
  if (TypeScriptTransformer.isTypeScriptFile(filePath)) {
    return new TypeScriptTransformer();
  }

  if (JavaScriptTransformer.isJavaScriptFile(filePath)) {
    return new JavaScriptTransformer();
  }

  if (PythonTransformer.isPythonFile(filePath)) {
    return new PythonTransformer();
  }

  return null;
}

/**
 * Check if a file is transformable
 * @param {string} filePath - File path
 * @returns {boolean}
 */
export function isTransformable(filePath) {
  return getTransformer(filePath) !== null;
}

/**
 * Get supported file extensions
 * @returns {string[]} Supported extensions
 */
export function getSupportedExtensions() {
  return ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.py'];
}

export default {
  getTransformer,
  isTransformable,
  getSupportedExtensions
};
