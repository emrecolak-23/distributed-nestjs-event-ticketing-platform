import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

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

  await app.startAllMicroservices();

  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3002);
  console.log('Seat Inventory Service running on http://localhost:3002');
  console.log('Kafka consumer listening for events...');
}
bootstrap();
