/**
 * Verifier Module - Verify migrations
 * @module migration/verifier
 */

import { readFile, fileExists } from '../utils/fs.js';
import { createLogger } from '../cli/ui/logger.js';
import { getTransformer, isTransformable } from './transformers/index.js';

const logger = createLogger();

/**
 * Verifier - Verify secret migrations
 */
export class Verifier {
  /**
   * Create a verifier instance
   * @param {string} projectRoot - Project root directory
   */
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }

  /**
   * Verify that migrations were successful
   * @param {Array} migrated - Migrated files
   * @param {Object} options - Verification options
   * @param {boolean} options.dryRun - Dry run mode
   * @param {boolean} options.quiet - Suppress output
   * @returns {Promise<Object>} Verification results
   */
  async verify(migrated, options = {}) {
    const { dryRun = false, quiet = false } = options;

    if (!quiet) {
      logger.info('🔍 Verifying migrations...');
    }

    const results = {
      total: migrated.length,
      verified: 0,
      failed: 0,
      details: []
    };

    for (const migration of migrated) {
      const verification = await this.verifyFile(migration, { dryRun, quiet });

      if (verification.success) {
        results.verified++;
      } else {
        results.failed++;
      }

      results.details.push(verification);
    }

    if (!quiet) {
      logger.success(`✅ ${results.verified}/${results.total} files verified`);
      if (results.failed > 0) {
        logger.warn(`⚠️  ${results.failed} files failed verification`);
      }
    }

    return results;
  }

  /**
   * Verify a single file migration
   * @param {Object} migration - Migration result
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Verification result
   */
  async verifyFile(migration, options = {}) {
    const { dryRun = false } = options;
    const { file, changes } = migration;

    if (!(await fileExists(file))) {
      return {
        success: false,
        file,
        error: 'File does not exist',
        details: []
      };
    }

    if (!isTransformable(file)) {
      return {
        success: false,
        file,
        error: 'File type not supported',
        details: []
      };
    }

    try {
      const content = await readFile(file);

      const verificationDetails = [];

      for (const change of changes) {
        const isApplied = this.checkChangeApplied(content, change);
        verificationDetails.push({
          change,
          applied: isApplied
        });
      }

      const allApplied = verificationDetails.every(d => d.applied);
      const appliedCount = verificationDetails.filter(d => d.applied).length;

      let transformerVerification = null;
      if (!dryRun) {
        const transformer = getTransformer(file);
        if (transformer) {
          const hasSecrets = await this.checkForRemainingSecrets(content, changes);

          transformerVerification = {
            hasRemainingSecrets: hasSecrets,
            valid: !hasSecrets
          };
        }
      }

      return {
        success: allApplied && (dryRun || !transformerVerification?.hasRemainingSecrets),
        file,
        appliedCount,
        totalChanges: changes.length,
        details: verificationDetails,
        transformerVerification,
        error: allApplied ? null : 'Some changes were not applied'
      };
    } catch (error) {
      return {
        success: false,
        file,
        error: error.message,
        details: []
      };
    }
  }

  /**
   * Check if a change was applied to content
   * @param {string} content - File content
   * @param {Object} change - Change to check
   * @returns {boolean}
   */
  checkChangeApplied(content, change) {
    if (change.original && !content.includes(change.original)) {
      return true;
    }

    if (change.replacement && content.includes(change.replacement)) {
      return true;
    }

    return false;
  }

  /**
   * Check for remaining secrets in file
   * @param {string} content - File content
   * @param {Array} changes - Changes made
   * @returns {Promise<boolean>} Whether secrets remain
   */
  async checkForRemainingSecrets(content, changes) {
    for (const change of changes) {
      if (change.original && content.includes(change.original)) {
        return true;
      }
    }

    const secretPatterns = [
      /sk-[A-Za-z0-9]{32,}/,
      /ghp_[A-Za-z0-9]{36,}/,
      /AKIA[0-9A-Z]{16}/,
      /AIza[0-9A-Za-z\-_]{35}/,
      /password\s*[:=]\s*['"][^'"]{8,}['"]/i
    ];

    for (const pattern of secretPatterns) {
      if (pattern.test(content)) {
        return true;
      }
    }

    return false;
  }
}

export default Verifier;
