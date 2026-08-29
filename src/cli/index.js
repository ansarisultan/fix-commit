/**
 * CLI Module Entry Point
 * @module cli
 */

export { setupInitCommand } from './commands/init.js';
export { setupScanCommand } from './commands/scan.js';
export { setupMigrateCommand } from './commands/migrate.js';
export { setupStatusCommand } from './commands/status.js';
export { createLogger } from './ui/logger.js';
export { createSpinner } from './ui/spinner.js';
