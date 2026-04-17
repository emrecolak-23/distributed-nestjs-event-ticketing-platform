import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PostgresDatabaseModule } from '@app/database';
import { BookingModule } from './booking/booking.module';
import { TicketModule } from './ticket/ticket.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '@app/auth-guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/booking-service/.env', '.env.shared'],
    }),
    PostgresDatabaseModule,
    BookingModule,
    TicketModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class BookingServiceModule {}
