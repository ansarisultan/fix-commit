/**
 * Duplicate Detector Module - Detect duplicate secrets
 * @module lifecycle/duplicate-detector
 */

import { generateFingerprint, compareFingerprints } from './fingerprint.js';

/**
 * Duplicate Detector
 */
export class DuplicateDetector {
  /**
   * Create a duplicate detector
   * @param {Object} config - Configuration
   */
  constructor(config = {}) {
    this.config = {
      algorithm: 'sha256',
      similarityThreshold: 0.8,
      ...config
    };
  }

  /**
   * Detect duplicates in a list of secrets
   * @param {Array} secrets - Array of secret objects with 'value' property
   * @returns {Object} Duplicate detection results
   */
  detectDuplicates(secrets) {
    const fingerprints = new Map();
    const duplicates = [];
    const unique = [];

    for (const secret of secrets) {
      const fp = generateFingerprint(secret.value, this.config.algorithm);

      if (fingerprints.has(fp)) {
        const original = fingerprints.get(fp);
        duplicates.push({
          original: original,
          duplicate: secret,
          fingerprint: fp
        });
      } else {
        const entry = {
          ...secret,
          fingerprint: fp
        };
        fingerprints.set(fp, entry);
        unique.push(entry);
      }
    }

    return {
      total: secrets.length,
      unique: unique.length,
      duplicates: duplicates.length,
      duplicateGroups: this.groupDuplicates(duplicates),
      uniqueSecrets: unique,
      duplicateSecrets: duplicates
    };
  }

  /**
   * Group duplicates by fingerprint
   * @param {Array} duplicates - Duplicate pairs
   * @returns {Object} Grouped duplicates
   */
  groupDuplicates(duplicates) {
    const groups = new Map();

    for (const { original, duplicate, fingerprint } of duplicates) {
      if (!groups.has(fingerprint)) {
        groups.set(fingerprint, {
          fingerprint,
          original,
          duplicates: []
        });
      }
      groups.get(fingerprint).duplicates.push(duplicate);
    }

    return Array.from(groups.values());
  }

  /**
   * Check if a secret is a duplicate
   * @param {string} value - Secret value
   * @param {Array} existingSecrets - Existing secrets
   * @returns {Object|null} Duplicate info or null
   */
  isDuplicate(value, existingSecrets) {
    const fp = generateFingerprint(value, this.config.algorithm);

    for (const secret of existingSecrets) {
      const existingFp =
        secret.fingerprint || generateFingerprint(secret.value, this.config.algorithm);

      if (compareFingerprints(fp, existingFp)) {
        return {
          isDuplicate: true,
          original: secret,
          fingerprint: fp
        };
      }
    }

    return null;
  }

  /**
   * Find similar secrets (not exact duplicates)
   * @param {string} value - Secret value
   * @param {Array} secrets - Secrets to compare against
   * @param {number} threshold - Similarity threshold (0-1)
   * @returns {Array} Similar secrets
   */
  findSimilar(value, secrets, threshold = null) {
    const threshold_ = threshold || this.config.similarityThreshold;
    const results = [];

    for (const secret of secrets) {
      const similarity = this.calculateSimilarity(value, secret.value);
      if (similarity >= threshold_) {
        results.push({
          secret,
          similarity
        });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Calculate similarity between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(str1, str2) {
    if (!str1 || !str2) {
      return 0;
    }

    if (str1 === str2) {
      return 1;
    }

    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);

    return 1 - distance / maxLength;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Levenshtein distance
   */
  levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;

    const matrix = Array(m + 1);
    for (let i = 0; i <= m; i++) {
      matrix[i] = Array(n + 1);
      matrix[i][0] = i;
    }
    for (let j = 0; j <= n; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[m][n];
  }

  /**
   * Get duplicate statistics
   * @param {Array} secrets - List of secrets
   * @returns {Object} Statistics
   */
  getStats(secrets) {
    const result = this.detectDuplicates(secrets);

    return {
      totalSecrets: result.total,
      uniqueSecrets: result.unique,
      duplicateCount: result.duplicates,
      duplicatePercentage: result.total > 0 ? (result.duplicates / result.total) * 100 : 0,
      groups: result.duplicateGroups.length
    };
  }

  /**
   * Generate a report of duplicates
   * @param {Array} secrets - List of secrets
   * @returns {string} Report string
   */
  generateReport(secrets) {
    const result = this.detectDuplicates(secrets);
    const stats = this.getStats(secrets);

    let report = '🔍 Duplicate Detection Report\n';
    report += '='.repeat(40) + '\n\n';
    report += `Total Secrets: ${stats.totalSecrets}\n`;
    report += `Unique Secrets: ${stats.uniqueSecrets}\n`;
    report += `Duplicate Instances: ${stats.duplicateCount}\n`;
    report += `Duplicate Rate: ${stats.duplicatePercentage.toFixed(1)}%\n`;
    report += `Duplicate Groups: ${stats.groups}\n\n`;

    if (stats.groups > 0) {
      report += 'Duplicate Groups:\n';
      report += '-'.repeat(30) + '\n';

      for (const group of result.duplicateGroups) {
        report += `\n📋 Fingerprint: ${group.fingerprint.substring(0, 8)}...\n`;
        report += `  Original: ${group.original.value.substring(0, 20)}...\n`;
        report += `  Duplicates (${group.duplicates.length}):\n`;

        for (const dup of group.duplicates) {
          report += `    - ${dup.value.substring(0, 20)}...\n`;
        }
      }
    }

    return report;
  }
}

export default DuplicateDetector;
