import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('../apps/web/src/styles.scss', import.meta.url), 'utf8');

describe('full window height of the installed app', () => {
  it('declares the standalone height after the base rule, which would otherwise win the cascade', () => {
    const baseRule = styles.indexOf('html,\nbody {\n  margin: 0;');
    const standaloneRule = styles.indexOf('@media (display-mode: standalone)');

    expect(baseRule).toBeGreaterThanOrEqual(0);
    expect(standaloneRule).toBeGreaterThan(baseRule);
  });
});
