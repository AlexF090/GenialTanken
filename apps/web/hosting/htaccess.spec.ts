import { describe, expect, it } from 'vitest';
import {
  CACHE_BUSTED_FILE_PATTERN,
  REVALIDATED_FILE_PATTERN,
  buildContentSecurityPolicy,
  buildHtaccess,
} from './htaccess.ts';
import type { HtaccessOptions } from './htaccess.ts';

const OPTIONS: HtaccessOptions = {
  webOrigin: 'https://genial-tanken.appool.de',
  apiOrigin: 'https://genialtanken-api.onrender.com',
  legalNoticeUrl: 'https://appool.de/impressum',
  inlineScriptHashes: ["'sha256-first='", "'sha256-second='"],
};

/** File names of a real production build (`ng build`), at the root of the output. */
const BUILD_FILES = {
  cacheBusted: [
    'main-PLGJPCCY.js',
    'chunk-_Jdiwry7.js',
    'chunk-B6defCny.js',
    'chunk-BAtTWZW8.js',
    'styles-T2X3EKHF.css',
  ],
  revalidated: [
    'index.html',
    'ngsw.json',
    'ngsw-worker.js',
    'safety-worker.js',
    'worker-basic.min.js',
    'manifest.webmanifest',
  ],
  other: ['favicon.ico', 'favicon.svg'],
};

const htaccess = buildHtaccess(OPTIONS);
const lines = htaccess.split('\n').map(line => line.trim());

const headerValue = (name: string): string => {
  const line = lines.find(candidate => candidate.startsWith(`Header always set ${name} `));
  const value = /"(.*)"$/.exec(line ?? '')?.[1];
  if (value === undefined) {
    throw new Error(`No header ${name} in the generated .htaccess.`);
  }
  return value;
};

const directiveValues = (policy: string, directive: string): string[] => {
  const entry = policy.split('; ').find(candidate => candidate.startsWith(`${directive} `));
  return entry?.split(' ').slice(1) ?? [];
};

