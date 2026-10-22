import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readRepositoryFile = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/** Header lines per path pattern of a Cloudflare `_headers` file, in file order. */
const parseHeadersFile = (text: string): Map<string, string[]> => {
  const rules = new Map<string, string[]>();
  let currentLines: string[] | undefined;
  for (const line of text.split('\n')) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) {
      continue;
    }
    if (!/^\s/.test(line)) {
      currentLines = [];
      rules.set(line.trim(), currentLines);
      continue;
    }
    currentLines?.push(line.trim());
  }
  return rules;
};

describe('apps/web/public/_headers', () => {
  const rules = parseHeadersFile(readRepositoryFile('apps/web/public/_headers'));

  it('keeps hashed scripts immutable', () => {
    expect(rules.get('/*.js')).toEqual(['Cache-Control: public, max-age=31536000, immutable']);
  });

  it.each([
    '/ngsw-worker.js',
    '/safety-worker.js',
    '/worker-basic.min.js',
    '/ngsw.json',
    '/index.html',
    '/',
  ])('lets the browser revalidate %s on every request', path => {
    expect(rules.get(path)).toEqual(['! Cache-Control', 'Cache-Control: no-cache']);
  });
});

describe('apps/web/ngsw-config.json', () => {
  const configuration: unknown = JSON.parse(readRepositoryFile('apps/web/ngsw-config.json'));
  const setting = (name: string): unknown =>
    typeof configuration === 'object' && configuration !== null
      ? Reflect.get(configuration, name)
      : undefined;

  it('caches no API answers', () => {
    expect(setting('dataGroups') ?? []).toEqual([]);
  });

  it('never answers a navigation to the API with the app shell', () => {
    expect(setting('navigationUrls')).toEqual(expect.arrayContaining(['!/api', '!/api/**']));
  });

  it('loads every navigation from the network first', () => {
    expect(setting('navigationRequestStrategy')).toBe('freshness');
  });
});
