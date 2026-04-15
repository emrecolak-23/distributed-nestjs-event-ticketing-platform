import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Venue, VenueDocument } from './schemas/venue.schema';
import { CreateVenueDto } from './dtos';

@Injectable()
export class VenueService {
  constructor(
    @InjectModel(Venue.name) private venueModel: Model<VenueDocument>,
  ) {}

  async create(createVenueDto: CreateVenueDto): Promise<VenueDocument> {
    const totalCapacity = createVenueDto.sections.reduce((total, section) => {
      const sectionSeats = section.rows.reduce((total, row) => {
        return total + row.seats.length;
      }, 0);
      return total + sectionSeats;
    }, 0);

    const sections = createVenueDto.sections.map((section, index) => {
      return {
        ...section,
        sortOrder: section.sortOrder ?? index,
        capacity: section.rows.reduce((total, row) => {
          return total + row.seats.length;
        }, 0),
      };
    });

    const venue = new this.venueModel({
      ...createVenueDto,
      totalCapacity,
      sections,
    });

    return venue.save();
  }

  async findAll(): Promise<VenueDocument[]> {
    return this.venueModel.find().exec();
  }

  async findById(id: string): Promise<VenueDocument> {
    const venue = await this.venueModel.findById(id).exec();
    if (!venue) {
      throw new NotFoundException('Venue not found');
    }
    return venue;
  }

  async getLayout(id: string): Promise<VenueDocument> {
    return this.findById(id);
  }
}
