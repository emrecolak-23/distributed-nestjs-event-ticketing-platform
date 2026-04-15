import { NestFactory } from '@nestjs/core';
import { BookingServiceModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(BookingServiceModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
