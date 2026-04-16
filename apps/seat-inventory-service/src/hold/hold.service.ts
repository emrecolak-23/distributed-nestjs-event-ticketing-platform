import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource } from 'typeorm';
import { SeatHold } from './entitites/seat-hold.entity';
import { SeatLockReleaseReason } from './enums';
import { InventoryService } from '../inventory/inventory.service';
import { SeatStatus } from '../inventory/enums';
import { SeatLockService } from '../inventory/seat-lock.service';
import { SeatLockInfoResponse } from '../inventory/interfaces';

@Injectable()
export class HoldService {
  private readonly logger = new Logger(HoldService.name);
  private readonly HOLD_DURATION_MS = 10 * 60 * 1000;

  constructor(
    @InjectRepository(SeatHold) private readonly holdRepo: Repository<SeatHold>,
    private readonly seatLockService: SeatLockService,
    private readonly inventoryService: InventoryService,
    private readonly dataSource: DataSource,
  ) {}

  async holdSeats(
    eventId: string,
    seatIds: string[],
    userId: string,
    sessionId: string,
  ): Promise<{ holdIds: string[]; expiresAt: Date }> {
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

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const inventories = await this.inventoryService.findBySeatIds(
        eventId,
        seatIds,
      );

      const unavailable = inventories.filter(
        (inv) => inv.status !== SeatStatus.AVAILABLE,
      );

      if (unavailable.length > 0) {
        throw new BadRequestException(
          `Seats not available: ${unavailable.map((s) => s.seatId).join(', ')}`,
        );
      }

      for (const inv of inventories) {
        inv.status = SeatStatus.HELD;
      }
      await queryRunner.manager.save(inventories);

      const expiresAt = new Date(Date.now() + this.HOLD_DURATION_MS);

      const holds = seatIds.map((seatId) => {
        const inventory = inventories.find((inv) => inv.seatId === seatId);
        if (!inventory) {
          throw new BadRequestException(
            `Seat ${seatId} not found in inventory`,
          );
        }
        return this.holdRepo.create({
          seatInventoryId: inventory.id,
          eventId,
          seatId,
          userId,
          sessionId,
          expiresAt,
        });
      });

      const savedHolds = await queryRunner.manager.save(SeatHold, holds);
      await queryRunner.commitTransaction();

      this.logger.log(
        `Held ${seatIds.length} seats for user ${userId}, expires at ${expiresAt.toISOString()}`,
      );

      return {
        holdIds: savedHolds.map((h) => h.id),
        expiresAt,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await this.seatLockService.releaseSeats(eventId, seatIds, userId);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async releaseSeats(
    eventId: string,
    seatIds: string[],
    userId: string,
    reason: SeatLockReleaseReason,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const holds = await this.holdRepo.find({
        where: { eventId, userId, releasedAt: IsNull() },
      });

      for (const hold of holds) {
        if (seatIds.includes(hold.seatId)) {
          hold.releasedAt = new Date();
          hold.releaseReason = reason;
        }
      }
      await queryRunner.manager.save(SeatHold, holds);

      const inventories = await this.inventoryService.findBySeatIds(
        eventId,
        seatIds,
      );
      for (const inv of inventories) {
        inv.status = SeatStatus.AVAILABLE;
      }
      await queryRunner.manager.save(inventories);

      await queryRunner.commitTransaction();

      await this.seatLockService.releaseSeats(eventId, seatIds, userId);

      this.logger.log(`Released ${seatIds.length} seats, reason: ${reason}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getLockInfo(
    eventId: string,
    seatId: string,
  ): Promise<SeatLockInfoResponse | null> {
    return this.seatLockService.getLockInfo(eventId, seatId);
  }

  async markAsSold(
    eventId: string,
    seatIds: string[],
    userId: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const inventories = await this.inventoryService.findBySeatIds(
        eventId,
        seatIds,
      );

      for (const inv of inventories) {
        inv.status = SeatStatus.SOLD;
      }

      await queryRunner.manager.save(inventories);

      const holds = await this.holdRepo.find({
        where: { eventId, userId, releasedAt: IsNull() },
      });

      for (const hold of holds) {
        if (seatIds.includes(hold.seatId)) {
          hold.releasedAt = new Date();
          hold.releaseReason = SeatLockReleaseReason.PAYMENT_SUCCESS;
        }
      }

      await queryRunner.manager.save(SeatHold, holds);
      await queryRunner.commitTransaction();
      await this.seatLockService.releaseSeats(eventId, seatIds, userId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    this.logger.log(
      `Marked ${seatIds.length} seats as sold for user ${userId}`,
    );
  }
}
