import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { DataSource, Repository } from 'typeorm';
import { CreateBookingDto } from './dtos/create-booking.dto';
import { randomUUID } from 'crypto';
import { BookingStatus } from './enums';
import { BookingItem } from './entities/booking-item.entity';

@Injectable()
export class BookingOrchestratorService {
  private readonly logger = new Logger(BookingOrchestratorService.name);
  private readonly BOOKING_EXPIRY_MS = 10 * 60 * 1000;

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    private readonly dataSource: DataSource,
  ) {}

  async createBooking(dto: CreateBookingDto) {
    const seatIds = dto.items.map((item) => item.seatId);

    const inventoryResponse = await fetch(
      `http://localhost:3002/api/inventory/events/${dto.eventId}`,
    );

    if (!inventoryResponse.ok) {
      throw new BadRequestException('Failed to fetch seat inventory');
    }

    const allInventory = await inventoryResponse.json();
    const selectedSeats = allInventory.filter((seat: any) =>
      seatIds.includes(seat.seatId),
    );

    if (selectedSeats.length !== seatIds.length) {
      const found = selectedSeats.map((seat: any) => seat.seatId);
      const missing = seatIds.filter((id) => !found.includes(id));
      throw new BadRequestException(
        `Seats ${missing.join(', ')} not found in inventory`,
      );
    }

    const notHeld = selectedSeats.filter((seat: any) => seat.status !== 'held');

    if (notHeld.length > 0) {
      throw new BadRequestException(
        `Seats ${notHeld.map((seat: any) => seat.seatId).join(', ')} are not held`,
      );
    }

    const verifyHoldResponse = await fetch(
      `
        http://localhost:3002/api/hold/verify
        `,
      {
        method: 'POST',
        body: JSON.stringify({
          eventId: dto.eventId,
          seatIds,
          userId: dto.userId,
        }),
      },
    );

    if (!verifyHoldResponse.ok) {
      const error = await verifyHoldResponse.json();
      throw new BadRequestException(
        error.message || 'Hold verification failed',
      );
    }

    const totalAmount = selectedSeats.reduce(
      (acc, seat) => acc + parseFloat(seat.price),
      0,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const bookingNumber = this.generateBookingNumber();

      const booking = this.bookingRepo.create({
        bookingNumber,
        userId: dto.userId,
        eventId: dto.eventId,
        totalAmount,
        currency: selectedSeats[0].currency,
        expiresAt: new Date(Date.now() + this.BOOKING_EXPIRY_MS),
        status: BookingStatus.PENDING,
      });

      const savedBooking = await queryRunner.manager.save(booking);

      const bookingItems = dto.items.map((item) => {
        const seat = selectedSeats.find((s) => s.seatId === item.seatId);
        return {
          bookingId: savedBooking.id,
          seatInventoryId: seat.id,
          seatId: seat.seatId,
          ticketTypeId: seat.ticketTypeId,
          ticketTypeName: seat.ticketTypeName,
          sectionName: seat.sectionName,
          row: seat.row,
          seatNumber: seat.seatNumber,
          unitPrice: seat.price,
          attendeeName: item.attendeeName,
          attendeeEmail: item.attendeeEmail,
        };
      });

      await queryRunner.manager.save(BookingItem, bookingItems);
      await queryRunner.commitTransaction();

      this.logger.log(
        `Booking ${bookingNumber} created for user ${dto.userId}, total: ${totalAmount} ${booking.currency}`,
      );

      return this.bookingRepo.findOne({
        where: { id: savedBooking.id },
        relations: ['items'],
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findById(id: string): Promise<Booking> {
    const booking = await this.bookingRepo.findOne({
      where: { id },
      relations: ['items'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async findByUserId(userId: string): Promise<Booking[]> {
    return this.bookingRepo.find({
      where: { userId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  private generateBookingNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = randomUUID().slice(0, 4).toUpperCase();
    return `BK-${timestamp}-${random}`;
  }
}
