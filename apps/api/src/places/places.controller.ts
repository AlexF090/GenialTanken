import { placesQuerySchema } from '@genialtanken/contracts';
import type { Place, PlacesQuery } from '@genialtanken/contracts';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ApiStandardErrors } from '../openapi/api-standard-errors.decorator.js';
import { documentedPlaceSchema } from '../openapi/documented-schemas.js';
import { PlacesService } from './places.service.js';

@ApiTags('places')
@ApiStandardErrors('The place search failed or did not answer in time.')
@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get()
  @ApiOperation({ summary: 'Searches places in France for the search field.' })
  @ApiOkResponse({
    description: 'Places in France matching the query, best match first.',
    standardSchema: z.array(documentedPlaceSchema),
  })
  async findPlaces(@Query({ schema: placesQuerySchema }) query: PlacesQuery): Promise<Place[]> {
    return this.placesService.findPlaces(query);
  }
}
