import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { parseFrontendOrigins } from './common/frontend-url.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({
    origin: parseFrontendOrigins(),
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3030);
}
await bootstrap();
