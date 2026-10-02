import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { ApplicationConfiguration } from './configuration/application-configuration.js';
import { configureApplication } from './configure-application.js';

const LISTEN_ON_ALL_INTERFACES = '0.0.0.0';

const bootstrap = async (): Promise<void> => {
  const application = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(), {
    abortOnError: false,
  });
  configureApplication(application);
  application.enableShutdownHooks();
  await application.listen(
    application.get(ApplicationConfiguration).port,
    LISTEN_ON_ALL_INTERFACES
  );
};

await bootstrap();
