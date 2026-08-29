/**
 * Gitignore Manager Module
 * @module migration/gitignore-manager
 */

import path from 'path';
import { readFile, writeFile, fileExists } from '../utils/fs.js';

/**
 * Gitignore Manager
 */
export class GitignoreManager {
  /**
   * Create a gitignore manager
   * @param {string} projectRoot - Project root directory
   */
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.gitignorePath = path.join(projectRoot, '.gitignore');
  }

  /**
   * Check if .gitignore exists
   * @returns {Promise<boolean>}
   */
  async exists() {
    return fileExists(this.gitignorePath);
  }

  /**
   * Read .gitignore content
   * @returns {Promise<string[]>} Lines of .gitignore
   */
  async read() {
    if (!(await this.exists())) {
      return [];
    }

    const content = await readFile(this.gitignorePath);
    return content.split('\n');
  }

  /**
   * Write .gitignore content
   * @param {string[]} lines - Lines to write
   * @returns {Promise<void>}
   */
  async write(lines) {
    const content = lines.join('\n');
    await writeFile(this.gitignorePath, content);
  }

  /**
   * Add entries to .gitignore
   * @param {string[]} entries - Entries to add
   * @returns {Promise<boolean>} Whether entries were added
   */
  async addEntries(entries) {
    const lines = await this.read();
    const existing = new Set(lines.map(l => l.trim()));

    const newEntries = entries.filter(entry => {
      const trimmed = entry.trim();
      if (!trimmed || existing.has(trimmed)) {
        return false;
      }

      for (const line of lines) {
        if (line.trim() === trimmed) {
          return false;
        }
        if (trimmed.endsWith('*') && line.trim().startsWith(trimmed.slice(0, -1))) {
          return false;
        }
        if (line.trim().endsWith('*') && trimmed.startsWith(line.trim().slice(0, -1))) {
          return false;
        }
      }

      return true;
    });

    if (newEntries.length === 0) {
      return false;
    }

    const hasContent = lines.some(l => l.trim());
    if (hasContent) {
      const hasSection = lines.some(l => l.includes('SecretGuard'));
      if (!hasSection) {
        lines.push('');
        lines.push('# SecretGuard');
      }
    }

    lines.push(...newEntries);
    await this.write(lines);

    return true;
  }

  /**
   * Remove entries from .gitignore
   * @param {string[]} entries - Entries to remove
   * @returns {Promise<boolean>} Whether entries were removed
   */
  async removeEntries(entries) {
    const lines = await this.read();
    const entriesSet = new Set(entries.map(e => e.trim()));

    const filteredLines = lines.filter(line => {
      const trimmed = line.trim();
      return !entriesSet.has(trimmed);
    });

    if (filteredLines.length === lines.length) {
      return false;
    }

    await this.write(filteredLines);
    return true;
  }

  /**
   * Get all ignored patterns
   * @returns {Promise<string[]>} Ignored patterns
   */
  async getIgnoredPatterns() {
    const lines = await this.read();
    return lines.map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  }

  /**
   * Check if a pattern is ignored
   * @param {string} pattern - Pattern to check
   * @returns {Promise<boolean>}
   */
  async isIgnored(pattern) {
    const patterns = await this.getIgnoredPatterns();
    const trimmed = pattern.trim();

    if (patterns.includes(trimmed)) {
      return true;
    }

    for (const ignored of patterns) {
      if (ignored.endsWith('/**')) {
        const dir = ignored.slice(0, -3);
        if (trimmed.startsWith(dir + '/') || trimmed === dir) {
          return true;
        }
      }
      if (ignored.endsWith('*')) {
        const prefix = ignored.slice(0, -1);
        if (trimmed.startsWith(prefix)) {
          return true;
        }
      }
      if (ignored.startsWith('*')) {
        const suffix = ignored.slice(1);
        if (trimmed.endsWith(suffix)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Ensure important patterns are ignored
   * @returns {Promise<void>}
   */
  async ensureSecureIgnore() {
    const entries = ['.env', '.env.*', '!.env.example', '.secretguard/registry.json'];

    await this.addEntries(entries);
  }
}

export default GitignoreManager;
