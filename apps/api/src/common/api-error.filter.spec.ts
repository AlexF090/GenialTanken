import { BadRequestException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import type { MockInstance } from 'vitest';
import { ApiErrorFilter } from './api-error.filter.js';
import { ERROR_MESSAGES } from './error-messages.js';

interface SentResponse {
  statusCode?: number;
  body?: unknown;
}

const respondTo = (exception: unknown): SentResponse => {
  const sent: SentResponse = {};
  const response = {
    status(statusCode: number) {
      sent.statusCode = statusCode;
      return this;
    },
    json(body: unknown) {
      sent.body = body;
      return this;
    },
  };
  new ApiErrorFilter().catch(exception, new ExecutionContextHost([{}, response]));
  return sent;
};

let loggedError: MockInstance<Logger['error']>;

beforeEach(() => {
  loggedError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ApiErrorFilter', () => {
  it('passes on the status and message of an HTTP exception', () => {
    expect(
      respondTo(new HttpException('Too many requests.', HttpStatus.TOO_MANY_REQUESTS))
    ).toEqual({ statusCode: 429, body: { statusCode: 429, message: 'Too many requests.' } });
  });

  it('falls back to the exception message when the body has no message', () => {
    const exception = new HttpException({ reason: 'teapot' }, HttpStatus.I_AM_A_TEAPOT);

    expect(respondTo(exception).body).toEqual({ statusCode: 418, message: 'Http Exception' });
  });

  it('joins several validation messages', () => {
    const exception = new BadRequestException(['latitude is required', 'fuel is unknown']);

    expect(respondTo(exception).body).toEqual({
      statusCode: 400,
      message: 'latitude is required; fuel is unknown',
    });
  });

  it('hides the details of an unexpected error and logs it', () => {
    const sent = respondTo(new TypeError('Cannot read properties of undefined (reading "secret")'));

    expect(sent).toEqual({
      statusCode: 500,
      body: { statusCode: 500, message: ERROR_MESSAGES.internalServerError },
    });
    expect(loggedError).toHaveBeenCalledWith(
      'Unhandled error while processing a request',
      expect.stringContaining('TypeError: Cannot read properties of undefined')
    );
  });

  it('answers 500 for a thrown value that is not an error', () => {
    expect(respondTo('a string').body).toEqual({
      statusCode: 500,
      message: ERROR_MESSAGES.internalServerError,
    });
  });
});
