/**
 * Staged Files Module - Git staged file management
 * @module scanner/staged-files
 */

import path from 'path';
import {
  getStagedFiles,
  fileExists,
  getFileStats,
  isBinaryFile,
  readFile,
  getFilesRecursive
} from '../utils/fs.js';
import { createLogger } from '../cli/ui/logger.js';

const logger = createLogger();

/**
 * Get staged files with content for scanning
 * @param {string} projectRoot - Project root directory
 * @param {Object} options - Scan options
 * @param {string[]} options.excludePatterns - Patterns to exclude
 * @param {number} options.maxFileSize - Maximum file size in bytes
 * @returns {Promise<Array<{path: string, content: string, size: number}>>}
 */
export async function getStagedFilesForScan(projectRoot, options = {}) {
  const {
    excludePatterns = [],
    maxFileSize = 1024 * 1024 // 1MB default
  } = options;

  logger.debug('Getting staged files...');

  const stagedFiles = await getStagedFiles(projectRoot);

  if (stagedFiles.length === 0) {
    logger.debug('No staged files found');
    return [];
  }

  logger.debug(`Found ${stagedFiles.length} staged files`);

  const scannedFiles = [];

  for (const filePath of stagedFiles) {
    if (!(await fileExists(filePath))) {
      logger.debug(`File no longer exists: ${filePath}`);
      continue;
    }

    const relativePath = filePath.replace(projectRoot + path.sep, '').replace(/\\/g, '/');
    if (shouldExclude(relativePath, excludePatterns)) {
      logger.debug(`Excluded file: ${relativePath}`);
      continue;
    }

    try {
      const stats = await getFileStats(filePath);
      if (stats && stats.size > maxFileSize) {
        logger.debug(`File too large: ${relativePath} (${stats.size} bytes)`);
        continue;
      }
    } catch {
      // Ignore
    }

    if (await isBinaryFile(filePath)) {
      logger.debug(`Binary file skipped: ${relativePath}`);
      continue;
    }

    try {
      const content = await readFile(filePath);
      scannedFiles.push({
        path: filePath,
        relativePath,
        content,
        size: content.length
      });
      logger.debug(`Added file: ${relativePath}`);
    } catch (error) {
      logger.warn(`Failed to read file: ${relativePath} - ${error.message}`);
    }
  }

  logger.debug(`Prepared ${scannedFiles.length} files for scanning`);
  return scannedFiles;
}

/**
 * Get all files in project for scanning (when --all is specified)
 * @param {string} projectRoot
 * @param {Object} options
 * @returns {Promise<Array<{path: string, relativePath: string, content: string, size: number}>>}
 */
export async function getAllFilesForScan(projectRoot, options = {}) {
  const { excludePatterns = [], maxFileSize = 1024 * 1024 } = options;

  const allFilePaths = await getFilesRecursive(projectRoot, excludePatterns);
  const scannedFiles = [];

  for (const filePath of allFilePaths) {
    const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
    if (shouldExclude(relativePath, excludePatterns)) continue;
    if (await isBinaryFile(filePath)) continue;

    try {
      const stats = await getFileStats(filePath);
      if (stats && stats.size > maxFileSize) continue;
      const content = await readFile(filePath);
      scannedFiles.push({
        path: filePath,
        relativePath,
        content,
        size: content.length
      });
    } catch {
      // ignore
    }
  }

  return scannedFiles;
}

/**
 * Check if a file should be excluded
 * @param {string} filePath - Relative file path
 * @param {string[]} patterns - Exclusion patterns
 * @returns {boolean}
 */
function shouldExclude(filePath, patterns) {
  for (const pattern of patterns) {
    if (matchesPattern(filePath, pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Match a path against a pattern
 * @param {string} filePath - File path
 * @param {string} pattern - Glob pattern
 * @returns {boolean}
 */
function matchesPattern(filePath, pattern) {
  if (pattern.endsWith('/**')) {
    const dir = pattern.slice(0, -3);
    return filePath.startsWith(dir + '/') || filePath === dir;
  }

  if (pattern.includes('*')) {
    const regex = new RegExp(
      '^' + pattern.replace(/\./g, '\\.').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$'
    );
    return regex.test(filePath);
  }

  return filePath === pattern || filePath.startsWith(pattern + '/');
}
