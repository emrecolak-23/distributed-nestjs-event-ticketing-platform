import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { MongoDatabaseModule } from '@app/database';
import { VenueModule } from './venue/venue.module';
import { EventModule } from './event/event.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'apps/event-service/.env',
    }),
    MongoDatabaseModule,
    VenueModule,
    EventModule,
  ],
})
export class EventServiceModule {}
