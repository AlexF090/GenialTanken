import { Module } from '@nestjs/common';
import { FranceFuelPriceProvider } from './france/france-fuel-price.provider.js';
import { FrenchStationIdentityLookup } from './france/french-station-identity-lookup.js';
import { FUEL_PRICE_PROVIDERS } from './fuel-price-provider.js';
import type { FuelPriceProvider } from './fuel-price-provider.js';
import { UpstreamModule } from '../upstream/upstream.module.js';

@Module({
  imports: [UpstreamModule],
  providers: [
    FranceFuelPriceProvider,
    FrenchStationIdentityLookup,
    {
      provide: FUEL_PRICE_PROVIDERS,
      inject: [FranceFuelPriceProvider],
      useFactory: (france: FranceFuelPriceProvider): FuelPriceProvider[] => [france],
    },
  ],
  exports: [FUEL_PRICE_PROVIDERS],
})
export class FuelPriceProvidersModule {}
