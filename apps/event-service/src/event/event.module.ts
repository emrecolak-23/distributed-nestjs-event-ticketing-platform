import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VenueModule } from '../venue/venue.module';
import { EventService } from './event.service';
import { Event, EventSchema } from './schema/event.schema';
import { EventController } from './event.controller';
import { KafkaClientModule } from '@app/kafka';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Event.name, schema: EventSchema }]),
    VenueModule,
    KafkaClientModule.register('EVENT_SERVICE_KAFKA'),
  ],
  controllers: [EventController],
  providers: [EventService],
  exports: [EventService],
})
export class EventModule {}
