/**
 * Lifecycle Module - Main exports
 * @module lifecycle
 */

import { RegistryManager } from './registry.js';
import { DuplicateDetector } from './duplicate-detector.js';
import { ResurrectionDetector } from './resurrection-detector.js';

export { RegistryManager } from './registry.js';
export { DuplicateDetector } from './duplicate-detector.js';
export { ResurrectionDetector } from './resurrection-detector.js';
export * from './fingerprint.js';

/**
 * Create lifecycle manager
 * @param {string} projectRoot - Project root directory
 * @param {Object} config - Configuration
 * @returns {Object} Lifecycle manager
 */
export function createLifecycleManager(projectRoot, config = {}) {
  const registry = new RegistryManager(projectRoot, config);
  const duplicateDetector = new DuplicateDetector(config);
  const resurrectionDetector = new ResurrectionDetector(registry, config);

  return {
    registry,
    duplicateDetector,
    resurrectionDetector,

    /**
     * Process findings with full lifecycle management
     */
    async processFindings(findings) {
      await registry.load();

      const added = await registry.addSecrets(findings);
      const duplicateResult = duplicateDetector.detectDuplicates(findings);
      const resurrectionResult = await resurrectionDetector.checkForResurrection(findings);

      return {
        added,
        duplicates: duplicateResult,
        resurrections: resurrectionResult,
        stats: registry.getStats()
      };
    },

    /**
     * Generate comprehensive report
     */
    async generateReport(findings) {
      await registry.load();

      const resurrectionReport = await resurrectionDetector.generateReport(findings);
      const stats = registry.getStats();
      const activeSecrets = registry.getActiveSecrets();
      const migratedSecrets = registry.getMigratedSecrets();

      return {
        stats,
        activeSecrets: activeSecrets.length,
        migratedSecrets: migratedSecrets.length,
        resurrections: resurrectionReport,
        registry: {
          totalSecrets: stats.total,
          byStatus: {
            active: stats.active,
            migrated: stats.migrated,
            resurrected: stats.resurrected
          }
        }
      };
    }
  };
}

export default {
  RegistryManager,
  DuplicateDetector,
  ResurrectionDetector,
  createLifecycleManager
};
