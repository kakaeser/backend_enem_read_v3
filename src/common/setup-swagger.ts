import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Ativo em dev; em produção só com ENABLE_SWAGGER=true. */
export function isSwaggerEnabled(): boolean {
  if (process.env.ENABLE_SWAGGER === 'true') return true;
  if (process.env.ENABLE_SWAGGER === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

export function setupSwagger(app: INestApplication): void {
  if (!isSwaggerEnabled()) return;

  const config = new DocumentBuilder()
    .setTitle('ENEM Read API')
    .setDescription(
      'Backend v3 — provas, participantes, respostas e resultados. ' +
        'Adm: `POST /auth/login` → Bearer no header. Refresh em cookie HttpOnly `refresh_token` (path `/auth`; teste refresh/logout no browser ou com cookie manual). ' +
        'Aplicador: `POST /auth/aplicador` → Bearer 6h. ' +
        'Todas as rotas exceto `GET /` exigem header `X-App-Api-Key` quando `APP_API_KEY` está configurado.',
    )
    .setVersion('1.0')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'X-App-Api-Key', description: 'Segredo compartilhado com o front (APP_API_KEY)' },
      'app-api-key',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token (administrador ou aplicador)',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  document.security = [{ 'app-api-key': [] }];
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
