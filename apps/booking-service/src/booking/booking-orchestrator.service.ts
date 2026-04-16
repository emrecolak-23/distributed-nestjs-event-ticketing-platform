import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  Inject,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { DataSource, Repository } from 'typeorm';
import { CreateBookingDto } from './dtos/create-booking.dto';
import { randomUUID } from 'crypto';
import { BookingStatus, OutboxStatus, RefundState } from './enums';
import { BookingItem } from './entities/booking-item.entity';
import { PAYMENT_PACKAGE, SEAT_INVENTORY_PACKAGE } from '@app/grpc';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { SeatInventoryServiceClient } from '@app/grpc/generated/seat-inventory';
import { PaymentServiceClient } from '@app/grpc/generated/payment';
import { ClientKafka } from '@nestjs/microservices';
import { Outbox } from './entities/outbox.entity';

@Injectable()
export class BookingOrchestratorService {
  private readonly logger = new Logger(BookingOrchestratorService.name);
  private readonly BOOKING_EXPIRY_MS = 10 * 60 * 1000;
  private seatInventoryService: SeatInventoryServiceClient;
  private paymentService: PaymentServiceClient;

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Outbox) private readonly outboxRepo: Repository<Outbox>,
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
        await this.confirmBookingWithOutbox(
          savedBooking,
          dto.eventId,
          dto.userId,
          seatIds,
        );
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

  async cancelBooking(
    bookingId: string,
    userId: string,
    refundItempotencyKey: string,
    reason?: string,
  ) {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['items'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.userId !== userId) {
      throw new BadRequestException(
        'You are not allowed to cancel this booking',
      );
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Booking is not confirmed and cannot be cancelled',
      );
    }

    if (!booking.refundState) {
      booking.refundState = RefundState.REFUND_INITIATED;
      booking.refundIdempotencyKey = refundItempotencyKey;
      booking.cancellationReason = reason || 'User cancellation';
      await this.bookingRepo.save(booking);
    }

    await this.processRefundStateMachine(booking);

    this.logger.log(`Booking ${booking.bookingNumber} refunded`);

    return booking;
  }

  private async processRefundStateMachine(booking: Booking): Promise<Booking> {
    const seatIds = booking.items.map((item) => item.seatId);
    const maxSteps = 5;

    for (let step = 0; step < maxSteps; step++) {
      this.logger.log(
        `Refund state machine [${booking.bookingNumber}]: ${booking.refundState}`,
      );

      try {
        switch (booking.refundState) {
          case RefundState.REFUND_INITIATED: {
            const { success, failureReason } = await firstValueFrom(
              this.paymentService.refundPayment({
                bookingId: booking.id,
                idempotencyKey: booking.refundIdempotencyKey!,
                reason: booking.cancellationReason || 'User cancellation',
              }),
            );

            if (!success) {
              booking.refundState = RefundState.FAILED;
              booking.refundLastError = failureReason;
              await this.bookingRepo.save(booking);
              throw new BadRequestException(`Refund failed: ${failureReason}`);
            }

            booking.refundState = RefundState.PAYMENT_REFUNDED;
            await this.bookingRepo.save(booking);
            break;
          }
          case RefundState.PAYMENT_REFUNDED: {
            await firstValueFrom(
              this.seatInventoryService.releaseSoldSeats({
                eventId: booking.eventId,
                seatIds,
              }),
            );

            booking.refundState = RefundState.SEATS_RELEASED;
            await this.bookingRepo.save(booking);
            break;
          }
          case RefundState.SEATS_RELEASED: {
            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();

            try {
              booking.status = BookingStatus.REFUNDED;
              booking.cancelledAt = new Date();
              booking.refundState = RefundState.COMPLETED;
              await queryRunner.manager.save(Booking, booking);

              const refundedOutbox = this.outboxRepo.create({
                aggregateType: 'booking',
                aggregateId: booking.id,
                eventType: 'booking.refunded',
                payload: {
                  bookingId: booking.id,
                  bookingNumber: booking.bookingNumber,
                  userId: booking.userId,
                  eventId: booking.eventId,
                  totalAmount: booking.totalAmount,
                  currency: booking.currency,
                  items: booking.items.map((item) => ({
                    sectionName: item.sectionName,
                    row: item.row,
                    seatNumber: item.seatNumber,
                    attendeeName: item.attendeeName,
                    attendeeEmail: item.attendeeEmail,
                  })),
                },
                status: OutboxStatus.PENDING,
              });

              await queryRunner.manager.save(Outbox, refundedOutbox);
              await queryRunner.commitTransaction();
            } catch (error) {
              await queryRunner.rollbackTransaction();
              throw error;
            } finally {
              await queryRunner.release();
            }
            this.logger.log(
              `Booking ${booking.bookingNumber} refund completed`,
            );

            return booking;
          }
          case RefundState.COMPLETED: {
            return booking;
          }
          case RefundState.FAILED: {
            throw new BadRequestException(
              `Refund failed: ${booking.refundLastError}`,
            );
          }
          default: {
            throw new BadRequestException(
              `Invalid refund state: ${booking.refundState}`,
            );
          }
        }
      } catch (error) {
        booking.refundRetryCount++;
        booking.refundLastError = error.message;
        await this.bookingRepo.save(booking);
        throw error;
      }
    }

    return booking;
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

  private async confirmBookingWithOutbox(
    booking: Booking,
    eventId: string,
    userId: string,
    seatIds: string[],
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      booking.status = BookingStatus.CONFIRMED;
      booking.confirmedAt = new Date();

      await queryRunner.manager.save(booking);

      const seatsSoldOutbox = this.outboxRepo.create({
        aggregateType: 'booking',
        aggregateId: booking.id,
        eventType: 'seats.mark_sold',
        payload: {
          eventId,
          userId,
          seatIds,
        },
        status: OutboxStatus.PENDING,
      });

      const bookingWithItems = await this.bookingRepo.findOne({
        where: { id: booking.id },
        relations: ['items'],
      });

      if (!bookingWithItems) {
        throw new InternalServerErrorException(
          'Booking not found after confirmation',
        );
      }

      const confirmedOutbox = this.outboxRepo.create({
        aggregateType: 'booking',
        aggregateId: booking.id,
        eventType: 'booking.confirmed',
        payload: {
          bookingId: booking.id,
          bookingNumber: booking.bookingNumber,
          userId: booking.userId,
          eventId,
          totalAmount: booking.totalAmount,
          currency: booking.currency,
          items: bookingWithItems.items.map((item) => ({
            seatId: item.seatId,
            sectionName: item.sectionName,
            row: item.row,
            seatNumber: item.seatNumber,
            attendeeName: item.attendeeName,
            attendeeEmail: item.attendeeEmail,
          })),
        },
        status: OutboxStatus.PENDING,
      });

      await queryRunner.manager.save(Outbox, seatsSoldOutbox);
      await queryRunner.manager.save(Outbox, confirmedOutbox);
      await queryRunner.commitTransaction();

      this.logger.log(
        `Booking ${booking.bookingNumber} confirmed with outbox entries`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
