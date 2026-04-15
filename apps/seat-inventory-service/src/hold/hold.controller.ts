import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Param,
  Post,
} from '@nestjs/common';
import { HoldService } from './hold.service';
import { SeatLockReleaseReason } from './enums';
import { HoldSeatDto, ReleaseSeatDto, VerifyHoldDto } from './dto';

@Controller('holds')
export class HoldController {
  constructor(private readonly holdService: HoldService) {}

  @Post()
  holdSeats(@Body() dto: HoldSeatDto) {
    return this.holdService.holdSeats(
      dto.eventId,
      dto.seatIds,
      dto.userId,
      dto.sessionId,
    );
  }

  @Delete(':eventId')
  releaseSeats(
    @Param('eventId') eventId: string,
    @Body() body: ReleaseSeatDto,
  ) {
    return this.holdService.releaseSeats(
      eventId,
      body.seatIds,
      body.userId,
      SeatLockReleaseReason.USER_CANCEL,
    );
  }

  @Post('verify')
  async verifyHold(@Body() dto: VerifyHoldDto) {
    for (const seatId of dto.seatIds) {
      const lock = await this.holdService.getLockInfo(dto.eventId, seatId);
      if (!lock) {
        throw new BadRequestException(`Seat ${seatId} is not held`);
      }

      if (lock.userId !== dto.userId) {
        throw new BadRequestException(`Seat ${seatId} is held by another user`);
      }
    }

    return {
      verified: true,
    };
  }
}
