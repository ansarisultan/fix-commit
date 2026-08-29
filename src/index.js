/**
 * Main Library Entry Point
 * @module fix-commit
 */

export { Scanner, createScanner } from './scanner/scanner.js';
export { Migrator } from './migration/migrator.js';
export { RegistryManager } from './lifecycle/registry.js';
export { loadConfig } from './config/loader.js';
export { setupGitHooks } from './git/hooks.js';
