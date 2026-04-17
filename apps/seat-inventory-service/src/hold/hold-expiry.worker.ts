import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThan } from 'typeorm';
import { SeatHold } from './entitites/seat-hold.entity';
import { HoldService } from './hold.service';
import { SeatLockReleaseReason } from './enums';

@Injectable()
export class HoldExpiryWorker {
  private readonly logger = new Logger(HoldExpiryWorker.name);
  private isProcessing = false;

  constructor(
    @InjectRepository(SeatHold) private readonly holdRepo: Repository<SeatHold>,
    private readonly holdService: HoldService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processExpiredHolds() {
    this.logger.debug('Processing expired holds');
    if (this.isProcessing) return;

    this.isProcessing = true;

    try {
      const now = new Date();

      const expiredHolds = await this.holdRepo.find({
        where: {
          expiresAt: LessThan(now),
          releasedAt: IsNull(),
        },
      });

      if (expiredHolds.length === 0) return;

      const grouped = new Map<string, SeatHold[]>();

      for (const hold of expiredHolds) {
        const key = `${hold.eventId}:${hold.userId}`;
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }

        grouped.get(key)!.push(hold);
      }

      for (const [key, holds] of grouped) {
        const eventId = holds[0].eventId;
        const userId = holds[0].userId;
        const seatIds = holds.map((hold) => hold.seatId);

        try {
          await this.holdService.releaseSeats(
            eventId,
            seatIds,
            userId,
            SeatLockReleaseReason.TIMEOUT,
          );

          this.logger.log(
            `Expired: Released ${seatIds.length} seats for user ${userId} in event ${eventId}`,
          );
        } catch (error) {
          this.logger.error(
            `Error releasing seats: ${error.message}`,
            error.stack,
          );
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}
