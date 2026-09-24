/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { v4 as uuidv4 } from 'uuid';
import {
  DocumentBuilder,
  SwaggerDocumentOptions,
  SwaggerModule,
} from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { enableApiVersioning } from './common/versioning/enable-api-versioning';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.useLogger(app.get(Logger));

  enableApiVersioning(app);

  // Enable CORS
  const corsOrigin = process.env.CORS_ORIGIN;
  const normalizeOrigin = (origin: string): string =>
    origin.trim().replace(/\/+$/, '').toLowerCase();

  const allowedOrigins = corsOrigin
    ? corsOrigin
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
        .map(normalizeOrigin)
    : true; // Allow all origins in local if not specified

  app.enableCors({
    origin: (origin, callback) => {
      // Non-browser clients (curl/postman) may not send an Origin header.
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins === true) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = normalizeOrigin(origin);
      const allowAll = allowedOrigins.includes('*');

      if (allowAll || allowedOrigins.includes(normalizedOrigin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.use((req, res, next) => {
    req.id = uuidv4();
    next();
  });
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Book and Sign API')
    .setDescription('Book and Sign API description')
    .addBearerAuth(
      {
        name: 'Authorization',
        description: 'Please enter token',
        scheme: 'Bearer',
        type: 'http',
        in: 'Header',
        bearerFormat: 'Bearer',
      },
      'access-token',
    )
    .setVersion('0.1')
    .addServer('/')
    .build();

  const swaggerOptions: SwaggerDocumentOptions = {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  };

  const document = SwaggerModule.createDocument(
    app,
    swaggerConfig,
    swaggerOptions,
  );
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
