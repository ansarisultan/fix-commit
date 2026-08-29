/**
 * Entropy Calculation Module
 * @module utils/entropy
 */

/**
 * Calculate Shannon entropy of a string
 * @param {string} str - String to analyze
 * @returns {number} Entropy value (0-8)
 */
export function calculateEntropy(str) {
  if (!str || str.length === 0) {
    return 0;
  }

  const frequencies = {};
  const length = str.length;

  // Count character frequencies
  for (const char of str) {
    frequencies[char] = (frequencies[char] || 0) + 1;
  }

  // Calculate Shannon entropy
  let entropy = 0;
  for (const count of Object.values(frequencies)) {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
}

/**
 * Check if a string has high entropy
 * @param {string} str - String to check
 * @param {number} threshold - Entropy threshold (default: 3.5)
 * @returns {boolean}
 */
export function isHighEntropy(str, threshold = 3.5) {
  return calculateEntropy(str) >= threshold;
}

/**
 * Calculate entropy of base64-like strings
 * @param {string} str - String to analyze
 * @returns {number} Entropy value
 */
export function calculateBase64Entropy(str) {
  // Remove padding characters
  const cleanStr = str.replace(/=+$/, '');

  // Check if it looks like base64
  if (!/^[A-Za-z0-9+/]+$/.test(cleanStr)) {
    return calculateEntropy(str);
  }

  // Base64 has 64 possible characters (6 bits per character)
  return calculateEntropy(cleanStr);
}

/**
 * Check if a string is likely a secret based on entropy
 * @param {string} str - String to check
 * @param {Object} options - Options
 * @param {number} options.minEntropy - Minimum entropy (default: 3.5)
 * @param {number} options.minLength - Minimum length (default: 8)
 * @returns {boolean}
 */
export function isLikelySecret(str, options = {}) {
  const { minEntropy = 3.5, minLength = 8 } = options;

  if (str.length < minLength) {
    return false;
  }

  const entropy = calculateEntropy(str);
  return entropy >= minEntropy;
}
