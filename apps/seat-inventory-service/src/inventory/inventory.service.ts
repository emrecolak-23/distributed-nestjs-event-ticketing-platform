import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SeatInventory } from './entities/inventory.entity';
import { In, Repository } from 'typeorm';
import { EventCreateMessage } from '@app/common';
import { SeatStatus } from './enums';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(SeatInventory)
    private readonly repo: Repository<SeatInventory>,
  ) {}

  async createFromEvent(payload: EventCreateMessage): Promise<void> {
    const { eventId, seats } = payload;

    const existing = await this.repo.count({ where: { eventId } });

    if (existing > 0) {
      this.logger.warn(`Event ${eventId} already has inventory`);
      return;
    }

    const entities = seats.map((seat) => {
      return this.repo.create({
        eventId,
        seatId: seat.seatId,
        sectionId: seat.sectionId,
        sectionName: seat.sectionName,
        ticketTypeName: seat.ticketTypeName,
        price: seat.price,
        currency: seat.currency,
        row: seat.row,
        seatNumber: seat.number,
        seatType: seat.type,
        status: SeatStatus.AVAILABLE,
      });
    });

    await this.repo.save(entities);

    this.logger.log(
      `Created ${entities.length} seat inventories for event ${eventId}`,
    );
  }

  async findByEventId(eventId: string): Promise<SeatInventory[]> {
    return this.repo.find({ where: { eventId } });
  }

  async getAvailability(eventId: string): Promise<SeatInventory[]> {
    return this.repo.find({
      where: { eventId, status: SeatStatus.AVAILABLE },
    });
  }

  async findBySeatIds(
    eventId: string,
    seatIds: string[],
  ): Promise<SeatInventory[]> {
    return this.repo.find({
      where: { eventId, seatId: In(seatIds) },
    });
  }

  async updateStatus(
    eventId: string,
    seatIds: string[],
    status: SeatStatus,
  ): Promise<void> {
    await this.repo.update({ eventId, seatId: In(seatIds) }, { status });
  }
}
