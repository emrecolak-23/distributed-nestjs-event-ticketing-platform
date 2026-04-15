import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryModule } from '../inventory/inventory.module';
import { HoldController } from './hold.controller';
import { HoldService } from './hold.service';
import { SeatHold } from './entitites/seat-hold.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SeatHold]), InventoryModule],
  controllers: [HoldController],
  providers: [HoldService],
  exports: [HoldService],
})
export class HoldModule {}
