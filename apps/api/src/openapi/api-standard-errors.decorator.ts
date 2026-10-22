import { applyDecorators } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { documentedApiErrorSchema } from './documented-schemas.js';

/** The errors every endpoint in front of a data source can answer with. */
export const ApiStandardErrors = (badGatewayDescription: string) =>
  applyDecorators(
    ApiBadRequestResponse({
      description: 'Invalid request parameters.',
      standardSchema: documentedApiErrorSchema,
    }),
    ApiTooManyRequestsResponse({
      description: 'Rate limit exceeded.',
      standardSchema: documentedApiErrorSchema,
    }),
    ApiBadGatewayResponse({
      description: badGatewayDescription,
      standardSchema: documentedApiErrorSchema,
    })
  );
