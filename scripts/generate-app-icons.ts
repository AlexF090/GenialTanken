/**
 * Renders the SVG icon sources in apps/web/icon-source (and apps/web/public/favicon.svg) into the
 * PNG icons referenced by the web app manifest and index.html, plus favicon.ico.
 *
 * Uses the Chromium that Playwright already installed for the e2e workspace, so no image library
 * is needed. Run from the repository root (Node 24 strips the types natively):
 *
 *   node scripts/generate-app-icons.ts
 *
 * If Chromium is missing: pnpm --filter e2e exec playwright install chromium
 */
import type * as Playwright from '@playwright/test';
import type { Browser } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

interface IconTarget {
  source: string;
  output: string;
  sizeInPixels: number;
  /** Fills transparent areas, for platforms that render transparency as black (iOS). */
  backgroundColor?: string;
}

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const iconSourceDirectory = `${repositoryRoot}apps/web/icon-source/`;
const publicDirectory = `${repositoryRoot}apps/web/public/`;
const iconOutputDirectory = `${publicDirectory}icons/`;
const chalkColor = '#F3F5F4';

const appIcon = `${iconSourceDirectory}app-icon.svg`;
const maskableIcon = `${iconSourceDirectory}app-icon-maskable.svg`;
const favicon = `${publicDirectory}favicon.svg`;

const targets: IconTarget[] = [
  { source: appIcon, output: 'icon-192.png', sizeInPixels: 192 },
  { source: appIcon, output: 'icon-512.png', sizeInPixels: 512 },
  { source: maskableIcon, output: 'icon-maskable-192.png', sizeInPixels: 192 },
  { source: maskableIcon, output: 'icon-maskable-512.png', sizeInPixels: 512 },
  // iOS rounds the corners itself, so the full-bleed variant avoids a double rounding.
  {
    source: maskableIcon,
    output: 'apple-touch-icon-180.png',
    sizeInPixels: 180,
    backgroundColor: chalkColor,
  },
  {
    source: `${iconSourceDirectory}shortcut-favorites.svg`,
    output: 'shortcut-favorites-96.png',
    sizeInPixels: 96,
  },
  {
    source: `${iconSourceDirectory}shortcut-settings.svg`,
    output: 'shortcut-settings-96.png',
    sizeInPixels: 96,
  },
  { source: favicon, output: 'favicon-32.png', sizeInPixels: 32 },
];

/** Playwright lives in the e2e workspace, so resolve it from there instead of adding a dependency. */
function launchChromium(): Promise<Browser> {
  const requireFromEndToEnd = createRequire(new URL('../e2e/package.json', import.meta.url));
  // require() is untyped; the type import above describes the module it loads.
  const playwright = requireFromEndToEnd('@playwright/test') as typeof Playwright;
  return playwright.chromium.launch();
}

async function renderPng(browser: Browser, target: IconTarget): Promise<Buffer> {
  const svg = await readFile(target.source, 'utf8');
  const page = await browser.newPage({
    viewport: { width: target.sizeInPixels, height: target.sizeInPixels },
    deviceScaleFactor: 1,
  });
  try {
    const background = target.backgroundColor ?? 'transparent';
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:${background}">` +
        `<img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" ` +
        `width="${String(target.sizeInPixels)}" height="${String(target.sizeInPixels)}" ` +
        `style="display:block" alt="" /></body></html>`
    );
    await page.locator('img').evaluate(image => (image as HTMLImageElement).decode());
    return await page.screenshot({ omitBackground: target.backgroundColor === undefined });
  } finally {
    await page.close();
  }
}

/** Wraps PNG images into an ICO container (PNG-compressed entries, supported since Windows Vista). */
function toIco(images: { sizeInPixels: number; png: Buffer }[]): Buffer {
  const headerSize = 6;
  const directoryEntrySize = 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let imageOffset = headerSize + directoryEntrySize * images.length;
  const directoryEntries = images.map(({ sizeInPixels, png }) => {
    const entry = Buffer.alloc(directoryEntrySize);
    const sizeByte = sizeInPixels >= 256 ? 0 : sizeInPixels;
    entry.writeUInt8(sizeByte, 0);
    entry.writeUInt8(sizeByte, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(imageOffset, 12);
    imageOffset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...directoryEntries, ...images.map(({ png }) => png)]);
}

async function main(): Promise<void> {
  await mkdir(iconOutputDirectory, { recursive: true });
  const browser = await launchChromium();
  try {
    for (const target of targets) {
      const png = await renderPng(browser, target);
      await writeFile(`${iconOutputDirectory}${target.output}`, png);
      console.log(`Wrote apps/web/public/icons/${target.output}`);
    }

    const icoSizesInPixels = [16, 32, 48];
    const icoImages = [];
    for (const sizeInPixels of icoSizesInPixels) {
      const png = await renderPng(browser, { source: favicon, output: '', sizeInPixels });
      icoImages.push({ sizeInPixels, png });
    }
    await writeFile(`${publicDirectory}favicon.ico`, toIco(icoImages));
    console.log('Wrote apps/web/public/favicon.ico');
  } finally {
    await browser.close();
  }
}

await main();
