import { uniqueIdentifier } from './unique-identifier';

describe('uniqueIdentifier', () => {
  it('starts with the prefix and never repeats', () => {
    const first = uniqueIdentifier('menu');
    const second = uniqueIdentifier('menu');

    expect(first).toMatch(/^menu-\d+$/);
    expect(second).toMatch(/^menu-\d+$/);
    expect(second).not.toBe(first);
  });
});
