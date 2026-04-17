import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { type ClientGrpc, ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Outbox } from './entities/outbox.entity';
import { OutboxStatus } from './enums';
import { SeatInventoryServiceClient } from '@app/grpc/generated/seat-inventory';
import { SEAT_INVENTORY_PACKAGE } from '@app/grpc';
import { TicketService } from '../ticket/ticket.service';

@Injectable()
export class OutboxWorker implements OnModuleInit {
  private readonly logger = new Logger(OutboxWorker.name);
  private seatInventoryService: SeatInventoryServiceClient;

  constructor(
    @InjectRepository(Outbox) private readonly outboxRepo: Repository<Outbox>,
    @Inject(SEAT_INVENTORY_PACKAGE) private readonly grpcClient: ClientGrpc,
    @Inject('BOOKING_KAFKA') private readonly kafkaClient: ClientKafka,
    private readonly ticketService: TicketService,
  ) {}

  onModuleInit() {
    this.seatInventoryService =
      this.grpcClient.getService<SeatInventoryServiceClient>(
        'SeatInventoryService',
      );
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async processOutbox() {
    const pendingEntries = await this.outboxRepo.find({
      where: { status: OutboxStatus.PENDING },
      order: { createdAt: 'ASC' },
      take: 10,
    });

    if (pendingEntries.length === 0) return;

    this.logger.log(
      `Processing ${pendingEntries.length} pending outbox entries`,
    );

    for (const entry of pendingEntries) {
      entry.status = OutboxStatus.PROCESSING;
      await this.outboxRepo.save(entry);

      try {
        await this.processEntry(entry);
        entry.status = OutboxStatus.COMPLETED;
        entry.processedAt = new Date();
        await this.outboxRepo.save(entry);
      } catch (error) {
        entry.retryCount += 1;
        entry.lastError = error.message;

        if (entry.retryCount >= entry.maxRetries) {
          entry.status = OutboxStatus.FAILED;
          this.logger.error(
            `Outbox entry ${entry.id} failed after ${entry.maxRetries} retries: ${error.message}`,
          );
        } else {
          entry.status = OutboxStatus.PENDING;
          this.logger.warn(
            `Outbox entry ${entry.id} will be retried: ${error.message}`,
          );
        }

        await this.outboxRepo.save(entry);
      }
    }
  }

  private async processEntry(entry: Outbox) {
    switch (entry.eventType) {
      case 'seats.mark_sold':
        await this.handleSeatsSold(entry);
        break;
      case 'booking.confirmed':
        await this.handleBookingConfirmed(entry);
        break;
      case 'booking.refunded':
        await this.handleBookingRefunded(entry);
        break;
      default:
        this.logger.warn(`Unknown event type: ${entry.eventType}`);
        break;
    }
  }

  private async handleSeatsSold(entry: Outbox) {
    const { eventId, userId, seatIds } = entry.payload;

    const { success } = await firstValueFrom(
      this.seatInventoryService.markSeatsAsSold({
        eventId,
        seatIds,
        userId,
      }),
    );

    if (!success) {
      throw new Error('markSeatsAsSold gRPC call failed');
    }

    this.logger.log(`Outbox: Marked ${seatIds.length} seats as sold`);
  }

  private async handleBookingConfirmed(entry: Outbox) {
    await this.ticketService.generateTicket(entry.aggregateId);
    this.kafkaClient.emit('booking.confirmed', {
      key: entry.aggregateId,
      value: entry.payload,
    });

    this.logger.log(
      `Outbox: Emitted booking.confirmed for ${entry.aggregateId}`,
    );
  }

  private async handleBookingRefunded(entry: Outbox) {
    this.kafkaClient.emit('booking.refunded', {
      key: entry.aggregateId,
      value: entry.payload,
    });

    this.logger.log(
      `Outbox: Emitted booking.refunded for ${entry.aggregateId}`,
    );
  }
}
