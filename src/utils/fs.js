/**
 * File System Utilities
 * @module utils/fs
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Get the project root directory
 * @param {string} startPath - Starting path to search from
 * @returns {Promise<string>} Project root path
 */
export async function getProjectRoot(startPath = process.cwd()) {
  let currentPath = path.resolve(startPath);

  while (currentPath !== path.parse(currentPath).root) {
    try {
      const gitPath = path.join(currentPath, '.git');
      await fs.access(gitPath);
      return currentPath;
    } catch {
      currentPath = path.dirname(currentPath);
    }
  }

  return process.cwd();
}

/**
 * Get staged files from Git
 * @param {string} projectRoot
 * @returns {Promise<string[]>} Array of staged file paths
 */
export async function getStagedFiles(projectRoot) {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      cwd: projectRoot,
      encoding: 'utf-8'
    });

    return output
      .split('\n')
      .filter(Boolean)
      .map(file => path.join(projectRoot, file));
  } catch {
    return [];
  }
}

/**
 * Check if a file is binary
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
export async function isBinaryFile(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    const sample = buffer.slice(0, 1024);

    for (let i = 0; i < sample.length; i++) {
      if (sample[i] === 0 || (sample[i] < 32 && sample[i] !== 10 && sample[i] !== 13)) {
        return true;
      }
    }
    return false;
  } catch {
    return true;
  }
}

/**
 * Read file content
 * @param {string} filePath
 * @returns {Promise<string>} File content
 */
export async function readFile(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error.message}`);
  }
}

/**
 * Write file content
 * @param {string} filePath
 * @param {string} content
 * @param {boolean} preserveMode - Preserve file permissions
 */
export async function writeFile(filePath, content, preserveMode = false) {
  try {
    let mode;
    if (preserveMode) {
      const stats = await fs.stat(filePath);
      mode = stats.mode;
    }
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, { mode });
  } catch (error) {
    throw new Error(`Failed to write file ${filePath}: ${error.message}`);
  }
}

/**
 * Check if file exists
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create backup of a file
 * @param {string} filePath
 * @param {string} backupDir
 * @returns {Promise<string>} Backup file path
 */
export async function createBackup(filePath, backupDir = '.secretguard/backups') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = path.basename(filePath);
  const backupPath = path.join(backupDir, `${fileName}.${timestamp}.backup`);

  await fs.mkdir(backupDir, { recursive: true });
  const content = await readFile(filePath);
  await writeFile(backupPath, content);

  return backupPath;
}

/**
 * Get file stats
 * @param {string} filePath
 * @returns {Promise<Object>} File stats
 */
export async function getFileStats(filePath) {
  try {
    return await fs.stat(filePath);
  } catch (error) {
    throw new Error(`Failed to get stats for ${filePath}: ${error.message}`);
  }
}

/**
 * Get all files in a directory recursively
 * @param {string} dirPath
 * @param {string[]} excludePatterns
 * @returns {Promise<string[]>} File paths
 */
export async function getFilesRecursive(dirPath, excludePatterns = []) {
  const files = [];

  async function walkDir(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(dirPath, fullPath);

      if (
        excludePatterns.some(pattern => {
          if (pattern.endsWith('/**')) {
            const patternDir = pattern.slice(0, -3);
            return relativePath.startsWith(patternDir);
          }
          return relativePath === pattern || relativePath.includes(pattern);
        })
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        await walkDir(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }

  await walkDir(dirPath);
  return files;
}
