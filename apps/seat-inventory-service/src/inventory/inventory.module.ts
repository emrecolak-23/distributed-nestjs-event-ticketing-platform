import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeatInventory } from './entities/inventory.entity';
import { InventoryConsumer } from './inventory.consumer';
import { SeatLockService } from './seat-lock.service';
import { CqrsReadModule } from '../cqrs/cqrs-read.module';
@Module({
  imports: [TypeOrmModule.forFeature([SeatInventory]), CqrsReadModule],
  controllers: [InventoryController, InventoryConsumer],
  providers: [InventoryService, SeatLockService],
  exports: [InventoryService, SeatLockService],
})
export class InventoryModule {}
