import { NestFactory } from '@nestjs/core';
import { PaymentServiceModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(PaymentServiceModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api');
  await app.listen(process.env.port ?? 3004);
  console.log('Payment Service running on http://localhost:3004');
}
bootstrap();
