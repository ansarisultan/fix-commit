/**
 * Scan Command - Scan for secrets in staged files
 * @module cli/commands/scan
 */

import { getProjectRoot } from '../../utils/fs.js';
import { createLogger } from '../ui/logger.js';
import { createScanner } from '../../scanner/scanner.js';
import { loadConfig } from '../../config/loader.js';

const logger = createLogger();

/**
 * Setup the scan command
 * @param {import('commander').Command} program
 */
export function setupScanCommand(program) {
  program
    .command('scan')
    .description('Scan staged files for secrets')
    .option('-a, --all', 'Scan all files, not just staged')
    .option('-q, --quiet', 'Suppress non-essential output')
    .option('-v, --verbose', 'Enable verbose output')
    .option('-c, --config <path>', 'Path to config file')
    .action(async options => {
      try {
        await executeScan(options);
      } catch (error) {
        logger.error('Scan failed:', error.message);
        if (options.verbose || process.env.DEBUG) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    });
}

/**
 * Execute the scan command
 * @param {Object} options - Command options
 */
async function executeScan(options) {
  const { quiet = false, verbose = false, all = false } = options;

  logger.header('🔍 SecretGuard Scan');

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

  // Run scan
  const results = await scanner.scanStaged(projectRoot, {
    quiet,
    verbose,
    all
  });

  // Exit with appropriate code
  if (results.summary.critical > 0 || results.summary.high > 0) {
    logger.warn('\n💡 Use `secretguard migrate` to safely migrate these secrets');
    process.exit(1);
  }

  if (results.summary.total > 0) {
    logger.warn('\n💡 Review the findings and consider running `secretguard migrate`');
    process.exit(0);
  }

  process.exit(0);
}
