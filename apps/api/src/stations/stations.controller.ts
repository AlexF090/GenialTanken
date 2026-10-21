import { stationsQuerySchema } from '@genialtanken/contracts';
import type { Station, StationsQuery } from '@genialtanken/contracts';
import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { z } from 'zod';
import {
  documentedApiErrorSchema,
  documentedStationSchema,
} from '../openapi/documented-schemas.js';
import { stationIdentifierSchema } from '../fuel-price-providers/station-identifier.js';
import { StationsService } from './stations.service.js';

@ApiTags('stations')
@ApiBadRequestResponse({
  description: 'Invalid request parameters.',
  standardSchema: documentedApiErrorSchema,
})
@ApiTooManyRequestsResponse({
  description: 'Rate limit exceeded.',
  standardSchema: documentedApiErrorSchema,
})
@ApiBadGatewayResponse({
  description: 'All fuel price providers failed or did not answer in time.',
  standardSchema: documentedApiErrorSchema,
})
@Controller('stations')
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Get()
  @ApiOkResponse({
    description:
      'Stations of all enabled countries selling the requested fuel, nearest first (at most 100).',
    standardSchema: z.array(documentedStationSchema),
  })
  async findNearby(
    @Query({ schema: stationsQuerySchema }) query: StationsQuery
  ): Promise<Station[]> {
    return this.stationsService.findStationsAround(query);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'The station.', standardSchema: documentedStationSchema })
  @ApiNotFoundResponse({
    description: 'Unknown station.',
    standardSchema: documentedApiErrorSchema,
  })
  async findOne(
    @Param('id', { schema: stationIdentifierSchema }) stationIdentifier: string
  ): Promise<Station> {
    return this.stationsService.findStationByIdentifier(stationIdentifier);
  }
}
