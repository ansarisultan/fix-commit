/**
 * Migrator Module - Main migration engine
 * @module migration/migrator
 */

import path from 'path';
import { getTransformer, isTransformable } from './transformers/index.js';
import { EnvManager } from './env-manager.js';
import { GitignoreManager } from './gitignore-manager.js';
import { Verifier } from './verifier.js';
import { createLogger } from '../cli/ui/logger.js';
import { createSpinner } from '../cli/ui/spinner.js';
import { readFile, writeFile, createBackup } from '../utils/fs.js';

const logger = createLogger();

/**
 * Migrator - Main migration orchestrator
 */
export class Migrator {
  /**
   * Create a migrator instance
   * @param {string} projectRoot - Project root directory
   * @param {Object} config - Migrator configuration
   */
  constructor(projectRoot, config = {}) {
    this.projectRoot = projectRoot;
    this.config = {
      backup: true,
      autoApprove: false,
      envFile: '.env',
      envExampleFile: '.env.example',
      ...config
    };

    this.envManager = new EnvManager(projectRoot, {
      envFile: this.config.envFile,
      envExampleFile: this.config.envExampleFile
    });
    this.gitignoreManager = new GitignoreManager(projectRoot);
    this.verifier = new Verifier(projectRoot);
  }

  /**
   * Migrate findings to use environment variables
   * @param {Array} findings - Scan findings
   * @param {Object} options - Migration options
   * @param {boolean} options.dryRun - Whether to perform a dry run
   * @param {boolean} options.quiet - Suppress output
   * @param {boolean} options.verbose - Enable verbose output
   * @returns {Promise<{migrated: Array, failed: Array, summary: Object}>}
   */
  async migrate(findings, options = {}) {
    const { dryRun = false, quiet = false, verbose = false } = options;

    if (!quiet) {
      logger.header('🔄 Secret Migration');
    }

    const groupedFindings = this.groupByFile(findings);
    const totalFindings = findings.length;

    const spinner = createSpinner(`Migrating ${totalFindings} secrets...`);
    spinner.start();

    try {
      let backupPath = null;
      if (this.config.backup && !dryRun) {
        backupPath = await this.envManager.backupEnv();
        if (backupPath && !quiet) {
          logger.debug(`Backup created: ${backupPath}`);
        }
      }

      const results = [];
      const migrated = [];
      const failed = [];

      for (const [filePath, fileFindings] of Object.entries(groupedFindings)) {
        if (verbose && !quiet) {
          spinner.update(`Processing ${path.basename(filePath)}...`);
        }

        try {
          const result = await this.migrateFile(filePath, fileFindings, {
            dryRun,
            quiet,
            verbose
          });

          if (result.success) {
            migrated.push({
              file: filePath,
              changes: result.changes,
              envVars: result.envVars
            });
            results.push(result);
          } else {
            failed.push({
              file: filePath,
              error: result.error
            });
          }
        } catch (error) {
          failed.push({
            file: filePath,
            error: error.message
          });
          if (verbose) {
            logger.debug(`Migration failed for ${filePath}: ${error.message}`);
          }
        }
      }

      if (migrated.length > 0 && !dryRun) {
        const allEnvVars = this.collectEnvVars(migrated);
        await this.envManager.updateEnvExample(allEnvVars);
      }

      const verification = await this.verifier.verify(migrated, {
        dryRun,
        quiet
      });

      spinner.success(
        `Migration complete: ${migrated.length} files, ${this.countMigrations(migrated)} secrets migrated`
      );

      const summary = this.generateSummary(results, failed);

      if (!quiet) {
        this.displayResults(results, failed, summary);
      }

      return {
        migrated,
        failed,
        summary,
        backupPath,
        verification
      };
    } catch (error) {
      spinner.error(`Migration failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Migrate a single file
   * @param {string} filePath - File path
   * @param {Array} findings - Findings for this file
   * @param {Object} options - Migration options
   * @returns {Promise<Object>} Migration result
   */
  async migrateFile(filePath, findings, options = {}) {
    const { dryRun = false } = options;

    if (!isTransformable(filePath)) {
      return {
        success: false,
        error: 'File type not supported for migration',
        changes: []
      };
    }

    const transformer = getTransformer(filePath);
    if (!transformer) {
      return {
        success: false,
        error: 'No transformer available for this file type',
        changes: []
      };
    }

    const content = await readFile(filePath);

    const mappings = findings.map(finding => ({
      value: finding.value,
      matchedValue: finding.value,
      type: finding.type,
      key: this.generateEnvVarKey(finding),
      confidence: finding.confidence
    }));

    const transformResult = await transformer.transform(content, mappings, {
      dryRun,
      envPrefix: this.config.envPrefix || 'process.env.'
    });

    const envVars = new Map();
    for (const change of transformResult.changes) {
      if (change.key && !envVars.has(change.key)) {
        const value = this.envManager.generateSecretValue(change.mapping?.type || 'SECRET');
        envVars.set(change.key, value);
      }
    }

    if (transformResult.changes.length > 0 && !dryRun) {
      if (this.config.backup) {
        await createBackup(filePath);
      }

      await writeFile(filePath, transformResult.content);
    }

    if (envVars.size > 0 && !dryRun) {
      await this.envManager.updateEnv(Object.fromEntries(envVars), true);
    }

    return {
      success: true,
      file: filePath,
      changes: transformResult.changes,
      envVars: Object.fromEntries(envVars),
      transformed: transformResult.content
    };
  }

  /**
   * Generate environment variable key from finding
   * @param {Object} finding - Scan finding
   * @returns {string} Environment variable key
   */
  generateEnvVarKey(finding) {
    const type = finding.type || 'SECRET';

    const cleanType = type
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();

    const fileName = finding.file
      ? path
          .basename(finding.file, path.extname(finding.file))
          .toUpperCase()
          .replace(/[^A-Z0-9_]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '')
      : '';

    if (fileName && fileName.length > 2 && fileName !== cleanType) {
      return `${cleanType}_${fileName}_${suffix}`;
    }

    return `${cleanType}_${suffix}`;
  }

  /**
   * Group findings by file
   * @param {Array} findings - Scan findings
   * @returns {Object} Grouped findings
   */
  groupByFile(findings) {
    const grouped = {};

    for (const finding of findings) {
      const file = finding.file || 'unknown';
      if (!grouped[file]) {
        grouped[file] = [];
      }
      grouped[file].push(finding);
    }

    return grouped;
  }

  /**
   * Collect environment variables from migrated files
   * @param {Array} migrated - Migrated files
   * @returns {Map<string, string>} Environment variables
   */
  collectEnvVars(migrated) {
    const envVars = new Map();

    for (const result of migrated) {
      for (const [key, value] of Object.entries(result.envVars)) {
        if (!envVars.has(key)) {
          envVars.set(key, value);
        }
      }
    }

    return envVars;
  }

  /**
   * Count total migrations
   * @param {Array} migrated - Migrated files
   * @returns {number} Number of migrations
   */
  countMigrations(migrated) {
    return migrated.reduce((total, result) => {
      return total + result.changes.length;
    }, 0);
  }

  /**
   * Generate summary
   * @param {Array} results - Migration results
   * @param {Array} failed - Failed migrations
   * @returns {Object} Summary
   */
  generateSummary(results, failed) {
    const totalFiles = results.length + failed.length;
    const successfulFiles = results.filter(r => r.success).length;
    const totalChanges = results.reduce((sum, r) => sum + r.changes.length, 0);

    return {
      totalFiles,
      successfulFiles,
      failedFiles: failed.length,
      totalChanges,
      envVarsAdded: new Set(results.flatMap(r => Object.keys(r.envVars || {}))).size
    };
  }

  /**
   * Display migration results
   * @param {Array} results - Migration results
   * @param {Array} failed - Failed migrations
   * @param {Object} summary - Summary
   */
  displayResults(results, failed, summary) {
    logger.divider();

    if (summary.totalChanges === 0) {
      logger.info('✨ No changes needed. All secrets already migrated.');
      return;
    }

    logger.success(`✅ ${summary.totalChanges} secrets migrated successfully`);

    if (failed.length > 0) {
      logger.warn(`\n⚠️  ${failed.length} files had issues:`);
      for (const fail of failed) {
        logger.raw(`  ❌ ${path.basename(fail.file)}: ${fail.error}`);
      }
    }

    logger.divider();
    logger.info('📊 Migration Summary:');
    logger.info(`  📁 Files processed: ${summary.totalFiles}`);
    logger.info(`  ✅ Files migrated: ${summary.successfulFiles}`);
    logger.info(`  🔄 Changes made: ${summary.totalChanges}`);
    logger.info(`  🔐 Environment variables added: ${summary.envVarsAdded}`);

    logger.divider();

    if (summary.successfulFiles > 0) {
      logger.info('\n📝 Next steps:');
      logger.info('  1. Review the changes in your files');
      logger.info('  2. Check .env file for the new secrets');
      logger.info('  3. Stage the changes: git add .');
      logger.info(
        '  4. Commit your changes: git commit -m "Migrate secrets to environment variables"'
      );
    }
  }
}

export default Migrator;
