/**
 * Status Command - Show registry status and statistics
 * @module cli/commands/status
 */

import { getProjectRoot } from '../../utils/fs.js';
import { createLogger } from '../ui/logger.js';
import { RegistryManager } from '../../lifecycle/registry.js';

const logger = createLogger();

/**
 * Setup the status command
 * @param {import('commander').Command} program
 */
export function setupStatusCommand(program) {
  program
    .command('status')
    .description('Show secret tracking status')
    .option('-v, --verbose', 'Show detailed information')
    .option('-q, --quiet', 'Suppress non-essential output')
    .option('-c, --config <path>', 'Path to config file')
    .action(async options => {
      try {
        await executeStatus(options);
      } catch (error) {
        logger.error('Failed to get status:', error.message);
        if (options.verbose || process.env.DEBUG) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    });
}

/**
 * Execute the status command
 * @param {Object} options - Command options
 */
async function executeStatus(options) {
  const { verbose = false } = options;

  logger.header('📊 SecretGuard Status');

  const projectRoot = await getProjectRoot();
  logger.debug(`Project root: ${projectRoot}`);

  // Load registry
  const registry = new RegistryManager(projectRoot);
  await registry.load();

  const stats = registry.getStats();
  const activeSecrets = registry.getActiveSecrets();
  const migratedSecrets = registry.getMigratedSecrets();
  const resurrectedSecrets = registry.getResurrectedSecrets();

  // Display status
  logger.divider();
  logger.info('📈 Overview:');
  logger.info(`  🔐 Total secrets tracked: ${stats.total}`);
  logger.info(`  🟢 Active secrets: ${stats.active}`);
  logger.info(`  ✅ Migrated secrets: ${stats.migrated}`);
  logger.info(`  🔄 Resurrected secrets: ${stats.resurrected}`);

  if (verbose) {
    logger.divider();

    if (activeSecrets.length > 0) {
      logger.info('\n🟢 Active Secrets:');
      for (const secret of activeSecrets.slice(0, 10)) {
        logger.raw(`  - ${secret.type} (${secret.file}:${secret.line})`);
        logger.raw(`    First seen: ${secret.firstSeen}`);
        logger.raw(`    Confidence: ${(secret.confidence * 100).toFixed(0)}%`);
      }
      if (activeSecrets.length > 10) {
        logger.raw(`  ... and ${activeSecrets.length - 10} more`);
      }
    }

    if (migratedSecrets.length > 0) {
      logger.info('\n✅ Migrated Secrets:');
      for (const secret of migratedSecrets.slice(0, 10)) {
        logger.raw(`  - ${secret.type} (${secret.file}:${secret.line})`);
        logger.raw(`    Migrated: ${secret.metadata?.migratedAt || secret.lastSeen}`);
      }
      if (migratedSecrets.length > 10) {
        logger.raw(`  ... and ${migratedSecrets.length - 10} more`);
      }
    }

    if (resurrectedSecrets.length > 0) {
      logger.warn('\n🔄 Resurrected Secrets:');
      for (const secret of resurrectedSecrets) {
        logger.warn(`  - ${secret.type} (${secret.file}:${secret.line})`);
        logger.warn(`    Resurrected: ${secret.metadata?.resurrectedAt || secret.lastSeen}`);
      }
    }
  }

  logger.divider();

  // Recommendations
  if (stats.active > 0) {
    logger.warn(
      `\n💡 ${stats.active} active secrets found. Run 'secretguard migrate' to migrate them.`
    );
  }

  if (stats.resurrected > 0) {
    logger.warn(
      `\n⚠️  ${stats.resurrected} resurrected secrets found. Review them with 'secretguard scan'`
    );
  }

  if (stats.total === 0) {
    logger.info('\n✨ No secrets tracked yet. Run `secretguard scan` to start tracking.');
  }

  process.exit(0);
}
