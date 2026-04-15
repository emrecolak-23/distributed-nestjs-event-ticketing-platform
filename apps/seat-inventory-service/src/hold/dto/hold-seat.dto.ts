import { IsString, IsArray, IsNotEmpty } from 'class-validator';

export class HoldSeatDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  seatIds: string[];

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  sessionId: string;
}
