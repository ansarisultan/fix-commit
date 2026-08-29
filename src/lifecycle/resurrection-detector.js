/**
 * Resurrection Detector Module - Detect secret resurrection
 * @module lifecycle/resurrection-detector
 */

import { generateFingerprint } from './fingerprint.js';
import { createLogger } from '../cli/ui/logger.js';

const logger = createLogger();

/**
 * Resurrection Detector
 */
export class ResurrectionDetector {
  /**
   * Create a resurrection detector
   * @param {Object} registry - Registry manager instance
   * @param {Object} config - Configuration
   */
  constructor(registry, config = {}) {
    this.registry = registry;
    this.config = {
      warnOnResurrection: true,
      autoMarkResurrected: true,
      threshold: 7,
      ...config
    };
  }

  /**
   * Check for resurrected secrets
   * @param {Array} findings - Current scan findings
   * @returns {Promise<Array>} Resurrection warnings
   */
  async checkForResurrection(findings) {
    await this.registry.load();

    const warnings = [];
    const resurrected = [];

    for (const finding of findings) {
      const fingerprint = generateFingerprint(finding.value);
      const existing = this.registry.findSecretByFingerprint(fingerprint);

      if (!existing) {
        continue;
      }

      if (existing.status === 'migrated') {
        const migrationDate = new Date(existing.metadata?.migratedAt || existing.lastSeen);
        const now = new Date();
        const daysSinceMigration = (now - migrationDate) / (1000 * 60 * 60 * 24);

        const warning = {
          finding,
          existing,
          daysSinceMigration,
          isRecent: daysSinceMigration <= this.config.threshold,
          type: 'resurrection'
        };

        warnings.push(warning);

        if (this.config.autoMarkResurrected) {
          await this.registry.markAsResurrected(fingerprint, {
            file: finding.file,
            line: finding.line,
            detectedAt: new Date().toISOString()
          });
          resurrected.push(finding);
        }
      }

      if (existing.status === 'active' || existing.status === 'resurrected') {
        existing.lastSeen = new Date().toISOString();
        await this.registry.save();
      }
    }

    return {
      warnings,
      resurrected,
      totalWarnings: warnings.length,
      totalResurrected: resurrected.length
    };
  }

  /**
   * Generate resurrection report
   * @param {Array} findings - Current scan findings
   * @returns {Promise<Object>} Resurrection report
   */
  async generateReport(findings) {
    const result = await this.checkForResurrection(findings);

    return {
      summary: {
        totalWarnings: result.totalWarnings,
        totalResurrected: result.totalResurrected,
        hasResurrections: result.totalWarnings > 0
      },
      warnings: result.warnings.map(w => ({
        type: w.finding.type,
        file: w.finding.file,
        line: w.finding.line,
        value: w.finding.value.substring(0, 20) + '...',
        daysSinceMigration: Math.round(w.daysSinceMigration),
        isRecent: w.isRecent,
        originalMigrationDate: w.existing.metadata?.migratedAt || w.existing.lastSeen
      })),
      resurrected: result.resurrected
    };
  }

  /**
   * Display resurrection warnings
   * @param {Array} findings - Current scan findings
   * @returns {Promise<void>}
   */
  async displayWarnings(findings) {
    const report = await this.generateReport(findings);

    if (!report.summary.hasResurrections) {
      return;
    }

    logger.warn('\n⚠️  Secret Resurrection Detected!');
    logger.warn('='.repeat(50));

    for (const warning of report.warnings) {
      logger.warn(`\n  🔄 ${warning.type} in ${warning.file}:${warning.line}`);
      logger.warn(`     Value: ${warning.value}`);
      logger.warn(`     Previously migrated: ${warning.daysSinceMigration} days ago`);

      if (warning.isRecent) {
        logger.warn('     ⚠️  Recent resurrection (within threshold)');
      }
    }

    logger.warn('\n📝 Recommendations:');
    logger.warn('  1. Review why this secret was reintroduced');
    logger.warn('  2. Run `secretguard migrate` to migrate it again');
    logger.warn('  3. Consider code review to prevent reintroduction');
  }

  /**
   * Check if a secret has been resurrected
   * @param {string} value - Secret value
   * @returns {Promise<boolean>} Whether secret is resurrected
   */
  async isResurrected(value) {
    await this.registry.load();
    const fingerprint = generateFingerprint(value);
    const existing = this.registry.findSecretByFingerprint(fingerprint);

    return existing ? existing.status === 'resurrected' : false;
  }

  /**
   * Get resurrection history for a secret
   * @param {string} value - Secret value
   * @returns {Promise<Object|null>} Resurrection history
   */
  async getResurrectionHistory(value) {
    await this.registry.load();
    const fingerprint = generateFingerprint(value);
    const existing = this.registry.findSecretByFingerprint(fingerprint);

    if (!existing || existing.status !== 'resurrected') {
      return null;
    }

    return {
      fingerprint: existing.fingerprint,
      type: existing.type,
      firstSeen: existing.firstSeen,
      lastSeen: existing.lastSeen,
      resurrections: existing.metadata?.resurrectionHistory || [],
      latestResurrection: existing.metadata?.resurrectedAt || existing.lastSeen,
      totalResurrections: existing.metadata?.resurrectionHistory?.length || 0
    };
  }

  /**
   * Track resurrection in history
   * @param {string} fingerprint - Secret fingerprint
   * @param {Object} context - Resurrection context
   * @returns {Promise<void>}
   */
  async trackResurrection(fingerprint, context) {
    await this.registry.load();
    const existing = this.registry.findSecretByFingerprint(fingerprint);

    if (!existing) {
      return;
    }

    if (!existing.metadata.resurrectionHistory) {
      existing.metadata.resurrectionHistory = [];
    }

    existing.metadata.resurrectionHistory.push({
      detectedAt: new Date().toISOString(),
      file: context.file,
      line: context.line,
      context: context.context
    });

    if (existing.metadata.resurrectionHistory.length > 10) {
      existing.metadata.resurrectionHistory = existing.metadata.resurrectionHistory.slice(-10);
    }

    await this.registry.save();
  }
}

export default ResurrectionDetector;
