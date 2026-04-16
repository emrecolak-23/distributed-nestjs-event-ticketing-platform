import { NestFactory } from '@nestjs/core';
import { PaymentServiceModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { paymentGrpcOptions } from '@app/grpc';

async function bootstrap() {
  const app = await NestFactory.create(PaymentServiceModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      ...paymentGrpcOptions,
      url: '0.0.0.0:5002',
    },
  });

  await app.startAllMicroservices();

  app.setGlobalPrefix('api');
  await app.listen(process.env.port ?? 3004);
  console.log('Payment Service running on http://localhost:3004');
  console.log('gRPC server on port 5002');
}
bootstrap();
