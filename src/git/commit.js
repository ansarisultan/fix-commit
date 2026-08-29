/**
 * Git Commit Module
 * @module git/commit
 */

import { execSync } from 'child_process';

/**
 * Check if current directory is inside a Git repository
 * @param {string} projectRoot
 * @returns {boolean}
 */
export function isGitRepository(projectRoot = process.cwd()) {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: projectRoot, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Stage files in Git repository
 * @param {string[]} files - Array of file paths
 * @param {string} projectRoot - Project root
 */
export function stageFiles(files, projectRoot = process.cwd()) {
  if (!files || files.length === 0) return;
  const fileList = files.map(f => `"${f}"`).join(' ');
  execSync(`git add ${fileList}`, { cwd: projectRoot, stdio: 'inherit' });
}

export default {
  isGitRepository,
  stageFiles
};
