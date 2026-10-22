import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  findWranglerConfigurationProblems,
  stripJsonComments,
} from './verify-wrangler-configuration.ts';

describe('stripJsonComments', () => {
  it('removes line and block comments', () => {
    const text = '// header\n{ /* inline */ "name": "genialtanken" // trailing\n}';

    expect(JSON.parse(stripJsonComments(text))).toEqual({ name: 'genialtanken' });
  });

  it('keeps comment markers inside strings', () => {
    const text = '{ "url": "https://example.org/*path*/", "quote": "a \\" // b" }';

    expect(JSON.parse(stripJsonComments(text))).toEqual({
      url: 'https://example.org/*path*/',
      quote: 'a " // b',
    });
  });
});

describe('findWranglerConfigurationProblems', () => {
  it('accepts the repository configuration', () => {
    const text = readFileSync(new URL('../apps/web/wrangler.jsonc', import.meta.url), 'utf8');

    expect(findWranglerConfigurationProblems(text)).toEqual([]);
  });

  it('accepts trailing commas', () => {
    expect(findWranglerConfigurationProblems('{ "name": "genialtanken", }')).toEqual([]);
  });

  it('accepts trailing commas before comments', () => {
    const text = '{ "name": "genialtanken", // trailing\n "vars": [1, /* last */ ], }';

    expect(findWranglerConfigurationProblems(text)).toEqual([]);
  });

  it('keeps commas before closing brackets inside strings', () => {
    const text = '{ "name": "genialtanken,}", "quote": "a \\", ]" }';

    expect(findWranglerConfigurationProblems(text)).toEqual([
      "Unexpected Worker name 'genialtanken,}' in wrangler.jsonc.",
    ]);
  });

  it('rejects a top-level build section', () => {
    const text = '{ "name": "genialtanken", "build": { "command": "curl evil" } }';

    expect(findWranglerConfigurationProblems(text)).toEqual([
      'wrangler.jsonc must not define a build command (top level).',
    ]);
  });

  it('rejects a build section inside an environment', () => {
    const text = '{ "name": "genialtanken", "env": { "staging": { "build": {} }, "other": {} } }';

    expect(findWranglerConfigurationProblems(text)).toEqual([
      'wrangler.jsonc must not define a build command (env.staging).',
    ]);
  });

  it('rejects another Worker name', () => {
    expect(findWranglerConfigurationProblems('{ "name": "other" }')).toEqual([
      "Unexpected Worker name 'other' in wrangler.jsonc.",
    ]);
  });

  it('rejects text that is not JSONC', () => {
    const [problem] = findWranglerConfigurationProblems('{ "name": ');

    expect(problem).toMatch(/^wrangler\.jsonc is not valid JSONC: /);
  });

  it('rejects a configuration that is not an object', () => {
    expect(findWranglerConfigurationProblems('[]')).toEqual([
      'wrangler.jsonc must contain an object.',
    ]);
  });
});
