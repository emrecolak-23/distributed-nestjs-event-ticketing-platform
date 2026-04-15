import {
  ArrayMinSize,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BookingItemDto {
  @IsString()
  seatId: string;

  @IsString()
  @IsOptional()
  attendeeName?: string;

  @IsString()
  @IsOptional()
  attendeeEmail?: string;
}

export class CreateBookingDto {
  @IsString()
  userId: string;

  @IsString()
  eventId: string;

  @IsString()
  sessionId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BookingItemDto)
  items: BookingItemDto[];
}
