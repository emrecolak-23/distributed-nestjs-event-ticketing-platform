import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { Ticket } from './entities/ticket.entity';
import { TicketStatus } from './enums';
import { BookingItem } from '../booking/entities/booking-item.entity';
import { randomUUID } from 'crypto';
import * as QRCode from 'qrcode';

@Injectable()
export class TicketService {
  private readonly logger = new Logger(TicketService.name);

  constructor(
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(BookingItem)
    private readonly bookingItemRepo: Repository<BookingItem>,
  ) {}

  async generateTicket(bookingId: string): Promise<Ticket[]> {
    const existing = await this.ticketRepo.find({
      where: { bookingId },
    });

    if (existing.length > 0) {
      this.logger.log(`Ticket already generated for booking ${bookingId}`);
      return existing;
    }

    const bookingItems = await this.bookingItemRepo.find({
      where: { booking: { id: bookingId } },
    });

    if (bookingItems.length === 0) {
      this.logger.warn(`No booking items found for booking ${bookingId}`);
      return [];
    }

    const tickets: Ticket[] = [];

    for (const bookingItem of bookingItems) {
      const ticketCode = this.generateTicketCode();

      const qrPayload = JSON.stringify({
        ticketCode,
        bookingId,
        seatId: bookingItem.seatId,
        row: bookingItem.row,
        seatNumber: bookingItem.seatNumber,
        attendeeName: bookingItem.attendeeName,
      });

      const qrCodeData = await QRCode.toDataURL(qrPayload);

      const ticketData: DeepPartial<Ticket> = {
        bookingId,
        bookingItemId: bookingItem.id,
        ticketCode,
        qrCodeData,
        status: TicketStatus.ACTIVE,
        seatId: bookingItem.seatId,
        sectionName: bookingItem.sectionName,
        row: bookingItem.row,
        seatNumber: bookingItem.seatNumber,
        attendeeName: bookingItem.attendeeName,
        attendeeEmail: bookingItem.attendeeEmail,
      };

      const ticket = this.ticketRepo.create(ticketData);
      tickets.push(ticket);
    }

    this.logger.log(
      `Generating ${tickets.length} tickets for booking ${bookingId}`,
    );

    return this.ticketRepo.save(tickets);
  }

  async findByBooking(bookingId: string): Promise<Ticket[]> {
    return this.ticketRepo.find({
      where: { bookingId },
    });
  }

  async findByCode(ticketCode: string): Promise<Ticket | null> {
    return this.ticketRepo.findOne({
      where: { ticketCode },
    });
  }

  async checkIn(ticketCode: string): Promise<Ticket> {
    const ticket = await this.findByCode(ticketCode);

    if (!ticket) {
      throw new NotFoundException(`Ticket with code ${ticketCode} not found`);
    }

    if (ticket.status === TicketStatus.USED) {
      throw new BadRequestException(
        `Ticket with code ${ticketCode} has already been used`,
      );
    }

    if (ticket.status === TicketStatus.CANCELLED) {
      throw new BadRequestException(
        `Ticket with code ${ticketCode} has been cancelled`,
      );
    }

    ticket.status = TicketStatus.USED;
    ticket.checkedInAt = new Date();
    return this.ticketRepo.save(ticket);
  }

  async cancelByBooking(bookingId: string): Promise<void> {
    await this.ticketRepo.update(
      {
        bookingId,
        status: TicketStatus.ACTIVE,
      },
      {
        status: TicketStatus.CANCELLED,
      },
    );

    this.logger.log(`Cancelled tickets for booking ${bookingId}`);
  }

  private generateTicketCode(): string {
    const prefix = 'TK';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = randomUUID().slice(0, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }
}
