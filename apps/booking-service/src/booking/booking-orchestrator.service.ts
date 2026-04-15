import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { DataSource, Repository } from 'typeorm';
import { CreateBookingDto } from './dtos/create-booking.dto';
import { randomUUID } from 'crypto';
import { BookingStatus } from './enums';
import { BookingItem } from './entities/booking-item.entity';
import { SEAT_INVENTORY_PACKAGE } from '@app/grpc';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { SeatInventoryServiceClient } from '@app/grpc/generated/seat-inventory';

interface SeatInventoryGrpcService {
  getSeatsByEvent(data: { eventId: string }): any;
  getAvailableSeats(data: { eventId: string }): any;
  verifyHold(data: { eventId: string; seatIds: string[]; userId: string }): any;
  holdSeats(data: {
    eventId: string;
    seatIds: string[];
    userId: string;
    sessionId: string;
  }): any;
}

@Injectable()
export class BookingOrchestratorService {
  private readonly logger = new Logger(BookingOrchestratorService.name);
  private readonly BOOKING_EXPIRY_MS = 10 * 60 * 1000;
  private seatInventoryService: SeatInventoryServiceClient;

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    private readonly dataSource: DataSource,
    @Inject(SEAT_INVENTORY_PACKAGE) private readonly grpcClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.seatInventoryService =
      this.grpcClient.getService<SeatInventoryServiceClient>(
        'SeatInventoryService',
      );
  }

  async createBooking(dto: CreateBookingDto) {
    const seatIds = dto.items.map((item) => item.seatId);

    const response = await firstValueFrom(
      this.seatInventoryService.getSeatsByEvent({ eventId: dto.eventId }),
    );

    const selectedSeats = response.seats.filter((s: any) =>
      seatIds.includes(s.seatId),
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

    const { verified } = await firstValueFrom(
      this.seatInventoryService.verifyHold({
        eventId: dto.eventId,
        seatIds,
        userId: dto.userId,
      }),
    );

    if (!verified) {
      throw new BadRequestException(
        'Hold verification failed — seats not held by this user',
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
        if (!seat) {
          throw new BadRequestException(
            `Seat ${item.seatId} not found in inventory`,
          );
        }
        const bookingItem = new BookingItem();
        bookingItem.booking = savedBooking;
        bookingItem.seatInventoryId = seat.id;
        bookingItem.seatId = seat.seatId;
        bookingItem.ticketTypeId = seat.ticketTypeId;
        bookingItem.ticketTypeName = seat.ticketTypeName;
        bookingItem.sectionName = seat.sectionName;
        bookingItem.row = seat.row;
        bookingItem.seatNumber = seat.seatNumber;
        bookingItem.unitPrice = parseFloat(seat.price);
        bookingItem.attendeeName = item.attendeeName ?? null;
        bookingItem.attendeeEmail = item.attendeeEmail ?? null;
        return bookingItem;
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
