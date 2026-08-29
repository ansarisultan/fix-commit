/**
 * Environment Manager Module
 * @module migration/env-manager
 */

import fs from 'fs/promises';
import path from 'path';
import { fileExists, readFile, writeFile } from '../utils/fs.js';

/**
 * Environment Manager
 */
export class EnvManager {
  /**
   * Create an environment manager
   * @param {string} projectRoot - Project root directory
   * @param {Object} config - Configuration
   */
  constructor(projectRoot, config = {}) {
    this.projectRoot = projectRoot;
    this.config = {
      envFile: '.env',
      envExampleFile: '.env.example',
      ...config
    };
  }

  /**
   * Get environment file path
   * @returns {string} Environment file path
   */
  getEnvPath() {
    return path.join(this.projectRoot, this.config.envFile);
  }

  /**
   * Get environment example file path
   * @returns {string} Environment example file path
   */
  getEnvExamplePath() {
    return path.join(this.projectRoot, this.config.envExampleFile);
  }

  /**
   * Read environment variables from .env file
   * @returns {Promise<Map<string, string>>} Environment variables
   */
  async readEnv() {
    const envPath = this.getEnvPath();
    const envVars = new Map();

    if (!(await fileExists(envPath))) {
      return envVars;
    }

    try {
      const content = await readFile(envPath);
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (match) {
          const [, key, value] = match;
          const cleanValue = value.replace(/^['"]|['"]$/g, '');
          envVars.set(key, cleanValue);
        }
      }
    } catch (error) {
      throw new Error(`Failed to read .env file: ${error.message}`);
    }

    return envVars;
  }

  /**
   * Write environment variables to .env file
   * @param {Map<string, string>} envVars - Environment variables
   * @param {boolean} append - Whether to append or overwrite
   * @returns {Promise<void>}
   */
  async writeEnv(envVars, append = false) {
    const envPath = this.getEnvPath();
    let existingContent = '';

    if (append && (await fileExists(envPath))) {
      existingContent = await readFile(envPath);
      if (!existingContent.endsWith('\n')) {
        existingContent += '\n';
      }
    }

    const entries = Array.from(envVars.entries());
    const newContent = entries
      .map(([key, value]) => {
        const escapedValue =
          value.includes(' ') || value.includes('#') || value.includes('"')
            ? `"${value.replace(/"/g, '\\"')}"`
            : value;
        return `${key}=${escapedValue}`;
      })
      .join('\n');

    const finalContent = append ? existingContent + newContent + '\n' : newContent + '\n';

    await writeFile(envPath, finalContent);
  }

  /**
   * Update environment variables
   * @param {Object} updates - Key-value pairs to update
   * @param {boolean} append - Whether to append or overwrite
   * @returns {Promise<Map<string, string>>} Updated environment variables
   */
  async updateEnv(updates, append = false) {
    const envVars = await this.readEnv();

    for (const [key, value] of Object.entries(updates)) {
      envVars.set(key, value);
    }

    await this.writeEnv(envVars, append);
    return envVars;
  }

  /**
   * Update .env.example file with new variables
   * @param {Map<string, string>} envVars - Environment variables
   * @returns {Promise<void>}
   */
  async updateEnvExample(envVars) {
    const envExamplePath = this.getEnvExamplePath();
    let content = '';

    if (await fileExists(envExamplePath)) {
      content = await readFile(envExamplePath);
    }

    const existingVars = new Set();
    const lines = content.split('\n');

    for (const line of lines) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
      if (match) {
        existingVars.add(match[1]);
      }
    }

    const missingVars = Array.from(envVars.keys()).filter(key => !existingVars.has(key));

    if (missingVars.length > 0) {
      const newLines = missingVars.map(key => {
        const placeholder =
          key.includes('SECRET') || key.includes('KEY') || key.includes('TOKEN')
            ? 'your-secret-here'
            : 'your-value-here';
        return `${key}=${placeholder}`;
      });

      const finalContent = content.endsWith('\n')
        ? content + newLines.join('\n') + '\n'
        : content + (content ? '\n' : '') + newLines.join('\n') + '\n';

      await writeFile(envExamplePath, finalContent);
    }

    await this.addToGitignore();
  }

  /**
   * Add .env to .gitignore if not already present
   * @returns {Promise<void>}
   */
  async addToGitignore() {
    const gitignorePath = path.join(this.projectRoot, '.gitignore');

    if (!(await fileExists(gitignorePath))) {
      return;
    }

    const content = await readFile(gitignorePath);
    const lines = content.split('\n');

    const hasEnvIgnore = lines.some(
      line => line.trim() === '.env' || line.trim() === '.env.*' || line.includes('.env')
    );

    if (!hasEnvIgnore) {
      const newContent = content.endsWith('\n')
        ? content + '.env\n.env.*\n'
        : content + '\n.env\n.env.*\n';

      await writeFile(gitignorePath, newContent);
    }
  }

  /**
   * Create a backup of .env file
   * @returns {Promise<string>} Backup file path
   */
  async backupEnv() {
    const envPath = this.getEnvPath();

    if (!(await fileExists(envPath))) {
      return null;
    }

    const backupDir = path.join(this.projectRoot, '.secretguard', 'backups');
    await fs.mkdir(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `.env.${timestamp}.backup`);

    const content = await readFile(envPath);
    await writeFile(backupPath, content);

    return backupPath;
  }

  /**
   * Generate a secure random value for a secret
   * @param {string} type - Secret type
   * @param {number} length - Length of the secret
   * @returns {string} Random value
   */
  generateSecretValue(type, length = 32) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const specialChars = '!@#$%^&*()_+-=';

    let result = '';
    const useSpecial = type.includes('password') || type.includes('secret');

    const allChars = useSpecial ? charset + specialChars : charset;

    for (let i = 0; i < length; i++) {
      result += allChars[Math.floor(Math.random() * allChars.length)];
    }

    return result;
  }
}

export default EnvManager;
