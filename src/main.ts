import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { assertAppApiKeyConfigured } from './common/app-api-key.config.js';
import { parseFrontendOrigins } from './common/frontend-url.js';
import { setupSwagger } from './common/setup-swagger.js';

async function bootstrap() {
  assertAppApiKeyConfigured();
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({
    origin: parseFrontendOrigins(),
    credentials: true,
  });
  setupSwagger(app);
  await app.listen(process.env.PORT ?? 3030);
}
await bootstrap();
