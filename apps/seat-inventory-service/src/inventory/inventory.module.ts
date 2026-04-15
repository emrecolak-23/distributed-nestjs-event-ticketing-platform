import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeatInventory } from './entities/inventory.entity';
import { InventoryConsumer } from './inventory.consumer';
import { InventoryGrpcController } from './inventory.grpc-controller';
import { SeatLockService } from './seat-lock.service';

@Module({
  imports: [TypeOrmModule.forFeature([SeatInventory])],
  controllers: [InventoryController, InventoryConsumer],
  providers: [InventoryService, SeatLockService],
  exports: [InventoryService, SeatLockService],
})
export class InventoryModule {}
