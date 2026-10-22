import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { accessibleTextOf, hostElementOf, textOf } from '../../../testing/render-page';
import { ExternalLink } from './external-link';

@Component({
  imports: [ExternalLink],
  template: `<app-external-link href="https://example.org/">Beispiel</app-external-link>`,
})
class ExternalLinkHost {}

const renderLink = async (): Promise<HTMLAnchorElement> => {
  const fixture = TestBed.createComponent(ExternalLinkHost);
  await fixture.whenStable();
  const link = hostElementOf(fixture).querySelector('a');
  if (link === null) {
    throw new Error('ExternalLink rendered no link');
  }
  return link;
};

describe('ExternalLink', () => {
  it('opens the address in a new tab without giving it access to this page', async () => {
    const link = await renderLink();

    expect(link.getAttribute('href')).toBe('https://example.org/');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('tells screen readers only that it opens a new tab', async () => {
    const link = await renderLink();

    expect(accessibleTextOf(link)).toBe('Beispiel (öffnet in neuem Tab)');
    expect(textOf(link.querySelector('.visually-hidden'))).toBe('(öffnet in neuem Tab)');
  });
});
