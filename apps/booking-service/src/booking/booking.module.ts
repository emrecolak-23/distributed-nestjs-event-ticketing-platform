import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { BookingItem } from './entities/booking-item.entity';
import { BookingController } from './booking.controller';
import { BookingOrchestratorService } from './booking-orchestrator.service';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, BookingItem])],
  controllers: [BookingController],
  providers: [BookingOrchestratorService],
  exports: [BookingOrchestratorService],
})
export class BookingModule {}
