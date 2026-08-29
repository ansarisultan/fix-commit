/**
 * Default Configuration Module
 * @module config/defaults
 */

import path from 'path';

/**
 * Create default configuration
 * @param {string} _projectRoot
 * @returns {Object} Default configuration
 */
export function createDefaultConfig(_projectRoot) {
  return {
    version: '1.0.0',
    scan: {
      stagedOnly: true,
      autoMigrate: false,
      maxFileSize: 1024 * 1024, // 1MB
      excludePatterns: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '.git/**',
        'tests/**',
        '*.test.js',
        '*.spec.js',
        '*.log',
        '*.lock',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml'
      ],
      includePatterns: []
    },
    migration: {
      enabled: true,
      envFile: '.env',
      envExampleFile: '.env.example',
      backup: true,
      transformers: {
        javascript: true,
        typescript: true,
        python: false
      }
    },
    lifecycle: {
      tracking: true,
      registryFile: '.secretguard/registry.json',
      fingerprintAlgorithm: 'sha256'
    },
    git: {
      hookPath: '.git/hooks/pre-commit',
      reStageOnMigration: true
    },
    detectors: {
      enabled: ['api-keys', 'tokens', 'passwords'],
      customPatterns: [],
      minEntropy: 3.5
    }
  };
}

/**
 * Get the default configuration path
 * @param {string} projectRoot
 * @returns {string} Config file path
 */
export function getConfigPath(projectRoot) {
  return path.join(projectRoot, '.secretguard', 'config.json');
}
