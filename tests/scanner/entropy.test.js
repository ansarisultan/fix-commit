import { describe, it, expect } from 'vitest';
import { calculateEntropy, isHighEntropy, isLikelySecret } from '../../src/utils/entropy.js';

describe('Entropy Utility', () => {
  it('should return 0 for empty string', () => {
    expect(calculateEntropy('')).toBe(0);
  });

  it('should return low entropy for repeated characters', () => {
    const entropy = calculateEntropy('aaaaaaaaaa');
    expect(entropy).toBe(0);
  });

  it('should return high entropy for random secret keys', () => {
    const secret = 'sk-proj-498fjaKDF9381k2m3LKF901';
    const entropy = calculateEntropy(secret);
    expect(entropy).toBeGreaterThan(3.5);
  });

  it('should identify high entropy strings', () => {
    expect(isHighEntropy('d91f28b7a63c4e518902a71f02c4', 3.5)).toBe(true);
    expect(isHighEntropy('hello world', 3.5)).toBe(false);
  });

  it('should identify likely secrets', () => {
    expect(isLikelySecret('AKIAIOSFODNN7EXAMPLE', { minEntropy: 3.0, minLength: 10 })).toBe(true);
    expect(isLikelySecret('short', { minLength: 8 })).toBe(false);
  });
});
