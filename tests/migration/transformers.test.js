import { describe, it, expect } from 'vitest';
import { JavaScriptTransformer } from '../../src/migration/transformers/javascript.js';
import { PythonTransformer } from '../../src/migration/transformers/python.js';

describe('Code Transformers', () => {
  it('should transform JavaScript secrets to process.env', async () => {
    const jsTransformer = new JavaScriptTransformer();
    const code = `const apiKey = 'sk-proj-secret12345';`;
    const mappings = [{ value: 'sk-proj-secret12345', key: 'OPENAI_API_KEY', type: 'openai' }];
    
    const result = await jsTransformer.transform(code, mappings, { dryRun: false });
    expect(result.content).toContain('process.env.OPENAI_API_KEY');
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it('should transform Python secrets to os.environ.get', async () => {
    const pyTransformer = new PythonTransformer();
    const code = `api_key = 'sk-proj-secret12345'`;
    const mappings = [{ value: 'sk-proj-secret12345', key: 'OPENAI_API_KEY', type: 'openai' }];
    
    const result = await pyTransformer.transform(code, mappings, { dryRun: false });
    expect(result.content).toContain("os.environ.get('OPENAI_API_KEY')");
    expect(result.content).toContain('import os');
  });
});
