/**
 * Prompts Module - CLI user interaction
 * @module cli/ui/prompts
 */

import readline from 'readline';

/**
 * Create readline interface
 * @returns {readline.Interface} Readline interface
 */
function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Prompt user for confirmation
 * @param {string} message - Confirmation message
 * @param {boolean} defaultValue - Default value
 * @returns {Promise<boolean>} User response
 */
export function confirm(message, defaultValue = false) {
  return new Promise(resolve => {
    const rl = createReadline();
    const defaultStr = defaultValue ? 'Y/n' : 'y/N';

    rl.question(`${message} (${defaultStr}) `, answer => {
      rl.close();

      const normalized = answer.trim().toLowerCase();

      if (normalized === '') {
        resolve(defaultValue);
      } else {
        resolve(normalized === 'y' || normalized === 'yes');
      }
    });
  });
}

/**
 * Prompt user for input
 * @param {string} message - Input message
 * @param {string} defaultValue - Default value
 * @returns {Promise<string>} User input
 */
export function prompt(message, defaultValue = '') {
  return new Promise(resolve => {
    const rl = createReadline();
    const defaultStr = defaultValue ? ` (${defaultValue})` : '';

    rl.question(`${message}${defaultStr}: `, answer => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

/**
 * Prompt user to select from a list
 * @param {string} message - Selection message
 * @param {string[]} choices - Available choices
 * @param {number} defaultIndex - Default index
 * @returns {Promise<string>} Selected choice
 */
export function select(message, choices, defaultIndex = 0) {
  return new Promise(resolve => {
    const rl = createReadline();

    console.log(`\n${message}:`);
    choices.forEach((choice, index) => {
      const marker = index === defaultIndex ? '>' : ' ';
      console.log(`  ${marker} ${index + 1}. ${choice}`);
    });

    rl.question('\nSelect option (number): ', answer => {
      rl.close();

      const index = parseInt(answer.trim(), 10) - 1;

      if (index >= 0 && index < choices.length) {
        resolve(choices[index]);
      } else {
        resolve(choices[defaultIndex]);
      }
    });
  });
}

/**
 * Prompt for multiple values
 * @param {string} message - Input message
 * @param {string} separator - Value separator
 * @returns {Promise<string[]>} User input values
 */
export function promptMultiple(message, separator = ',') {
  return new Promise(resolve => {
    const rl = createReadline();

    rl.question(`${message} (separated by "${separator}"): `, answer => {
      rl.close();
      resolve(
        answer
          .split(separator)
          .map(s => s.trim())
          .filter(Boolean)
      );
    });
  });
}

/**
 * Prompt for password (input hidden)
 * @param {string} message - Password prompt
 * @returns {Promise<string>} Password input
 */
export function promptPassword(message) {
  return new Promise(resolve => {
    const rl = createReadline();

    rl.stdoutMuted = true;
    rl.question(`${message}: `, answer => {
      rl.close();
      resolve(answer);
    });

    rl._writeToOutput = function _writeToOutput(stringToWrite) {
      if (rl.stdoutMuted) {
        rl.output.write('*');
      } else {
        rl.output.write(stringToWrite);
      }
    };
  });
}

export default {
  confirm,
  prompt,
  select,
  promptMultiple,
  promptPassword
};
