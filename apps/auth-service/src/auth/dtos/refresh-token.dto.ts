import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'The refresh token',
    example: 'refresh_token',
  })
  @IsString()
  refreshToken: string;
}
