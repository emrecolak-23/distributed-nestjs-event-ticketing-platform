import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { MongoDatabaseModule } from '@app/database';
import { VenueModule } from './venue/venue.module';
import { EventModule } from './event/event.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '@app/auth-guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/event-service/.env', '.env.shared'],
    }),
    MongoDatabaseModule,
    VenueModule,
    EventModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class EventServiceModule {}
