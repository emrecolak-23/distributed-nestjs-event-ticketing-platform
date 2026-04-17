import { Controller, Get, Param } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { Public } from '@app/auth-guard';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('events/:eventId/available')
  @Public()
  async getAvailability(@Param('eventId') eventId: string) {
    return this.inventoryService.getAvailability(eventId);
  }

  @Get('events/:eventId')
  @Public()
  findByEvent(@Param('eventId') eventId: string) {
    return this.inventoryService.findByEventId(eventId);
  }
}
