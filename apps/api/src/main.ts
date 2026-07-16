import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './http-exception.filter';

const isProd = process.env.NODE_ENV === 'production';

async function bootstrap() {
  // Fail-fast: critical secrets must be set in production
  if (isProd && !process.env.BETTER_AUTH_SECRET) {
    throw new Error('BETTER_AUTH_SECRET is required in production');
  }
  if (isProd && !process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production');
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS — only allow localhost origins in development
  const corsOrigins = isProd
    ? [process.env.NEXT_PUBLIC_APP_URL || 'https://clinicia.useia.api.br']
    : [
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'http://localhost:3000',
      ];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Swagger — only enable in development
  if (!isProd) {
    const config = new DocumentBuilder()
      .setTitle('CRM Clínicas API')
      .setDescription('API do CRM + Agente IA para clínicas')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 API running on http://localhost:${port}`);
  if (!isProd) console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
