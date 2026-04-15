import { Controller, Get, Param } from '@nestjs/common';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('events/:eventId/available')
  async getAvailability(@Param('eventId') eventId: string) {
    return this.inventoryService.getAvailability(eventId);
  }

  @Get('events/:eventId')
  findByEvent(@Param('eventId') eventId: string) {
    return this.inventoryService.findByEventId(eventId);
  }
}
