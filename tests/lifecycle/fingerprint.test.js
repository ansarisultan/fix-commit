import { describe, it, expect } from 'vitest';
import { generateFingerprint, generateShortFingerprint, compareFingerprints } from '../../src/lifecycle/fingerprint.js';

describe('Fingerprint Module', () => {
  it('should generate consistent SHA-256 fingerprints', () => {
    const fp1 = generateFingerprint('secret123');
    const fp2 = generateFingerprint('secret123');
    expect(fp1).toBe(fp2);
    expect(fp1.length).toBe(64);
  });

  it('should generate short fingerprints', () => {
    const shortFp = generateShortFingerprint('my-api-key');
    expect(shortFp.length).toBe(8);
  });

  it('should correctly compare matching fingerprints', () => {
    const fp1 = generateFingerprint('value');
    const fp2 = generateFingerprint('value');
    expect(compareFingerprints(fp1, fp2)).toBe(true);
  });

  it('should reject non-matching fingerprints', () => {
    const fp1 = generateFingerprint('value1');
    const fp2 = generateFingerprint('value2');
    expect(compareFingerprints(fp1, fp2)).toBe(false);
  });
});
