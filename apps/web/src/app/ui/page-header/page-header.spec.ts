import { renderWithInputs, textOf } from '../../../testing/render-page';
import { PageHeader } from './page-header';

describe('PageHeader', () => {
  it('shows the title as the only heading and no links', async () => {
    const { element } = await renderWithInputs(PageHeader, { title: 'Favoriten' });

    expect(textOf(element.querySelector('header h1'))).toBe('Favoriten');
    expect(element.querySelectorAll('h1, h2, h3')).toHaveLength(1);
    expect(element.querySelectorAll('a')).toHaveLength(0);
  });
});
