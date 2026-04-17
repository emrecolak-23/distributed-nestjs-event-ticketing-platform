import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@app/redis';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeatInventory } from '../inventory/entities/inventory.entity';
import { SeatStatus } from '../inventory/enums';
import { SeatAvailabilityView } from './interfaces';

@Injectable()
export class AvailabilityReadService implements OnModuleInit {
  private readonly logger = new Logger(AvailabilityReadService.name);
  private readonly STATUS_PREFIX = 'avail';
  private readonly DETAIL_PREFIX = 'seat_detail';

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(SeatInventory)
    private readonly inventoryRepo: Repository<SeatInventory>,
  ) {}

  async onModuleInit() {
    await this.warmUpCache();
  }

  async updateSeatsStatus(eventId: string, seatId: string, status: string) {
    const hashKey = `${this.STATUS_PREFIX}:${eventId}`;
    await this.redis.hset(hashKey, seatId, status);
  }

  async updateMultipleSeatsStatus(
    eventId: string,
    updates: Array<{ seatId: string; status: string }>,
  ) {
    const hashKey = `${this.STATUS_PREFIX}:${eventId}`;
    const pipeline = this.redis.pipeline();

    for (const update of updates) {
      pipeline.hset(hashKey, update.seatId, update.status);
    }

    await pipeline.exec();
  }

  async getEventSeatsWithStatus(eventId: string): Promise<any[]> {
    const statusKey = `${this.STATUS_PREFIX}:${eventId}`;
    const detailKey = `${this.DETAIL_PREFIX}:${eventId}`;

    let statuses = await this.redis.hgetall(statusKey);
    let details = await this.redis.hgetall(detailKey);

    if (!statuses || Object.keys(statuses).length === 0) {
      this.logger.log(`Cache miss for event ${eventId}, rebuilding cache`);
      await this.rebuildCache(eventId);
      statuses = await this.redis.hgetall(statusKey);
      details = await this.redis.hgetall(detailKey);
    }

    return Object.entries(statuses).map(([seatId, status]) => {
      const detail = details[seatId] ? JSON.parse(details[seatId]) : null;
      return { ...detail, status };
    });
  }

  async getAvailableSeatsDetailed(eventId: string): Promise<any[]> {
    const allSeats = await this.getEventSeatsWithStatus(eventId);
    return allSeats.filter((s) => s.status === SeatStatus.AVAILABLE);
  }

  async getEventAvailabilitySummary(eventId: string): Promise<any> {
    const allSeats = await this.getEventSeatsWithStatus(eventId);

    const sections = new Map<
      string,
      {
        total: number;
        available: number;
        held: number;
        sold: number;
        price: string;
      }
    >();

    for (const seat of allSeats) {
      const key = seat.sectionName || 'Unknown';
      if (!sections.has(key)) {
        sections.set(key, {
          total: 0,
          available: 0,
          held: 0,
          sold: 0,
          price: seat.price,
        });
      }

      const section = sections.get(key);
      if (section) {
        section.total++;
        if (seat.status == SeatStatus.AVAILABLE) section.available++;
        else if (seat.status == SeatStatus.HELD) section.held++;
        else if (seat.status == SeatStatus.SOLD) section.sold++;
      }
    }

    return {
      totalSeats: allSeats.length,
      available: allSeats.filter((s) => s.status === SeatStatus.AVAILABLE)
        .length,
      held: allSeats.filter((s) => s.status === SeatStatus.HELD).length,
      sold: allSeats.filter((s) => s.status === SeatStatus.SOLD).length,
      sections: Object.fromEntries(sections),
    };
  }

  async getAvailableCount(eventId: string): Promise<number> {
    const statuses = await this.redis.hgetall(
      `${this.STATUS_PREFIX}:${eventId}`,
    );
    return Object.values(statuses).filter((s) => s === 'available').length;
  }

  async getSeatStatus(eventId: string, seatId: string) {
    const hashKey = `${this.STATUS_PREFIX}:${eventId}`;
    return this.redis.hget(hashKey, seatId);
  }

  async rebuildCache(eventId: string) {
    const seats = await this.inventoryRepo.find({
      where: { eventId },
    });

    if (seats.length === 0) return;

    const statusKey = `${this.STATUS_PREFIX}:${eventId}`;
    const detailKey = `${this.DETAIL_PREFIX}:${eventId}`;

    const pipeline = this.redis.pipeline();
    pipeline.del(statusKey);
    pipeline.del(detailKey);

    for (const seat of seats) {
      pipeline.hset(statusKey, seat.seatId, seat.status);
      pipeline.hset(
        detailKey,
        seat.seatId,
        JSON.stringify({
          seatId: seat.seatId,
          sectionId: seat.sectionId,
          sectionName: seat.sectionName,
          ticketTypeId: seat.ticketTypeId,
          ticketTypeName: seat.ticketTypeName,
          price: String(seat.price),
          currency: seat.currency,
          row: seat.row,
          seatNumber: seat.seatNumber,
          seatType: seat.seatType,
        }),
      );
    }

    await pipeline.exec();

    this.logger.log(
      `Rebuilt cache for event ${eventId} with ${seats.length} seats`,
    );
  }

  private async warmUpCache() {
    const eventIds = await this.inventoryRepo
      .createQueryBuilder('si')
      .select('DISTINCT si.eventId', 'eventId')
      .getRawMany();

    for (const { eventId } of eventIds) {
      await this.rebuildCache(eventId);
    }

    this.logger.log('Warm up cache completed');
  }
}
