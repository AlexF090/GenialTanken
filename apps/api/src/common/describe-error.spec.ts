import { describeError } from './describe-error.js';

describe('describeError', () => {
  it('describes an error by its stack', () => {
    const error = new TypeError('a bug');

    expect(describeError(error)).toBe(error.stack);
  });

  it('describes an error without stack by its name and message', () => {
    const error = new TypeError('a bug');
    error.stack = undefined;

    expect(describeError(error)).toBe('TypeError: a bug');
  });

  it('describes a thrown value that is not an error as text', () => {
    expect(describeError('a string')).toBe('a string');
  });
});
