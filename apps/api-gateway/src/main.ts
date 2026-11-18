import 'reflect-metadata';
import { json } from 'express';
import { NestFactory } from '@nestjs/core';
import { securityMiddleware } from './security';
import { AppModule } from './app.module';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '3mb' }));
  app.setGlobalPrefix('api');
  const origin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
  app.enableCors({ origin, credentials: true });
  app.use(securityMiddleware(origin));
  await app.listen(Number(process.env.PORT ?? 3000));
}
void bootstrap();
