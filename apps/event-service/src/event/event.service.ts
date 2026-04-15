import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClientKafka } from '@nestjs/microservices';
import { EventDocument } from './schema/event.schema';
import { VenueService } from '../venue/venue.service';
import { CreateEventDto } from './dto';
import { EventCreateMessage, EventSeat } from './interfaces';

@Injectable()
export class EventService {
  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    private readonly venueService: VenueService,
    @Inject('EVENT_SERVICE_KAFKA') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    await this.kafkaClient.connect();
  }

  async create(createEventDto: CreateEventDto): Promise<EventDocument> {
    const venue = await this.venueService.findById(createEventDto.venueId);

    if (!venue) {
      throw new NotFoundException('Venue not found');
    }

    const venueSectionIds = venue.sections.map((section) =>
      section._id.toString(),
    );

    for (const ticketType of createEventDto.ticketTypes) {
      if (!venueSectionIds.includes(ticketType.sectionId)) {
        throw new NotFoundException(
          `Section ${ticketType.sectionId} not found in venue ${venue.name}`,
        );
      }
    }

    const event = new this.eventModel(createEventDto);
    const savedEvent = await event.save();

    const seats: EventSeat[] = [];
    for (const section of venue.sections) {
      const ticketType = savedEvent.ticketTypes.find(
        (ticket) => ticket.sectionId === section._id.toString(),
      );
      if (!ticketType) continue;

      for (const row of section.rows) {
        for (const seat of row.seats) {
          seats.push({
            seatId: `${section._id}_${row.label}_${seat.number}`,
            sectionId: section._id.toString(),
            sectionName: section.name,
            ticketTypeId: ticketType._id.toString(),
            ticketTypeName: ticketType.name,
            price: ticketType.price,
            currency: ticketType.currency,
            row: row.label,
            number: seat.number,
            type: seat.type,
          });
        }
      }
    }

    this.kafkaClient.emit('event.create', {
      key: savedEvent._id.toString(),
      value: {
        eventId: savedEvent._id.toString(),
        venueId: venue._id.toString(),
        venueName: venue.name,
        title: savedEvent.title,
        startsAt: savedEvent.startsAt,
        seats,
      } as EventCreateMessage,
    });
    return savedEvent;
  }

  async findAll(): Promise<EventDocument[]> {
    return this.eventModel.find().exec();
  }

  async findById(id: string): Promise<EventDocument> {
    const event = await this.eventModel.findById(id).exec();
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }
}
