import { IsString, IsArray, IsNotEmpty } from 'class-validator';

export class ReleaseSeatDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  seatIds: string[];
}
