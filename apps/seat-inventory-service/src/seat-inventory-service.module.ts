import { Module } from '@nestjs/common';
import { SeatInventoryServiceController } from './seat-inventory-service.controller';
import { SeatInventoryServiceService } from './seat-inventory-service.service';

@Module({
  imports: [],
  controllers: [SeatInventoryServiceController],
  providers: [SeatInventoryServiceService],
})
export class SeatInventoryServiceModule {}
