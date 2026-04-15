import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { SeatHold } from './entitites/seat-hold.entity';
import { SeatLockReleaseReason } from './enums';
import { InventoryService } from '../inventory/inventory.service';
import { SeatStatus } from '../inventory/enums';
import { SeatLockService } from '../inventory/seat-lock.service';

@Injectable()
export class HoldService {
  private readonly logger = new Logger(HoldService.name);
  private readonly HOLD_DURATION_MS = 10 * 60 * 1000; // 10 minutes

  constructor(
    @InjectRepository(SeatHold) private readonly holdRepo: Repository<SeatHold>,
    private readonly seatLockService: SeatLockService,
    private readonly inventoryService: InventoryService,
  ) {}

  async holdSeats(
    eventId: string,
    seatIds: string[],
    userId: string,
    sessionId: string,
  ): Promise<{
    holdIds: string[];
    expiresAt: Date;
  }> {
    const lockResult = await this.seatLockService.lockSeats(
      eventId,
      seatIds,
      userId,
      sessionId,
    );

    if (!lockResult.success) {
      throw new BadRequestException(
        `Seats already held: ${lockResult.failedSeatIds.join(', ')}`,
      );
    }

    try {
      const inventories = await this.inventoryService.findBySeatIds(
        eventId,
        seatIds,
      );

      const unavailable = inventories.filter(
        (inv) => inv.status !== SeatStatus.AVAILABLE,
      );

      if (unavailable.length > 0) {
        await this.seatLockService.releaseSeats(
          eventId,
          unavailable.map((inv) => inv.seatId),
          userId,
        );

        throw new BadRequestException(
          `Seats not available: ${unavailable.map((s) => s.seatId).join(', ')}`,
        );
      }

      await this.inventoryService.updateStatus(
        eventId,
        seatIds,
        SeatStatus.HELD,
      );

      const expiresAt = new Date(Date.now() + this.HOLD_DURATION_MS);

      const holds = seatIds.map((seatId) => {
        const inventory = inventories.find((inv) => inv.seatId === seatId);
        if (!inventory) {
          throw new BadRequestException(
            `Seat ${seatId} not found in inventory`,
          );
        }
        return this.holdRepo.create({
          seatInventoryId: inventory!.id,
          eventId,
          seatId,
          userId,
          sessionId,
          expiresAt,
        });
      });

      const savedHolds = await this.holdRepo.save(holds);

      this.logger.log(
        `Held ${seatIds.length} seats for user ${userId}, expires at ${expiresAt.toISOString()}`,
      );

      return {
        holdIds: savedHolds.map((h) => h.id),
        expiresAt,
      };
    } catch (error) {
      await this.seatLockService.releaseSeats(eventId, seatIds, userId);
      throw error;
    }
  }

  async releaseSeats(
    eventId: string,
    seatIds: string[],
    userId: string,
    reason: SeatLockReleaseReason,
  ): Promise<void> {
    await this.seatLockService.releaseSeats(eventId, seatIds, userId);

    await this.inventoryService.updateStatus(
      eventId,
      seatIds,
      SeatStatus.AVAILABLE,
    );

    const holds = await this.holdRepo.find({
      where: {
        eventId,
        userId,
        releasedAt: IsNull(),
      },
    });

    for (const hold of holds) {
      if (seatIds.includes(hold.seatId)) {
        hold.releasedAt = new Date();
        hold.releaseReason = reason;
      }
    }

    await this.holdRepo.save(holds);
    this.logger.log(
      `Released ${seatIds.length} seats for user ${userId}, reason ${reason}`,
    );
  }
}
