import { Module } from '@nestjs/common';
import { FuelPriceProvidersModule } from '../fuel-price-providers/fuel-price-providers.module.js';
import { StationsController } from './stations.controller.js';
import { StationsService } from './stations.service.js';

@Module({
  imports: [FuelPriceProvidersModule],
  controllers: [StationsController],
  providers: [StationsService],
})
export class StationsModule {}
