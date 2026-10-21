import {
  MAXIMUM_STATION_IDENTIFIERS_PER_REQUEST,
  stationLookupQuerySchema,
  stationsQuerySchema,
} from '@genialtanken/contracts';
import type {
  Station,
  StationLookup,
  StationLookupQuery,
  StationsQuery,
} from '@genialtanken/contracts';
import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { z } from 'zod';
import {
  documentedApiErrorSchema,
  documentedStationLookupSchema,
  documentedStationSchema,
} from '../openapi/documented-schemas.js';
import { stationIdentifierSchema } from '../fuel-price-providers/station-identifier.js';
import { MAXIMUM_STATIONS_PER_RESPONSE, StationsService } from './stations.service.js';

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
    description: `Stations of all enabled countries selling the requested fuel, nearest first (at most ${String(MAXIMUM_STATIONS_PER_RESPONSE)}).`,
    standardSchema: z.array(documentedStationSchema),
  })
  async findNearby(
    @Query({ schema: stationsQuerySchema }) query: StationsQuery
  ): Promise<Station[]> {
    return this.stationsService.findStationsAround(query);
  }

  // Declared before `:id`, because `by-identifiers` also matches the station identifier pattern.
  @Get('by-identifiers')
  @ApiQuery({
    name: 'identifiers',
    type: String,
    description: `Comma-separated station identifiers, e.g. \`fr-92242003,fr-75012010\`; at most ${String(MAXIMUM_STATION_IDENTIFIERS_PER_REQUEST)} after removing duplicates.`,
  })
  @ApiOkResponse({
    description:
      'The found stations in the requested order without distance, plus the identifiers that are unknown or whose provider failed. Partial when some providers fail.',
    standardSchema: documentedStationLookupSchema,
  })
  async findByIdentifiers(
    @Query({ schema: stationLookupQuerySchema }) { identifiers }: StationLookupQuery
  ): Promise<StationLookup> {
    return this.stationsService.findStationsByIdentifiers(identifiers);
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
