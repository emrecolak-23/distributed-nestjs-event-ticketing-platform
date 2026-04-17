import { Controller, Get, Param } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { Public } from '@app/auth-guard';
import { AvailabilityReadService } from '../cqrs/availability-read.service';

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly readService: AvailabilityReadService,
  ) {}

  @Get('events/:eventId/raw')
  @Public()
  findByEventRaw(@Param('eventId') eventId: string) {
    return this.inventoryService.findByEventId(eventId);
  }

  @Get('events/:eventId/available')
  @Public()
  async getAvailability(@Param('eventId') eventId: string) {
    // return this.inventoryService.getAvailability(eventId);
    return this.readService.getAvailableSeatsDetailed(eventId);
  }

  @Get('events/:eventId/available/count')
  getAvailableCount(@Param('eventId') eventId: string) {
    return this.readService.getAvailableCount(eventId);
  }

  @Get('events/:eventId/summary')
  @Public()
  getSummary(@Param('eventId') eventId: string) {
    return this.readService.getEventAvailabilitySummary(eventId);
  }

  @Get('events/:eventId/')
  @Public()
  findByEvent(@Param('eventId') eventId: string) {
    return this.readService.getEventSeatsWithStatus(eventId);
  }
}
