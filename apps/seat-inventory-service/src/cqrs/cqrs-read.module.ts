import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeatInventory } from '../inventory/entities/inventory.entity';
import { AvailabilityReadService } from './availability-read.service';

@Module({
  imports: [TypeOrmModule.forFeature([SeatInventory])],
  providers: [AvailabilityReadService],
  exports: [AvailabilityReadService],
})
export class CqrsReadModule {}
