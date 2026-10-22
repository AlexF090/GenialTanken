import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { ApiError } from '@genialtanken/contracts';
import type { Response } from 'express';
import { describeError } from './describe-error.js';
import { ERROR_MESSAGES } from './error-messages.js';
import { UpstreamUnavailableError } from './upstream-unavailable-error.js';

const MESSAGE_SEPARATOR = '; ';

const hasMessage = (body: object): body is { message: unknown } => 'message' in body;

const toMessage = (exception: HttpException): string => {
  const body = exception.getResponse();
  if (typeof body === 'string') {
    return body;
  }
  if (!hasMessage(body)) {
    return exception.message;
  }
  if (Array.isArray(body.message)) {
    return body.message.map(String).join(MESSAGE_SEPARATOR);
  }
  return typeof body.message === 'string' ? body.message : exception.message;
};

/** Shapes every error response as `ApiError` (`{ statusCode, message }`). */
@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const apiError = this.toApiError(exception);
    response.status(apiError.statusCode).json(apiError);
  }

  private toApiError(exception: unknown): ApiError {
    if (exception instanceof HttpException) {
      return { statusCode: exception.getStatus(), message: toMessage(exception) };
    }
    if (exception instanceof UpstreamUnavailableError) {
      return { statusCode: HttpStatus.BAD_GATEWAY, message: exception.message };
    }

    this.logger.error('Unhandled error while processing a request', describeError(exception));
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: ERROR_MESSAGES.internalServerError,
    };
  }
}
