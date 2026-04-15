import { NestFactory } from '@nestjs/core';
import { SeatInventoryServiceModule } from './seat-inventory-service.module';

async function bootstrap() {
  const app = await NestFactory.create(SeatInventoryServiceModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
