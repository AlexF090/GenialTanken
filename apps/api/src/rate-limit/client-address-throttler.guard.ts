import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectThrottlerOptions, InjectThrottlerStorage, ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import type { Request } from 'express';
import { ApplicationConfiguration } from '../configuration/application-configuration.js';
import {
  CLIENT_ADDRESS_HEADER,
  PROXY_SECRET_HEADER,
  resolveClientAddress,
} from './resolve-client-address.js';

/** Rate-limits per client, also behind the Cloudflare Worker (see `resolveClientAddress`). */
@Injectable()
export class ClientAddressThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly configuration: ApplicationConfiguration
  ) {
    super(options, storageService, reflector);
  }

  protected override async getTracker(request: Request): Promise<string> {
    const clientAddress = resolveClientAddress(
      {
        connectingAddress: request.ip,
        providedSecret: request.headers[PROXY_SECRET_HEADER],
        forwardedClientAddress: request.headers[CLIENT_ADDRESS_HEADER],
      },
      this.configuration.proxySharedSecret
    );
    // The base tracker normalizes the address, grouping IPv6 clients by subnet
    return super.getTracker({ ip: clientAddress });
  }
}
