import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseInterceptors,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { IdempotencyInterceptor } from './idempotency/idempotency.interceptor';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  initiate(@Body() dto: InitiatePaymentDto) {
    return this.paymentService.initiatePayment(dto);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.paymentService.findById(id);
  }

  @Get('booking/:bookingId')
  findByBookingId(@Param('bookingId') bookingId: string) {
    return this.paymentService.findByBookingId(bookingId);
  }
}
