import { renderWithInputs, textOf } from '../../../testing/render-page';
import { SkeletonRows } from './skeleton-rows';

const blocksOf = (element: Element) => element.querySelectorAll('.skeleton-block');

describe('SkeletonRows', () => {
  it('draws three station rows by default, hidden from screen readers', async () => {
    const { element } = await renderWithInputs(SkeletonRows, {});

    expect(element.getAttribute('aria-hidden')).toBe('true');
    const rows = element.querySelectorAll('.skeleton-rows__row');
    expect(rows).toHaveLength(3);
    expect(textOf(element)).toBe('');
  });

  it('shapes a station row like a list row: price tile, two lines and room for the actions', async () => {
    const { element } = await renderWithInputs(SkeletonRows, { count: 1 });

    const row = element.querySelector('.skeleton-rows__row');
    expect(row?.querySelector('.skeleton-rows__tile')?.classList).toContain('skeleton-block');
    expect(row?.querySelectorAll('.skeleton-rows__line.skeleton-block')).toHaveLength(2);
    expect(row?.querySelector('.skeleton-rows__actions')?.classList).not.toContain(
      'skeleton-block'
    );
  });

  it('draws the requested number of text rows without price tiles', async () => {
    const { element } = await renderWithInputs(SkeletonRows, { count: 2, variant: 'text' });

    expect(element.querySelectorAll('.skeleton-rows__row')).toHaveLength(2);
    expect(element.querySelectorAll('.skeleton-rows__tile')).toHaveLength(0);
    expect(element.querySelectorAll('.skeleton-rows__actions')).toHaveLength(0);
  });

  it('draws price rows with the fuel at the start and the price at the end', async () => {
    const { element } = await renderWithInputs(SkeletonRows, { count: 3, variant: 'price' });

    const rows = element.querySelectorAll('.skeleton-rows__price-row');
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(blocksOf(row)).toHaveLength(2);
      expect(row.querySelector('.skeleton-rows__fuel')).not.toBeNull();
      expect(row.querySelector('.skeleton-rows__price-end')).not.toBeNull();
    }
    expect(element.querySelectorAll('.skeleton-rows__tile')).toHaveLength(0);
    expect(textOf(element)).toBe('');
  });

  it('draws the requested number of favorite tiles side by side', async () => {
    const { element } = await renderWithInputs(SkeletonRows, { count: 2, variant: 'tile' });

    expect(element.querySelectorAll('.skeleton-rows__card')).toHaveLength(2);
    expect(element.querySelectorAll('.skeleton-rows__row')).toHaveLength(0);
    expect(textOf(element)).toBe('');
  });
});
