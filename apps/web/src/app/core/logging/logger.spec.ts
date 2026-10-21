import { TestBed } from '@angular/core/testing';
import { Logger } from './logger';

describe('Logger', () => {
  it('writes warnings with their details to the console', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const details = new Error('quota exceeded');

    TestBed.inject(Logger).warn('Favorites could not be persisted', details);

    expect(warn).toHaveBeenCalledExactlyOnceWith('Favorites could not be persisted', details);
  });

  it('writes errors with their details to the console', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    TestBed.inject(Logger).error('Something broke', 1, 'two');

    expect(error).toHaveBeenCalledExactlyOnceWith('Something broke', 1, 'two');
  });
});
