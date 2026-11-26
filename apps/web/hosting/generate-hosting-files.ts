/**
 * Writes the `.htaccess` into the build output after `ng build`:
 *
 *   node hosting/generate-hosting-files.ts [build directory]
 *
 * Runs without dependencies (Node strips the types natively). The content security policy needs
 * the hashes of the inline scripts in the built `index.html`, so the file is generated from the
 * build, not from the sources.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { API_ORIGIN } from '../src/environments/api-origin.ts';
import { buildHtaccess } from './htaccess.ts';

export const WEB_ORIGIN = 'https://genial-tanken.appool.de';
/** The legal notice of the operator applies to appool.de and all its subdomains. */
export const LEGAL_NOTICE_URL = 'https://appool.de/impressum';

const DEFAULT_BUILD_DIRECTORY = 'dist/web/browser';
const INLINE_SCRIPT_PATTERN = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;
/** Markup the content security policy would block, since it allows no inline handlers. */
const BLOCKED_MARKUP_PATTERNS: readonly [string, RegExp][] = [
  ['an inline event handler attribute', /<[^>]+\son[a-z]+\s*=/i],
  ['a javascript: URL', /(?:href|src|action)\s*=\s*["']?\s*javascript:/i],
];

/** The content of every `<script>` without a `src`, exactly as the browser hashes it. */
export const findInlineScripts = (html: string): string[] =>
  [...html.matchAll(INLINE_SCRIPT_PATTERN)].map(match => match[1] ?? '');

/** The CSP source for an inline script, e.g. `'sha256-…='`. */
export const hashInlineScript = (content: string): string =>
  `'sha256-${createHash('sha256').update(content).digest('base64')}'`;

export const writeHostingFiles = async (buildDirectory: string): Promise<void> => {
  const indexPath = join(buildDirectory, 'index.html');
  let html: string;
  try {
    html = await readFile(indexPath, 'utf8');
  } catch (error) {
    throw new Error(
      `Cannot read ${indexPath}; the content security policy needs its inline scripts. Run the Angular build first.`,
      { cause: error }
    );
  }
  const problems = BLOCKED_MARKUP_PATTERNS.filter(([, pattern]) => pattern.test(html)).map(
    ([description]) => description
  );
  if (problems.length > 0) {
    throw new Error(
      `index.html contains ${problems.join(' and ')}, which the content security policy blocks.`
    );
  }
  const htaccess = buildHtaccess({
    webOrigin: WEB_ORIGIN,
    apiOrigin: API_ORIGIN,
    legalNoticeUrl: LEGAL_NOTICE_URL,
    inlineScriptHashes: findInlineScripts(html).map(hashInlineScript),
  });
  await writeFile(join(buildDirectory, '.htaccess'), htaccess);
};

if (import.meta.main) {
  const buildDirectory = process.argv[2] ?? DEFAULT_BUILD_DIRECTORY;
  await writeHostingFiles(buildDirectory);
  console.log(`.htaccess for ${WEB_ORIGIN} written to ${buildDirectory}`);
}
