import { Module } from '@nestjs/common';
import { ApplicationConfiguration } from '../configuration/application-configuration.js';
import { FranceFuelPriceProvider } from './france/france-fuel-price.provider.js';
import { FUEL_PRICE_PROVIDERS } from './fuel-price-provider.js';
import type { FuelPriceProvider } from './fuel-price-provider.js';
import { GermanyFuelPriceProvider } from './germany/germany-fuel-price.provider.js';
import { UpstreamModule } from '../upstream/upstream.module.js';

@Module({
  imports: [UpstreamModule],
  providers: [
    FranceFuelPriceProvider,
    GermanyFuelPriceProvider,
    {
      provide: FUEL_PRICE_PROVIDERS,
      inject: [ApplicationConfiguration, FranceFuelPriceProvider, GermanyFuelPriceProvider],
      useFactory: (
        configuration: ApplicationConfiguration,
        france: FranceFuelPriceProvider,
        germany: GermanyFuelPriceProvider
      ): FuelPriceProvider[] =>
        configuration.tankenTankenApiKey === undefined ? [france] : [france, germany],
    },
  ],
  exports: [FUEL_PRICE_PROVIDERS],
})
export class FuelPriceProvidersModule {}
