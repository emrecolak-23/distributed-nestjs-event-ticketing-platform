import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsEnum,
  IsDateString,
  ValidateNested,
  IsObject,
} from 'class-validator';

import { Type } from 'class-transformer';
import { EventStatus } from '../enums';

export class CreateTicketTypeDto {
  @IsString()
  sectionId: string;

  @IsString()
  name: string;

  @IsNumber()
  price: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @IsOptional()
  maxPerOrder?: number;

  @IsDateString()
  @IsOptional()
  salesStartAt?: Date;

  @IsDateString()
  @IsOptional()
  salesEndAt?: Date;
}

export class CreateEventDto {
  @IsString()
  organizerId: string;

  @IsString()
  venueId: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsEnum(EventStatus)
  @IsOptional()
  status?: EventStatus;

  @IsDateString()
  startsAt: Date;

  @IsDateString()
  @IsOptional()
  endsAt?: Date;

  @IsDateString()
  @IsOptional()
  doorsOpenAt?: Date;

  @IsDateString()
  @IsOptional()
  saleStartsAt?: Date;

  @IsDateString()
  @IsOptional()
  saleEndsAt?: Date;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTicketTypeDto)
  ticketTypes: CreateTicketTypeDto[];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
