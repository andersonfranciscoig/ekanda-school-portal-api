import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './shared/infrastructure/http/domain-exception.filter';
import { ResponseTransformInterceptor } from './shared/infrastructure/http/response-transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  app.use(cookieParser());

  const corsOrigins = config
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'X-Device-Id',
    ],
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new DomainExceptionFilter());
  app.useGlobalInterceptors(new ResponseTransformInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Ekanda School Portal API')
    .setDescription(
      'API do ecossistema educacional Ekanda (Angola) — MVP v1.0. ' +
        'Arquitectura DDD / Clean Architecture. ' +
        'Cadastro de colégios, marketplace, candidaturas, planos, subscrições e pagamentos.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token',
      },
      'access-token',
    )
    .addTag('auth', 'Autenticação e sessão')
    .addTag('users', 'Utilizadores')
    .addTag('schools', 'Colégios e perfil público')
    .addTag('marketplace', 'Marketplace, pesquisa e descoberta')
    .addTag('students', 'Estudantes (tutelados)')
    .addTag('applications', 'Candidaturas')
    .addTag('billing', 'Planos e faturação')
    .addTag('subscriptions', 'Subscrições')
    .addTag('payments', 'Pagamentos')
    .addTag('notifications', 'Notificações')
    .addTag('admin', 'Administração da plataforma')
    .addTag('audit', 'Auditoria')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);

  console.log(`Ekanda API listening on http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/docs`);
}

void bootstrap();
