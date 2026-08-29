#!/usr/bin/env node

/**
 * fix-commit CLI Entry Point
 * @module fix-commit/bin
 * @description Main entry point for the fix-commit CLI application
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { program } from 'commander';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

import { setupInitCommand } from '../src/cli/commands/init.js';
import { setupScanCommand } from '../src/cli/commands/scan.js';
import { setupMigrateCommand } from '../src/cli/commands/migrate.js';
import { setupStatusCommand } from '../src/cli/commands/status.js';

/**
 * Configure and run the CLI program
 */
function bootstrap() {
  program
    .name('fix-commit')
    .description('🔒 Intelligent pre-commit secret detection and migration')
    .version(packageJson.version)
    .helpOption('-h, --help', 'Display help information');

  // Setup commands
  setupInitCommand(program);
  setupScanCommand(program);
  setupMigrateCommand(program);
  setupStatusCommand(program);

  // Handle unknown commands
  program.on('command:*', () => {
    console.error(`✖ Unknown command: ${program.args.join(' ')}`);
    console.error('📖 See --help for available commands');
    process.exit(1);
  });

  // Parse arguments
  program.parse(process.argv);

  // Show help if no arguments provided
  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }
}

// Execute
try {
  bootstrap();
} catch (error) {
  console.error('✖ Fatal error:', error.message);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
}
