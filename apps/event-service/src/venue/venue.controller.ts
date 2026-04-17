import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { VenueService } from './venue.service';
import { CreateVenueDto } from './dtos';
import { Public, RolesGuard, Roles } from '@app/auth-guard';

@Controller('venues')
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'organizer')
  create(@Body() dto: CreateVenueDto) {
    return this.venueService.create(dto);
  }

  @Get()
  @Public()
  async findAll() {
    return this.venueService.findAll();
  }

  @Get(':id')
  @Public()
  findById(@Param('id') id: string) {
    return this.venueService.findById(id);
  }

  @Get(':id/layout')
  @Public()
  getLayout(@Param('id') id: string) {
    return this.venueService.getLayout(id);
  }
}
