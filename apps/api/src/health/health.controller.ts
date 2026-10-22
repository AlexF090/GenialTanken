import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import type { HealthCheckResult } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { documentedHealthCheckSchema } from '../openapi/documented-schemas.js';

/** Liveness only: upstream outages must not make the hosting platform restart the service. */
@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly healthCheckService: HealthCheckService) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Reports that the application is running.' })
  @ApiOkResponse({
    description: 'The application is up; data sources are not checked.',
    standardSchema: documentedHealthCheckSchema,
  })
  async check(): Promise<HealthCheckResult> {
    return this.healthCheckService.check([]);
  }
}
