import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  findInlineScripts,
  hashInlineScript,
  writeHostingFiles,
} from './generate-hosting-files.ts';

const INDEX_HTML = `<!doctype html><html><head>
<script>var theme = 'dark';</script>
<link rel="stylesheet" href="styles-ABC.css">
<script src="main-ABC.js" type="module"></script>
<script>document.querySelectorAll('link[data-beasties-media]')</script>
</head><body><app-root></app-root><noscript>Bitte aktiviere JavaScript</noscript></body></html>`;

describe('findInlineScripts', () => {
  it('returns the content of inline scripts and skips scripts with a source', () => {
    expect(findInlineScripts(INDEX_HTML)).toEqual([
      "var theme = 'dark';",
      "document.querySelectorAll('link[data-beasties-media]')",
    ]);
  });

  it('finds nothing in a page without inline scripts', () => {
    expect(findInlineScripts('<script src="a.js"></script>')).toEqual([]);
  });
});

describe('hashInlineScript', () => {
  it('is the base64 SHA-256 of the exact content, as a CSP source', () => {
    // printf 'alert(1)' | openssl dgst -sha256 -binary | base64
    expect(hashInlineScript('alert(1)')).toBe(
      "'sha256-bhHHL3z2vDgxUt0W3dWQOrprscmda2Y5pLsLg4GF+pI='"
    );
  });
});

describe('writeHostingFiles', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'hosting-files-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('writes the .htaccess next to index.html with the hashes of its inline scripts', async () => {
    await writeFile(join(directory, 'index.html'), INDEX_HTML);

    await writeHostingFiles(directory);

    const htaccess = await readFile(join(directory, '.htaccess'), 'utf8');
    expect(htaccess).toContain(hashInlineScript("var theme = 'dark';"));
    expect(htaccess).toContain(
      hashInlineScript("document.querySelectorAll('link[data-beasties-media]')")
    );
    expect(htaccess).toContain('connect-src');
  });

  it('fails without index.html, because the content security policy could not be derived', async () => {
    await expect(writeHostingFiles(directory)).rejects.toThrow(/index\.html/);
  });

  it.each([
    ['an event handler attribute', '<body onload="init()"></body>'],
    ['a javascript: URL', '<a href="javascript:init()">x</a>'],
  ])('fails when index.html contains %s, which the policy would block', async (_name, markup) => {
    await writeFile(join(directory, 'index.html'), `<html>${markup}</html>`);

    await expect(writeHostingFiles(directory)).rejects.toThrow(/content security policy/i);
  });
});
