/**
 * Spinner Module - CLI spinner for progress indication
 * @module cli/ui/spinner
 */

/**
 * Create a spinner
 * @param {string} message - Initial message
 * @param {Object} options - Spinner options
 * @param {number} options.delay - Delay in ms (default: 80)
 * @param {string[]} options.frames - Spinner frames
 * @returns {Object} Spinner controller
 */
export function createSpinner(message, options = {}) {
  const { delay = 80, frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] } = options;

  let interval = null;
  let currentFrame = 0;
  let isSpinning = false;
  let currentMessage = message;

  const isTTY = process.stdout.isTTY;

  /**
   * Start the spinner
   */
  const start = () => {
    if (interval) return;

    currentFrame = 0;
    isSpinning = true;
    currentMessage = message;

    if (isTTY) {
      interval = setInterval(() => {
        process.stdout.write(`\r${frames[currentFrame % frames.length]} ${currentMessage}`);
        currentFrame++;
      }, delay);
    } else {
      process.stdout.write(`${message}...\n`);
    }
  };

  /**
   * Update the spinner message
   * @param {string} newMessage - New message
   */
  const update = newMessage => {
    currentMessage = newMessage;
    if (isTTY && interval) {
      process.stdout.write(`\r${frames[currentFrame % frames.length]} ${currentMessage}`);
    }
  };

  /**
   * Stop the spinner with success
   * @param {string} successMessage - Success message
   */
  const success = successMessage => {
    stop();
    if (isTTY) {
      process.stdout.write(`\r${' '.repeat(50)}\r`);
      console.log(`✅ ${successMessage || currentMessage}`);
    } else {
      console.log(`✅ ${successMessage || currentMessage}`);
    }
  };

  /**
   * Stop the spinner with error
   * @param {string} errorMessage - Error message
   */
  const error = errorMessage => {
    stop();
    if (isTTY) {
      process.stdout.write(`\r${' '.repeat(50)}\r`);
      console.log(`❌ ${errorMessage || currentMessage}`);
    } else {
      console.log(`❌ ${errorMessage || currentMessage}`);
    }
  };

  /**
   * Stop the spinner
   */
  const stop = () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    isSpinning = false;
    if (isTTY) {
      process.stdout.write(`\r${' '.repeat(50)}\r`);
    }
  };

  return {
    start,
    update,
    success,
    error,
    stop,
    isSpinning: () => isSpinning
  };
}
