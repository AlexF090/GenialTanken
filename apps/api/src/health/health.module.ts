import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';
import { WakeUpController } from './wake-up.controller.js';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController, WakeUpController],
})
export class HealthModule {}
