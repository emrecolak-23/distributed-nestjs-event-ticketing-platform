import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { DataSource, Repository } from 'typeorm';
import { CreateBookingDto } from './dtos/create-booking.dto';
import { randomUUID } from 'crypto';
import { BookingStatus } from './enums';
import { BookingItem } from './entities/booking-item.entity';
import { PAYMENT_PACKAGE, SEAT_INVENTORY_PACKAGE } from '@app/grpc';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { SeatInventoryServiceClient } from '@app/grpc/generated/seat-inventory';
import { PaymentServiceClient } from '@app/grpc/generated/payment';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class BookingOrchestratorService {
  private readonly logger = new Logger(BookingOrchestratorService.name);
  private readonly BOOKING_EXPIRY_MS = 10 * 60 * 1000;
  private seatInventoryService: SeatInventoryServiceClient;
  private paymentService: PaymentServiceClient;

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    private readonly dataSource: DataSource,
    @Inject(SEAT_INVENTORY_PACKAGE) private readonly grpcClient: ClientGrpc,
    @Inject(PAYMENT_PACKAGE) private readonly paymentClient: ClientGrpc,
    @Inject('BOOKING_KAFKA') private readonly kafkaClient: ClientKafka,
  ) {}

  onModuleInit() {
    this.seatInventoryService =
      this.grpcClient.getService<SeatInventoryServiceClient>(
        'SeatInventoryService',
      );

    this.paymentService =
      this.paymentClient.getService<PaymentServiceClient>('PaymentService');

    this.kafkaClient.connect();
    this.logger.log('gRPC services initialized');
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

    const savedBooking = await this.persistBooking(
      dto,
      selectedSeats,
      totalAmount,
    );
    if (!savedBooking) {
      throw new InternalServerErrorException(
        'Booking could not be loaded after persistence',
      );
    }

    try {
      const { payment } = await firstValueFrom(
        this.paymentService.initiatePayment({
          bookingId: savedBooking.id,
          idempotencyKey: dto.paymentIdempotencyKey,
          amount: totalAmount,
          currency: selectedSeats[0].currency,
          method: 'credit_card',
          cardToken: dto.cardToken,
          provider: dto.paymentProvider ?? '',
        }),
      );

      if (!payment) {
        throw new InternalServerErrorException('Payment initiation failed');
      }

      if (payment.status === 'succeeded') {
        await firstValueFrom(
          this.seatInventoryService.markSeatsAsSold({
            eventId: dto.eventId,
            seatIds,
            userId: dto.userId,
          }),
        );
        savedBooking.confirmedAt = new Date();
        savedBooking.status = BookingStatus.CONFIRMED;
        await this.bookingRepo.save(savedBooking);

        const bookingWithItems = await this.bookingRepo.findOne({
          where: { id: savedBooking.id },
          relations: ['items'],
        });

        if (!bookingWithItems) {
          throw new InternalServerErrorException(
            'Booking not found after payment failure',
          );
        }

        this.kafkaClient.emit('booking.confirmed', {
          key: savedBooking.id,
          value: {
            bookingId: savedBooking.id,
            bookingNumber: savedBooking.bookingNumber,
            userId: savedBooking.userId,
            eventId: savedBooking.eventId,
            totalAmount: savedBooking.totalAmount,
            currency: savedBooking.currency,
            status: savedBooking.status,
            items: bookingWithItems.items.map((item) => ({
              seatId: item.seatId,
              sectionName: item.sectionName,
              row: item.row,
              seatNumber: item.seatNumber,
              attendeeName: item.attendeeName,
              attendeeEmail: item.attendeeEmail,
            })),
          },
        });
      } else {
        savedBooking.status = BookingStatus.CANCELLED;
        savedBooking.cancelledAt = new Date();
        savedBooking.cancellationReason =
          payment.failureReason || 'Payment failed';
        await this.bookingRepo.save(savedBooking);
        await firstValueFrom(
          this.seatInventoryService.releaseSeats({
            eventId: dto.eventId,
            seatIds,
            userId: dto.userId,
            reason: 'payment_failed',
          }),
        );

        this.logger.log(`Emitting booking.confirmed for ${savedBooking.id}`);
      }

      this.logger.log(
        `Payment triggered for booking ${savedBooking.bookingNumber}: ${payment.status}`,
      );
    } catch (error) {
      this.logger.error(`Payment failed: ${error.message}`);
      savedBooking.status = BookingStatus.CANCELLED;
      savedBooking.cancelledAt = new Date();
      savedBooking.cancellationReason = `Payment error: ${error.message}`;
      await this.bookingRepo.save(savedBooking);

      const bookingWithItems = await this.bookingRepo.findOne({
        where: { id: savedBooking.id },
        relations: ['items'],
      });

      if (!bookingWithItems) {
        throw new InternalServerErrorException(
          'Booking not found after cancellation',
        );
      }

      this.kafkaClient.emit('booking.cancelled', {
        key: savedBooking.id,
        value: {
          bookingId: savedBooking.id,
          bookingNumber: savedBooking.bookingNumber,
          userId: savedBooking.userId,
          eventId: savedBooking.eventId,
          totalAmount: savedBooking.totalAmount,
          currency: savedBooking.currency,
          status: savedBooking.status,
          items: bookingWithItems.items.map((item) => ({
            seatId: item.seatId,
            sectionName: item.sectionName,
            row: item.row,
            seatNumber: item.seatNumber,
            attendeeName: item.attendeeName,
            attendeeEmail: item.attendeeEmail,
          })),
        },
      });

      throw new BadRequestException(`Payment failed: ${error.message}`);
    }

    return this.bookingRepo.findOne({
      where: { id: savedBooking.id },
      relations: ['items'],
    });
  }

  private async persistBooking(
    dto: CreateBookingDto,
    selectedSeats: any[],
    totalAmount: number,
  ) {
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
