import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { HoldService } from './hold.service';
import { SeatLockReleaseReason } from './enums';
import { HoldSeatDto, ReleaseSeatDto } from './dto';

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
}
