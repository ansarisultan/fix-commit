/**
 * Scanner Module - Main scanning engine
 * @module scanner/scanner
 */

import { detectApiKeys } from './detectors/api-keys.js';
import { detectTokens } from './detectors/tokens.js';
import { detectPasswords } from './detectors/passwords.js';
import { detectPatterns } from './detectors/patterns.js';
import { getStagedFilesForScan, getAllFilesForScan } from './staged-files.js';
import { createLogger } from '../cli/ui/logger.js';
import { createSpinner } from '../cli/ui/spinner.js';

const logger = createLogger();

/**
 * Main scanner class
 */
export class Scanner {
  /**
   * Create a scanner instance
   * @param {Object} config - Scanner configuration
   */
  constructor(config = {}) {
    this.config = {
      minEntropy: 3.5,
      maxFileSize: 1024 * 1024,
      excludePatterns: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '.git/**',
        '*.log',
        '*.lock',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        '.env'
      ],
      detectors: {
        apiKeys: true,
        tokens: true,
        passwords: true,
        patterns: true
      },
      ...config
    };
  }

  /**
   * Scan staged files or all files for secrets
   * @param {string} projectRoot - Project root directory
   * @param {Object} options - Scan options
   * @param {boolean} options.all - Scan all files
   * @param {boolean} options.quiet - Suppress output
   * @param {boolean} options.verbose - Enable verbose output
   * @returns {Promise<{findings: Array, filesScanned: number, summary: Object}>}
   */
  async scanStaged(projectRoot, options = {}) {
    const { quiet = false, verbose = false, all = false } = options;

    if (!quiet) {
      logger.info(
        all
          ? '🔍 Scanning all project files for secrets...'
          : '🔍 Scanning staged files for secrets...'
      );
    }

    const spinner = createSpinner('Analyzing files...');
    spinner.start();

    try {
      const files = all
        ? await getAllFilesForScan(projectRoot, {
            excludePatterns: this.config.excludePatterns,
            maxFileSize: this.config.maxFileSize
          })
        : await getStagedFilesForScan(projectRoot, {
            excludePatterns: this.config.excludePatterns,
            maxFileSize: this.config.maxFileSize
          });

      spinner.update(`Scanning ${files.length} files...`);

      if (files.length === 0) {
        spinner.success(all ? 'No project files to scan' : 'No staged files to scan');
        return {
          findings: [],
          filesScanned: 0,
          summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 }
        };
      }

      const allFindings = [];
      const fileResults = [];

      for (const file of files) {
        if (verbose) {
          spinner.update(`Scanning ${file.relativePath}...`);
        }

        const findings = await this.scanFile(file, { verbose });

        if (findings.length > 0) {
          allFindings.push(...findings);
          fileResults.push({
            path: file.relativePath,
            findings: findings,
            count: findings.length
          });
        }
      }

      spinner.success(`Completed scan of ${files.length} files`);

      const summary = this.generateSummary(allFindings);

      if (!quiet) {
        this.displayResults(fileResults, summary);
      }

      return {
        findings: allFindings,
        filesScanned: files.length,
        summary
      };
    } catch (error) {
      spinner.error(`Scan failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Scan a single file
   * @param {Object} file - File to scan
   * @param {Object} options - Scan options
   * @returns {Promise<Array>} Findings
   */
  async scanFile(file, options = {}) {
    const { verbose = false } = options;
    const findings = [];

    if (this.config.detectors.apiKeys) {
      try {
        const apiKeyFindings = await detectApiKeys(file.content, {
          minEntropy: this.config.minEntropy
        });
        findings.push(...apiKeyFindings.map(f => ({ ...f, file: file.relativePath })));
        if (verbose && apiKeyFindings.length > 0) {
          logger.debug(`Found ${apiKeyFindings.length} API keys in ${file.relativePath}`);
        }
      } catch (error) {
        if (verbose) {
          logger.debug(`API key detection failed for ${file.relativePath}: ${error.message}`);
        }
      }
    }

    if (this.config.detectors.tokens) {
      try {
        const tokenFindings = await detectTokens(file.content, {
          minEntropy: this.config.minEntropy
        });
        findings.push(...tokenFindings.map(f => ({ ...f, file: file.relativePath })));
        if (verbose && tokenFindings.length > 0) {
          logger.debug(`Found ${tokenFindings.length} tokens in ${file.relativePath}`);
        }
      } catch (error) {
        if (verbose) {
          logger.debug(`Token detection failed for ${file.relativePath}: ${error.message}`);
        }
      }
    }

    if (this.config.detectors.passwords) {
      try {
        const passwordFindings = await detectPasswords(file.content, {
          minEntropy: this.config.minEntropy
        });
        findings.push(...passwordFindings.map(f => ({ ...f, file: file.relativePath })));
        if (verbose && passwordFindings.length > 0) {
          logger.debug(`Found ${passwordFindings.length} passwords in ${file.relativePath}`);
        }
      } catch (error) {
        if (verbose) {
          logger.debug(`Password detection failed for ${file.relativePath}: ${error.message}`);
        }
      }
    }

    if (this.config.detectors.patterns) {
      try {
        const patternFindings = await detectPatterns(file.content, {
          minEntropy: this.config.minEntropy
        });
        findings.push(...patternFindings.map(f => ({ ...f, file: file.relativePath })));
        if (verbose && patternFindings.length > 0) {
          logger.debug(`Found ${patternFindings.length} security patterns in ${file.relativePath}`);
        }
      } catch (error) {
        if (verbose) {
          logger.debug(`Pattern detection failed for ${file.relativePath}: ${error.message}`);
        }
      }
    }

    return findings;
  }

  /**
   * Generate summary of findings
   * @param {Array} findings - All findings
   * @returns {Object} Summary
   */
  generateSummary(findings) {
    const summary = {
      total: findings.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      byType: {}
    };

    for (const finding of findings) {
      if (finding.confidence >= 0.9) {
        summary.critical++;
      } else if (finding.confidence >= 0.7) {
        summary.high++;
      } else if (finding.confidence >= 0.5) {
        summary.medium++;
      } else {
        summary.low++;
      }

      const type = finding.type || 'unknown';
      if (!summary.byType[type]) {
        summary.byType[type] = 0;
      }
      summary.byType[type]++;
    }

    return summary;
  }

  /**
   * Display scan results
   * @param {Array} fileResults - Results by file
   * @param {Object} summary - Summary statistics
   */
  displayResults(fileResults, summary) {
    logger.divider();

    if (summary.total === 0) {
      logger.success('✨ No secrets found! All clean.');
      return;
    }

    logger.warn(`⚠️  Found ${summary.total} potential secrets in ${fileResults.length} files`);
    logger.divider();

    for (const result of fileResults) {
      logger.info(`\n📄 ${result.path}`);
      for (const finding of result.findings) {
        const confidence = this.getConfidenceLabel(finding.confidence);
        logger.raw(`  ${confidence} ${finding.description || finding.type} (line ${finding.line})`);
        if (finding.value) {
          const displayValue =
            finding.value.length > 30 ? finding.value.substring(0, 27) + '...' : finding.value;
          logger.raw(`    Value: ${displayValue}`);
        }
        if (finding.context) {
          logger.raw(`    Context: ${finding.context}`);
        }
      }
    }

    logger.divider();
    logger.info('📊 Summary:');
    if (summary.critical > 0) {
      logger.error(`  🔴 Critical: ${summary.critical}`);
    }
    if (summary.high > 0) {
      logger.warn(`  🟠 High: ${summary.high}`);
    }
    if (summary.medium > 0) {
      logger.warn(`  🟡 Medium: ${summary.medium}`);
    }
    if (summary.low > 0) {
      logger.info(`  ⚪ Low: ${summary.low}`);
    }
  }

  /**
   * Get confidence label
   * @param {number} confidence - Confidence level (0-1)
   * @returns {string} Label
   */
  getConfidenceLabel(confidence) {
    if (confidence >= 0.9) {
      return '🔴 CRITICAL';
    }
    if (confidence >= 0.7) {
      return '🟠 HIGH';
    }
    if (confidence >= 0.5) {
      return '🟡 MEDIUM';
    }
    return '⚪ LOW';
  }
}

/**
 * Create a scanner instance
 * @param {Object} config - Scanner configuration
 * @returns {Scanner} Scanner instance
 */
export function createScanner(config = {}) {
  return new Scanner(config);
}
