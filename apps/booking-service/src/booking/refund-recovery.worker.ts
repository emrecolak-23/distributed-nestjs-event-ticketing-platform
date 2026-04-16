import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { RefundState } from './enums';
import { BookingOrchestratorService } from './booking-orchestrator.service';

@Injectable()
export class RefundRecoveryWorker implements OnModuleInit {
  private readonly logger = new Logger(RefundRecoveryWorker.name);
  private readonly MAX_RETRIES = 5;
  private isProcessing = false;

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    private readonly orchestrator: BookingOrchestratorService,
  ) {}

  onModuleInit() {
    this.logger.log('Refund recovery worker initialized');
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async recoveryStuckRefunds() {
    if (this.isProcessing) return;

    this.isProcessing = true;

    try {
      const stuckBookings = await this.bookingRepo.find({
        where: {
          refundState: In([
            RefundState.REFUND_INITIATED,
            RefundState.PAYMENT_REFUNDED,
            RefundState.SEATS_RELEASED,
          ]),
        },
        relations: ['items'],
      });

      if (stuckBookings.length === 0) return;

      for (const booking of stuckBookings) {
        if (booking.refundRetryCount >= this.MAX_RETRIES) {
          this.logger.warn(
            `Booking ${booking.bookingNumber} has reached the maximum number of retries`,
          );
          continue;
        }

        try {
          this.logger.log(
            `Recovering stuck refund for booking ${booking.bookingNumber}`,
          );

          await this.orchestrator.processRefundStateMachine(booking);
          this.logger.log(
            `Successfully recovered refund for ${booking.bookingNumber}`,
          );
        } catch (error) {
          this.logger.error(
            `Recovery failed for ${booking.bookingNumber}: ${error.message}`,
          );
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}
