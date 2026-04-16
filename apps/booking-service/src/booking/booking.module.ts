import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Booking } from './entities/booking.entity';
import { BookingItem } from './entities/booking-item.entity';
import { BookingController } from './booking.controller';
import { BookingOrchestratorService } from './booking-orchestrator.service';
import { KafkaClientModule } from '@app/kafka';
import {
  PAYMENT_PACKAGE,
  paymentGrpcOptions,
  SEAT_INVENTORY_PACKAGE,
  seatInventoryGrpcOptions,
} from '@app/grpc';
import { Outbox } from './entities/outbox.entity';
import { OutboxWorker } from './outbox.worker';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, BookingItem, Outbox]),
    KafkaClientModule.register('BOOKING_KAFKA'),
    ClientsModule.register([
      {
        name: SEAT_INVENTORY_PACKAGE,
        transport: Transport.GRPC,
        options: {
          ...seatInventoryGrpcOptions,
          url: process.env.SEAT_INVENTORY_GRPC_URL || 'localhost:5001',
        },
      },
      {
        name: PAYMENT_PACKAGE,
        transport: Transport.GRPC,
        options: {
          ...paymentGrpcOptions,
          url: process.env.PAYMENT_GRPC_URL || 'localhost:5002',
        },
      },
    ]),
    ScheduleModule.forRoot(),
  ],
  controllers: [BookingController],
  providers: [BookingOrchestratorService, OutboxWorker],
  exports: [BookingOrchestratorService],
})
export class BookingModule {}
