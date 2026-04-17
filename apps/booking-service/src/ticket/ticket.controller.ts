import { Controller, Get, Param, Post } from '@nestjs/common';
import { TicketService } from './ticket.service';

@Controller('tickets')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Get('booking/:bookingId')
  findByBooking(@Param('bookingId') bookingId: string) {
    return this.ticketService.findByBooking(bookingId);
  }

  @Get('code/:ticketCode')
  findByCode(@Param('ticketCode') ticketCode: string) {
    return this.ticketService.findByCode(ticketCode);
  }

  @Post('check-in/:ticketCode')
  checkIn(@Param('ticketCode') ticketCode: string) {
    return this.ticketService.checkIn(ticketCode);
  }
}
