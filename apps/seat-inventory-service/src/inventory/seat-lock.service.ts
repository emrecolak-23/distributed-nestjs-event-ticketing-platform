import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@app/redis';

@Injectable()
export class SeatLockService {
  private readonly logger = new Logger(SeatLockService.name);
  private readonly LOCK_TTL = 600;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async lockSeats(
    eventId: string,
    seatIds: string[],
    userId: string,
    sessionId: string,
  ): Promise<{
    success: boolean;
    failedSeatIds: string[];
  }> {
    const failedSeatIds: string[] = [];
    const lockedKeys: string[] = [];

    for (const seatId of seatIds) {
      const key = `lock:event:${eventId}:seat:${seatId}`;
      const value = JSON.stringify({
        userId,
        sessionId,
        lockedAt: Date.now(),
      });

      const result = await this.redis.set(
        key,
        value,
        'EX',
        this.LOCK_TTL,
        'NX',
      );

      if (result === 'OK') {
        lockedKeys.push(key);
      } else {
        failedSeatIds.push(seatId);
      }
    }

    if (failedSeatIds.length > 0) {
      for (const key of lockedKeys) {
        await this.redis.del(key);
      }

      this.logger.warn(`Failed to lock seats: ${failedSeatIds.join(', ')}`);
      return {
        success: false,
        failedSeatIds,
      };
    }

    this.logger.log(`Successfully locked seats: ${lockedKeys.join(', ')}`);
    return {
      success: true,
      failedSeatIds: [],
    };
  }

  async releaseSeats(
    eventId: string,
    seatIds: string[],
    userId: string,
  ): Promise<number> {
    let released = 0;

    for (const seatId of seatIds) {
      const key = `lock:event:${eventId}:seat:${seatId}`;
      const data = await this.redis.get(key);

      if (!data) continue;

      const lockData = JSON.parse(data);

      if (lockData.userId !== userId) continue;

      await this.redis.del(key);
      released++;
    }

    this.logger.log(
      `Released ${released} seats for user ${userId} in event ${eventId}`,
    );
    return released;
  }

  async getLockInfo(
    eventId: string,
    seatId: string,
  ): Promise<{
    userId: string;
    sessionId: string;
    lockedAt: number;
  } | null> {
    const key = `lock:event:${eventId}:seat:${seatId}`;
    const data = await this.redis.get(key);

    if (!data) return null;

    const lockData = JSON.parse(data);
    return lockData;
  }

  async extendLock(
    eventId: string,
    seatIds: string[],
    userId: string,
    extraSeconds: number = 300,
  ): Promise<boolean> {
    for (const seatId of seatIds) {
      const key = `lock:event:${eventId}:seat:${seatId}`;
      const data = await this.redis.get(key);

      if (!data) return false;

      const lockData = JSON.parse(data);

      if (lockData.userId !== userId) return false;

      await this.redis.expire(key, this.LOCK_TTL + extraSeconds);
    }

    return true;
  }
}
