import { Controller, Get } from '@nestjs/common';
import { SeatInventoryServiceService } from './seat-inventory-service.service';

@Controller()
export class SeatInventoryServiceController {
  constructor(private readonly seatInventoryServiceService: SeatInventoryServiceService) {}

  @Get()
  getHello(): string {
    return this.seatInventoryServiceService.getHello();
  }
}
