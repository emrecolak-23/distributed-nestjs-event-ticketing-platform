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
import { CurrentUser } from '@app/auth-guard';

@Controller('bookings')
export class BookingController {
  constructor(private readonly orchestrator: BookingOrchestratorService) {}

  @Post()
  create(@Body() dto: CreateBookingDto, @CurrentUser('id') userId: string) {
    dto.userId = userId;
    return this.orchestrator.createBooking(dto);
  }

  @Get('me')
  findMyBookings(@CurrentUser('id') userId: string) {
    return this.orchestrator.findByUserId(userId);
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
    @CurrentUser('id') userId: string,
  ) {
    return this.orchestrator.cancelBooking(
      id,
      userId,
      dto.refundIdempotencyKey,
      dto.reason,
    );
  }
}
