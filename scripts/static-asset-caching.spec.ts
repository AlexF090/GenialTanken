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

const escapeRegularExpression = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A path pattern with at most one splat (`*`), which greedily matches any characters. */
const matchesPattern = (pattern: string, path: string): boolean =>
  new RegExp(`^${pattern.split('*').map(escapeRegularExpression).join('.*')}$`).test(path);

/**
 * The value of a header for a requested path as Cloudflare combines the rules: every matching
 * rule applies in file order, `! Name` removes what earlier rules set, values add up.
 */
const headerFor = (rules: Map<string, string[]>, path: string, name: string): string => {
  let values: string[] = [];
  for (const [pattern, lines] of rules) {
    if (!matchesPattern(pattern, path)) {
      continue;
    }
    for (const line of lines) {
      if (line === `! ${name}`) {
        values = [];
      } else if (line.startsWith(`${name}:`)) {
        values.push(line.slice(name.length + 1).trim());
      }
    }
  }
  return values.join(', ');
};

describe('apps/web/public/_headers', () => {
  const rules = parseHeadersFile(readRepositoryFile('apps/web/public/_headers'));
  const cacheControlFor = (path: string): string => headerFor(rules, path, 'Cache-Control');

  it.each([
    '/',
    '/index.html',
    '/ngsw-worker.js',
    '/safety-worker.js',
    '/worker-basic.min.js',
    '/ngsw.json',
    // Deep links, unknown paths and trailing slashes get index.html through
    // `not_found_handling`, but `_headers` matches the requested path.
    '/favorites',
    '/favorites/',
    '/settings',
    '/stations/fr-75001001',
    '/stations/fr-75001001/',
    '/map',
    '/does-not-exist',
    '/does/not/exist/',
  ])('serves %s with no-cache only', path => {
    expect(cacheControlFor(path)).toBe('no-cache');
  });

  it.each(['/main-ABCD1234.js', '/chunk-EFGH5678.js', '/styles-IJKL9012.css', '/media/font.woff2'])(
    'keeps the hashed asset %s immutable',
    path => {
      expect(cacheControlFor(path)).toBe('public, max-age=31536000, immutable');
    }
  );

  it.each(['/icons/icon-192.png', '/favicon.svg', '/favicon.ico'])(
    'caches the stable name %s for a day',
    path => {
      expect(cacheControlFor(path)).toBe('public, max-age=86400');
    }
  );

  it('caches the manifest for an hour', () => {
    expect(cacheControlFor('/manifest.webmanifest')).toBe('public, max-age=3600');
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
