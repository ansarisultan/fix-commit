import { describe, it, expect } from 'vitest';
import { detectApiKeys } from '../../src/scanner/detectors/api-keys.js';
import { detectTokens } from '../../src/scanner/detectors/tokens.js';
import { detectPasswords } from '../../src/scanner/detectors/passwords.js';

describe('Secret Detectors', () => {
  it('should detect OpenAI API key', async () => {
    const code = `const apiKey = "sk-proj-9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a";`;
    const findings = await detectApiKeys(code, { minEntropy: 2.0 });
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].type).toBe('openai');
  });

  it('should detect Bearer token', async () => {
    const code = `const auth = "Bearer d91f28b7a63c4e518902a71f02c4e518a901f4";`;
    const findings = await detectTokens(code, { minEntropy: 1.0 });
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].type).toBe('bearer_token');
  });

  it('should detect hardcoded passwords in assignment', async () => {
    const code = `const password = "SuperSecretPassword123!#";`;
    const findings = await detectPasswords(code, { minEntropy: 2.0, checkCommon: true });
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].value).toBe('SuperSecretPassword123!#');
  });
});
