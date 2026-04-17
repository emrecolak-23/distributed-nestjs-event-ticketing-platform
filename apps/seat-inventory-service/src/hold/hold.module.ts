import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryModule } from '../inventory/inventory.module';
import { ScheduleModule } from '@nestjs/schedule';
import { HoldController } from './hold.controller';
import { HoldService } from './hold.service';
import { SeatHold } from './entitites/seat-hold.entity';
import { HoldExpiryWorker } from './hold-expiry.worker';
import { CqrsReadModule } from '../cqrs/cqrs-read.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SeatHold]),
    InventoryModule,
    ScheduleModule.forRoot(),
    CqrsReadModule,
  ],
  controllers: [HoldController],
  providers: [HoldService, HoldExpiryWorker],
  exports: [HoldService],
})
export class HoldModule {}
