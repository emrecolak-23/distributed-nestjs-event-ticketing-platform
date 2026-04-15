import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { seatInventoryGrpcOptions } from '@app/grpc';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'seat-inventory',
        brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
      },
      consumer: {
        groupId: 'seat-inventory-consumer',
      },
    },
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      ...seatInventoryGrpcOptions,
      url: process.env.GRPC_URL || 'localhost:5001',
    },
  });

  await app.startAllMicroservices();

  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3002);
  console.log('Seat Inventory Service running on http://localhost:3002');
  console.log('gRPC server on port 5001');
  console.log('Kafka consumer listening for events...');
}
bootstrap();
