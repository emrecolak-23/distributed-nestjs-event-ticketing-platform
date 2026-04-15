import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeatInventory } from './entities/inventory.entity';
import { InventoryConsumer } from './inventory.consumer';

@Module({
  imports: [TypeOrmModule.forFeature([SeatInventory])],
  controllers: [InventoryController, InventoryConsumer],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
