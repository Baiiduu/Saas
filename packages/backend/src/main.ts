import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const apiPrefix = process.env.API_PREFIX || 'api';
  const port = parseInt(process.env.PORT || '3000', 10);
  const swaggerPath = process.env.SWAGGER_PATH || 'docs';

  // ── Global prefix ──────────────────────────────────────
  app.setGlobalPrefix(apiPrefix);

  // ── API versioning ─────────────────────────────────────
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ── Global pipes are now registered via APP_PIPE in AppModule ──

  // ── CORS ───────────────────────────────────────────────
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // ── Cookie parser (for CSRF token) ─────────────────────
  app.use(cookieParser());

  // ── Swagger / OpenAPI ──────────────────────────────────
  if (process.env.SWAGGER_ENABLED !== 'false') {
    const config = new DocumentBuilder()
      .setTitle(process.env.APP_NAME || 'SaaS API')
      .setDescription('SaaS multi-tenant enterprise collaboration platform API')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(swaggerPath, app, document);

    Logger.log(`Swagger running at http://localhost:${port}/${swaggerPath}`);
  }

  // ── Start server ───────────────────────────────────────
  await app.listen(port);

  Logger.log(
    `🚀 ${process.env.APP_NAME || 'SaaS API'} running on http://localhost:${port}/${apiPrefix}`,
  );
}

bootstrap().catch((err) => {
  Logger.error('Failed to start application', err);
  process.exit(1);
});
