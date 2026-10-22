import {
  MAXIMUM_STATION_IDENTIFIERS_PER_REQUEST,
  STATION_IDENTIFIER_PATTERN,
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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import { ApiStandardErrors } from '../openapi/api-standard-errors.decorator.js';
import {
  documentedApiErrorSchema,
  documentedStationLookupSchema,
  documentedStationSchema,
} from '../openapi/documented-schemas.js';
import { stationIdentifierSchema } from '../fuel-price-providers/station-identifier.js';
import { MAXIMUM_STATIONS_PER_RESPONSE, StationsService } from './stations.service.js';

@ApiTags('stations')
@ApiStandardErrors('All fuel price providers failed or did not answer in time.')
@Controller('stations')
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Get()
  @ApiOperation({ summary: 'Finds the stations around a position selling a fuel.' })
  @ApiOkResponse({
    description: `Stations of all enabled countries selling the requested fuel, nearest first (at most ${String(MAXIMUM_STATIONS_PER_RESPONSE)}).`,
    standardSchema: z.array(documentedStationSchema),
  })
  async findStationsAround(
    @Query({ schema: stationsQuerySchema }) query: StationsQuery
  ): Promise<Station[]> {
    return this.stationsService.findStationsAround(query);
  }

  // Declared before `:id`, because `by-identifiers` also matches the station identifier pattern.
  @Get('by-identifiers')
  @ApiOperation({ summary: 'Looks up several stations at once, e.g. the favorites.' })
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
  async findStationsByIdentifiers(
    @Query({ schema: stationLookupQuerySchema }) { identifiers }: StationLookupQuery
  ): Promise<StationLookup> {
    return this.stationsService.findStationsByIdentifiers(identifiers);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Looks up one station.' })
  @ApiParam({
    name: 'id',
    description: 'Station identifier: lowercase country code and the identifier of the provider.',
    schema: { type: 'string', pattern: STATION_IDENTIFIER_PATTERN.source },
    example: 'fr-92242003',
  })
  @ApiOkResponse({ description: 'The station.', standardSchema: documentedStationSchema })
  @ApiNotFoundResponse({
    description: 'Unknown station.',
    standardSchema: documentedApiErrorSchema,
  })
  async findStationByIdentifier(
    @Param('id', { schema: stationIdentifierSchema }) stationIdentifier: string
  ): Promise<Station> {
    return this.stationsService.findStationByIdentifier(stationIdentifier);
  }
}
