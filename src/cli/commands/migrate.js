/**
 * Migrate Command - Migrate secrets to environment variables
 * @module cli/commands/migrate
 */

import { getProjectRoot } from '../../utils/fs.js';
import { createLogger } from '../ui/logger.js';
import { createScanner } from '../../scanner/scanner.js';
import { Migrator } from '../../migration/migrator.js';
import { loadConfig } from '../../config/loader.js';
import { filterFalsePositives } from '../../scanner/false-positive.js';

const logger = createLogger();

/**
 * Setup the migrate command
 * @param {import('commander').Command} program
 */
export function setupMigrateCommand(program) {
  program
    .command('migrate')
    .description('Migrate secrets to environment variables')
    .option('-d, --dry-run', 'Show what would be changed without applying')
    .option('-a, --all', 'Migrate all secrets, not just staged')
    .option('-q, --quiet', 'Suppress non-essential output')
    .option('-v, --verbose', 'Enable verbose output')
    .option('-c, --config <path>', 'Path to config file')
    .option('-y, --yes', 'Auto-approve all migrations')
    .action(async options => {
      try {
        await executeMigrate(options);
      } catch (error) {
        logger.error('Migration failed:', error.message);
        if (options.verbose || process.env.DEBUG) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    });
}

/**
 * Execute the migrate command
 * @param {Object} options - Command options
 */
async function executeMigrate(options) {
  const { dryRun = false, quiet = false, verbose = false, yes = false } = options;

  logger.header(dryRun ? '🔍 SecretGuard Migration (Dry Run)' : '🔄 SecretGuard Migration');

  const projectRoot = await getProjectRoot();
  logger.debug(`Project root: ${projectRoot}`);

  // Load configuration
  const config = await loadConfig(projectRoot, options.config);
  logger.debug('Configuration loaded');

  // Create scanner
  const scanner = createScanner({
    ...config.scan,
    quiet,
    verbose
  });

  // Scan for secrets
  const scanResults = await scanner.scanStaged(projectRoot, {
    quiet,
    verbose,
    all: options.all
  });

  if (scanResults.findings.length === 0) {
    logger.info('✨ No secrets found to migrate.');
    return;
  }

  // Filter false positives
  const validFindings = filterFalsePositives(scanResults.findings, {
    projectRoot
  });

  if (validFindings.length === 0) {
    logger.info('✨ No valid secrets found to migrate (all were false positives).');
    return;
  }

  if (validFindings.length < scanResults.findings.length) {
    logger.info(
      `🔍 Filtered out ${scanResults.findings.length - validFindings.length} false positives`
    );
  }

  // Confirm migration
  if (!dryRun && !yes && !quiet) {
    logger.warn(`\n⚠️  Found ${validFindings.length} secrets that need migration`);
    logger.info('\nThis will:');
    logger.info('  1. Replace secrets with environment variables');
    logger.info('  2. Create/update .env file with new secret values');
    logger.info('  3. Update .env.example with placeholder values');
    logger.info('  4. Update .gitignore to keep secrets safe');

    const { confirm } = await import('../../cli/ui/prompts.js');
    const confirmed = await confirm('Continue with migration?');

    if (!confirmed) {
      logger.info('Migration cancelled.');
      return;
    }
  }

  // Create migrator
  const migrator = new Migrator(projectRoot, {
    ...config.migration,
    autoApprove: yes
  });

  // Run migration
  const results = await migrator.migrate(validFindings, {
    dryRun,
    quiet,
    verbose
  });

  // Handle results
  if (dryRun) {
    logger.info('\n📝 Dry run complete. To apply changes, run without --dry-run');
  }

  if (results.failed.length > 0) {
    process.exit(1);
  }

  process.exit(0);
}
