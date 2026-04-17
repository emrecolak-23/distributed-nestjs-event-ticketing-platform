import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { EventService } from './event.service';
import { CreateEventDto } from './dto';
import { Public, Roles, RolesGuard } from '@app/auth-guard';

@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'organizer')
  create(@Body() createEventDto: CreateEventDto) {
    return this.eventService.create(createEventDto);
  }

  @Get()
  @Public()
  findAll() {
    return this.eventService.findAll();
  }

  @Get(':id')
  @Public()
  findById(@Param('id') id: string) {
    return this.eventService.findById(id);
  }
}
