import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { BookingOrchestratorService } from './booking-orchestrator.service';
import { CreateBookingDto } from './dtos/create-booking.dto';
import { CancelBookingDto } from './dtos/cancel-booking.dto';

@Controller('bookings')
export class BookingController {
  constructor(private readonly orchestrator: BookingOrchestratorService) {}

  @Post()
  create(@Body() dto: CreateBookingDto) {
    return this.orchestrator.createBooking(dto);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.orchestrator.findById(id);
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.orchestrator.findByUserId(userId);
  }

  @Delete(':id')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @Query('userId') userId: string,
  ) {
    return this.orchestrator.cancelBooking(
      id,
      userId,
      dto.refundIdempotencyKey,
      dto.reason,
    );
  }
}