describe('buildHtaccess', () => {
  it('redirects HTTP to the fixed HTTPS address of the web app, never to the raw host header', () => {
    const start = lines.indexOf('RewriteCond %{HTTPS} !=on');

    expect(lines[start + 1]).toBe('RewriteCond %{HTTP_HOST} ^genial-tanken\\.appool\\.de$ [NC]');
    expect(lines[start + 2]).toBe(
      'RewriteRule ^ https://genial-tanken.appool.de%{REQUEST_URI} [R=301,L,NE]'
    );
  });

  it('sends /impressum to the legal notice of appool.de', () => {
    expect(lines).toContain('Redirect 301 /impressum https://appool.de/impressum');
  });

  it('falls back to index.html for client routes, except real files, directories and file names', () => {
    const start = lines.indexOf('RewriteCond %{REQUEST_FILENAME} !-f');

    expect(lines.slice(start, start + 4)).toEqual([
      'RewriteCond %{REQUEST_FILENAME} !-f',
      'RewriteCond %{REQUEST_FILENAME} !-d',
      'RewriteCond %{REQUEST_URI} !\\.[A-Za-z0-9]+$',
      'RewriteRule ^ /index.html [L]',
    ]);
  });

  it('answers missing files with the app and status 404', () => {
    expect(lines).toContain('ErrorDocument 404 /index.html');
  });

  it('lists no directories', () => {
    expect(lines).toContain('Options -Indexes');
  });

  it('serves the web manifest with its own media type', () => {
    expect(lines).toContain('AddType application/manifest+json .webmanifest');
  });

  it('revalidates index.html, the service worker, its manifest and the web manifest on every request', () => {
    const pattern = new RegExp(REVALIDATED_FILE_PATTERN);

    for (const file of BUILD_FILES.revalidated) {
      expect(file).toMatch(pattern);
    }
    for (const file of [...BUILD_FILES.cacheBusted, ...BUILD_FILES.other]) {
      expect(file).not.toMatch(pattern);
    }
    expect(htaccess).toContain(`<FilesMatch "${REVALIDATED_FILE_PATTERN}">`);
    expect(lines).toContain('Header always set Cache-Control "no-cache"');
  });

  it('revalidates HTML for every route, which the fallback and the 404 page serve', () => {
    expect(htaccess).toContain(
      'Header always set Cache-Control "no-cache" "expr=%{CONTENT_TYPE} =~ m#^text/html(;|$)#"'
    );
  });

  it('caches scripts and styles with a content hash for a year, but never the service worker', () => {
    const pattern = new RegExp(CACHE_BUSTED_FILE_PATTERN);

    for (const file of BUILD_FILES.cacheBusted) {
      expect(`/${file}`).toMatch(pattern);
    }
    for (const file of [...BUILD_FILES.revalidated, ...BUILD_FILES.other]) {
      expect(`/${file}`).not.toMatch(pattern);
    }
    expect(htaccess).toContain(`<If "%{REQUEST_URI} =~ m#${CACHE_BUSTED_FILE_PATTERN}#">`);
    expect(htaccess).toContain('Header set Cache-Control "public, max-age=31536000, immutable"');
  });

  it('caches the hashed media files for a year and the icons for a day', () => {
    expect(htaccess).toContain('<If "%{REQUEST_URI} =~ m#^/media/#">');
    expect(htaccess).toContain('<If "%{REQUEST_URI} =~ m#^/icons/#">');
    expect(htaccess).toContain('Header set Cache-Control "public, max-age=86400"');
  });

  it('sets HSTS for two years with subdomains and without preload', () => {
    const value = headerValue('Strict-Transport-Security');

    expect(value).toBe('max-age=63072000; includeSubDomains');
    expect(value).not.toContain('preload');
  });

  it('sets the security headers, keeping geolocation for the app itself', () => {
    expect(headerValue('X-Content-Type-Options')).toBe('nosniff');
    expect(headerValue('X-Frame-Options')).toBe('DENY');
    expect(headerValue('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headerValue('Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(headerValue('Permissions-Policy')).toBe('geolocation=(self), camera=(), microphone=()');
  });

  it('sends the content security policy', () => {
    expect(headerValue('Content-Security-Policy')).toBe(buildContentSecurityPolicy(OPTIONS));
  });

  it('compresses text answers', () => {
    expect(htaccess).toMatch(/AddOutputFilterByType DEFLATE .*application\/json/);
    expect(htaccess).toMatch(/AddOutputFilterByType DEFLATE .*application\/manifest\+json/);
  });
});

describe('buildContentSecurityPolicy', () => {
  const policy = buildContentSecurityPolicy(OPTIONS);

  it('allows scripts from the own origin and the inline scripts of index.html by hash only', () => {
    expect(directiveValues(policy, 'script-src')).toEqual([
      "'self'",
      "'sha256-first='",
      "'sha256-second='",
    ]);
  });

  it('never allows eval or inline scripts without a hash', () => {
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain("'wasm-unsafe-eval'");
    expect(directiveValues(policy, 'script-src')).not.toContain("'unsafe-inline'");
  });

  it('allows inline styles for the styles Angular adds to the page at run time, and nowhere else', () => {
    expect(directiveValues(policy, 'style-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(policy.match(/unsafe-inline/g)).toHaveLength(1);
  });

  it('lets the app call only itself and the API', () => {
    expect(directiveValues(policy, 'connect-src')).toEqual([
      "'self'",
      'https://genialtanken-api.onrender.com',
    ]);
  });

  it('loads map tiles from OpenStreetMap and Mapbox only', () => {
    expect(directiveValues(policy, 'img-src')).toEqual([
      "'self'",
      'data:',
      'https://tile.openstreetmap.org',
      'https://api.mapbox.com',
    ]);
  });

  it('restricts everything else', () => {
    expect(directiveValues(policy, 'default-src')).toEqual(["'self'"]);
    expect(directiveValues(policy, 'worker-src')).toEqual(["'self'"]);
    expect(directiveValues(policy, 'manifest-src')).toEqual(["'self'"]);
    expect(directiveValues(policy, 'object-src')).toEqual(["'none'"]);
    expect(directiveValues(policy, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directiveValues(policy, 'base-uri')).toEqual(["'self'"]);
    expect(directiveValues(policy, 'form-action')).toEqual(["'self'"]);
  });
});
