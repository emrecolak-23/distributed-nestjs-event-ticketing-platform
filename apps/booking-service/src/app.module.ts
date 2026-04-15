import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PostgresDatabaseModule } from '@app/database';
import { BookingModule } from './booking/booking.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'apps/booking-service/.env',
    }),
    PostgresDatabaseModule,
    BookingModule,
  ],
  controllers: [],
  providers: [],
})
export class BookingServiceModule {}
