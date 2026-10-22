import { Module } from '@nestjs/common';
import { UpstreamModule } from '../upstream/upstream.module.js';
import { PhotonClient } from './photon/photon-client.js';
import { PlacesController } from './places.controller.js';
import { PlacesService } from './places.service.js';

@Module({
  imports: [UpstreamModule],
  controllers: [PlacesController],
  providers: [PhotonClient, PlacesService],
})
export class PlacesModule {}
