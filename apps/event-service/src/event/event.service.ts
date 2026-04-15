import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventDocument } from './schema/event.schema';
import { VenueService } from '../venue/venue.service';
import { CreateEventDto } from './dto';

@Injectable()
export class EventService {
  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    private readonly venueService: VenueService,
  ) {}

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
    return event.save();
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
