/**
 * Init Command - Setup SecretGuard in a project
 * @module cli/commands/init
 */

import fs from 'fs/promises';
import path from 'path';
import { getProjectRoot } from '../../utils/fs.js';
import { createLogger } from '../ui/logger.js';
import { setupGitHooks } from '../../git/hooks.js';
import { createDefaultConfig } from '../../config/defaults.js';

const logger = createLogger();

/**
 * Setup the init command
 * @param {import('commander').Command} program
 */
export function setupInitCommand(program) {
  program
    .command('init')
    .description('Initialize SecretGuard in your project')
    .option('-f, --force', 'Force re-initialization')
    .action(async options => {
      try {
        await executeInit(options);
      } catch (error) {
        logger.error('Initialization failed:', error.message);
        if (process.env.DEBUG) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    });
}

/**
 * Execute the init command
 * @param {Object} options
 */
async function executeInit(options) {
  logger.header('🔒 SecretGuard Initialization');

  const projectRoot = await getProjectRoot();
  logger.info(`📁 Project root: ${projectRoot}`);

  // Check if already initialized
  const configPath = path.join(projectRoot, '.secretguard', 'config.json');
  const isInitialized = await fileExists(configPath);

  if (isInitialized && !options.force) {
    logger.warn('⚠️  SecretGuard is already initialized');
    logger.info('💡 Use --force to re-initialize');
    return;
  }

  // Create .secretguard directory
  await createSecretGuardDir(projectRoot);

  // Create default config
  const config = createDefaultConfig(projectRoot);
  await writeConfig(configPath, config);
  logger.success('✅ Created configuration');

  // Setup .gitignore entries
  await setupGitIgnore(projectRoot);
  logger.success('✅ Updated .gitignore');

  // Setup Git hooks
  await setupGitHooks(projectRoot);
  logger.success('✅ Installed pre-commit hook');

  logger.header('\n🎉 SecretGuard initialized successfully!');
  logger.info('\n📝 Next steps:');
  logger.info('  1. Review .secretguard/config.json');
  logger.info('  2. Test with: secretguard scan');
  logger.info('  3. Migrate secrets: secretguard migrate');
}

/**
 * Create .secretguard directory
 * @param {string} projectRoot
 */
async function createSecretGuardDir(projectRoot) {
  const dir = path.join(projectRoot, '.secretguard');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Write configuration file
 * @param {string} path
 * @param {Object} config
 */
async function writeConfig(path, config) {
  await fs.writeFile(path, JSON.stringify(config, null, 2));
}

/**
 * Setup .gitignore entries
 * @param {string} projectRoot
 */
async function setupGitIgnore(projectRoot) {
  const gitignorePath = path.join(projectRoot, '.gitignore');

  let content = '';
  try {
    content = await fs.readFile(gitignorePath, 'utf-8');
  } catch {
    // File doesn't exist, will create
  }

  const entries = [
    '# SecretGuard',
    '.secretguard/registry.json',
    '.env',
    '.env.*',
    '!.env.example'
  ];

  const newContent = content
    .split('\n')
    .filter(line => !line.includes('SecretGuard') && !line.includes('.secretguard/registry.json'))
    .join('\n');

  const finalContent = newContent
    ? `${newContent}\n\n${entries.join('\n')}\n`
    : `${entries.join('\n')}\n`;

  await fs.writeFile(gitignorePath, finalContent);
}

/**
 * Check if file exists
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
