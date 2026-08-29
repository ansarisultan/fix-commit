/**
 * Configuration Loader Module
 * @module config/loader
 */

import fs from 'fs/promises';
import { createDefaultConfig, getConfigPath } from './defaults.js';
import { fileExists } from '../utils/fs.js';

/**
 * Load configuration
 * @param {string} projectRoot - Project root directory
 * @param {string} configPath - Custom config path
 * @returns {Promise<Object>} Configuration
 */
export async function loadConfig(projectRoot, configPath = null) {
  const configFile = configPath || getConfigPath(projectRoot);

  if (await fileExists(configFile)) {
    try {
      const content = await fs.readFile(configFile, 'utf-8');
      const config = JSON.parse(content);

      // Merge with defaults
      const defaults = createDefaultConfig(projectRoot);
      return deepMerge(defaults, config);
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  }

  // Return default config if no config file
  return createDefaultConfig(projectRoot);
}

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = deepMerge(target[key] || {}, value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
