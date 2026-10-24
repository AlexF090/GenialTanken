import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { isShareCanceled, SHARE } from './share';

describe('isShareCanceled', () => {
  it('treats a closed share sheet as canceled', () => {
    expect(isShareCanceled(new DOMException('Share canceled', 'AbortError'))).toBe(true);
  });

  it.each([
    new DOMException('Not allowed', 'NotAllowedError'),
    new DOMException('Bad data', 'DataError'),
    new Error('AbortError'),
    { name: 'AbortError' },
    undefined,
  ])('treats %o as a failure', error => {
    expect(isShareCanceled(error)).toBe(false);
  });
});

describe('SHARE', () => {
  const documentWith = (navigator: Partial<Navigator>): Document => {
    const fakeDocument = document.implementation.createHTMLDocument();
    Object.defineProperty(fakeDocument, 'defaultView', { value: { navigator } });
    return fakeDocument;
  };

  it('is missing where the browser has no share sheet', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: documentWith({}) }],
    });

    expect(TestBed.inject(SHARE)).toBeUndefined();
  });

  it('hands the data to the system share sheet', async () => {
    const share = vi.fn<Navigator['share']>().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: documentWith({ share }) }],
    });
    const data = { title: 'TotalEnergies', url: 'https://example.com/stations/fr-75001001' };

    await TestBed.inject(SHARE)?.(data);

    expect(share).toHaveBeenCalledExactlyOnceWith(data);
  });
});
