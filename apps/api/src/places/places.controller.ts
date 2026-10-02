import { placesQuerySchema } from '@genialtanken/contracts';
import type { Place, PlacesQuery } from '@genialtanken/contracts';
import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { z } from 'zod';
import { documentedApiErrorSchema, documentedPlaceSchema } from '../openapi/documented-schemas.js';
import { PlacesService } from './places.service.js';

@ApiTags('places')
@ApiBadRequestResponse({
  description: 'Invalid request parameters.',
  standardSchema: documentedApiErrorSchema,
})
@ApiTooManyRequestsResponse({
  description: 'Rate limit exceeded.',
  standardSchema: documentedApiErrorSchema,
})
@ApiBadGatewayResponse({
  description: 'The place search failed or did not answer in time.',
  standardSchema: documentedApiErrorSchema,
})
@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get()
  @ApiOkResponse({
    description: 'Places in France and Germany matching the query, best match first.',
    standardSchema: z.array(documentedPlaceSchema),
  })
  async search(@Query({ schema: placesQuerySchema }) query: PlacesQuery): Promise<Place[]> {
    return this.placesService.findPlaces(query);
  }
}
