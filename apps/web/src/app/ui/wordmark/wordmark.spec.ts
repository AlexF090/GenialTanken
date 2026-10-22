import { TestBed } from '@angular/core/testing';
import { hostElementOf } from '../../../testing/render-page';
import { Wordmark } from './wordmark';

describe('Wordmark', () => {
  it('is one image named after the app, so screen readers read the name once', async () => {
    const fixture = TestBed.createComponent(Wordmark);
    await fixture.whenStable();

    const images = hostElementOf(fixture).querySelectorAll('[role="img"]');

    expect(images).toHaveLength(1);
    expect(images[0]?.getAttribute('aria-label')).toBe('GenialTanken');
  });
});
