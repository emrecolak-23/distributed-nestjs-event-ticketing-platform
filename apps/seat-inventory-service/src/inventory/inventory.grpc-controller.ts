import { Controller } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { HoldService } from '../hold/hold.service';
import { SeatLockService } from './seat-lock.service';
import { GrpcMethod } from '@nestjs/microservices';
import { SeatLockReleaseReason } from '../hold/enums';

@Controller()
export class InventoryGrpcController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly holdService: HoldService,
    private readonly seatLockService: SeatLockService,
  ) {}

  @GrpcMethod('SeatInventoryService', 'GetSeatsByEvent')
  async getSeatsByEvent(data: { eventId: string }) {
    const seats = await this.inventoryService.findByEventId(data.eventId);
    return {
      seats: seats.map((s) => ({
        id: s.id,
        eventId: s.eventId,
        seatId: s.seatId,
        sectionId: s.sectionId,
        sectionName: s.sectionName,
        ticketTypeId: s.ticketTypeId,
        ticketTypeName: s.ticketTypeName,
        price: String(s.price),
        currency: s.currency,
        row: s.row,
        seatNumber: s.seatNumber,
        seatType: s.seatType,
        status: s.status,
      })),
    };
  }

  @GrpcMethod('SeatInventoryService', 'GetAvailableSeats')
  async getAvailableSeats(data: { eventId: string }) {
    const seats = await this.inventoryService.getAvailability(data.eventId);
    return { seats };
  }

  @GrpcMethod('SeatInventoryService', 'VerifyHold')
  async verifyHold(data: {
    eventId: string;
    seatIds: string[];
    userId: string;
  }) {
    for (const seatId of data.seatIds) {
      const lock = await this.seatLockService.getLockInfo(data.eventId, seatId);
      if (!lock || lock.userId !== data.userId) {
        return { verified: false };
      }
    }
    return { verified: true };
  }

  @GrpcMethod('SeatInventoryService', 'HoldSeats')
  async holdSeats(data: {
    eventId: string;
    seatIds: string[];
    userId: string;
    sessionId: string;
  }) {
    try {
      const result = await this.holdService.holdSeats(
        data.eventId,
        data.seatIds,
        data.userId,
        data.sessionId,
      );
      return {
        success: true,
        holdIds: result.holdIds,
        expiresAt: result.expiresAt.toISOString(),
        failedSeatIds: [],
      };
    } catch (error) {
      return {
        success: false,
        holdIds: [],
        expiresAt: '',
        failedSeatIds: data.seatIds,
      };
    }
  }

  @GrpcMethod('SeatInventoryService', 'ReleaseSeats')
  async releaseSeats(data: {
    eventId: string;
    seatIds: string[];
    userId: string;
    reason: SeatLockReleaseReason;
  }) {
    try {
      await this.holdService.releaseSeats(
        data.eventId,
        data.seatIds,
        data.userId,
        data.reason,
      );
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  }
}
