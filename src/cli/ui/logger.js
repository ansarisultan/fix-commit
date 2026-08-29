/**
 * Logger Module - CLI output utilities
 * @module cli/ui/logger
 */

import chalk from 'chalk';

/**
 * Create a logger instance
 * @param {Object} options
 * @param {boolean} options.quiet - Suppress non-essential output
 * @param {boolean} options.verbose - Enable verbose output
 * @returns {Object} Logger instance
 */
export function createLogger(options = {}) {
  const { quiet = false, verbose = false } = options;

  const isTTY = process.stdout.isTTY && !quiet;

  return {
    /**
     * Display a header
     * @param {string} text
     */
    header(text) {
      if (!quiet) {
        console.log(chalk.bold.cyan('\n' + text));
      }
    },

    /**
     * Display info message
     * @param {string} text
     */
    info(text) {
      if (!quiet) {
        console.log(chalk.blue(text));
      }
    },

    /**
     * Display success message
     * @param {string} text
     */
    success(text) {
      if (!quiet) {
        console.log(chalk.green(text));
      }
    },

    /**
     * Display warning message
     * @param {string} text
     */
    warn(text) {
      if (!quiet) {
        console.log(chalk.yellow(text));
      }
    },

    /**
     * Display error message
     * @param {string} text
     */
    error(text) {
      console.log(chalk.red(text));
    },

    /**
     * Display debug message (only when verbose)
     * @param {string} text
     */
    debug(text) {
      if (verbose && !quiet) {
        console.log(chalk.gray(`[DEBUG] ${text}`));
      }
    },

    /**
     * Display raw output
     * @param {string} text
     */
    raw(text) {
      if (!quiet) {
        console.log(text);
      }
    },

    /**
     * Display a table
     * @param {Array} data
     * @param {Array} columns
     */
    table(data, columns = null) {
      if (!quiet && data && data.length > 0) {
        console.table(data, columns);
      }
    },

    /**
     * Display a divider
     */
    divider() {
      if (!quiet) {
        console.log(chalk.gray('─'.repeat(process.stdout.columns || 80)));
      }
    },

    /**
     * Display a progress indicator
     * @param {string} text
     * @returns {Function} Complete function
     */
    progress(text) {
      if (!quiet && isTTY) {
        const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let i = 0;
        const interval = setInterval(() => {
          process.stdout.write(`\r${chalk.cyan(spinner[i++ % spinner.length])} ${text}`);
        }, 80);

        return () => {
          clearInterval(interval);
          process.stdout.write(`\r${chalk.green('✓')} ${text}\n`);
        };
      }
      return () => {};
    }
  };
}
