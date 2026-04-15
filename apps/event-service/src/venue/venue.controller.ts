import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { VenueService } from './venue.service';
import { CreateVenueDto } from './dtos';

@Controller('venues')
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  @Post()
  create(@Body() dto: CreateVenueDto) {
    return this.venueService.create(dto);
  }

  @Get()
  async findAll() {
    return this.venueService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.venueService.findById(id);
  }

  @Get(':id/layout')
  getLayout(@Param('id') id: string) {
    return this.venueService.getLayout(id);
  }
}
