import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @IsEmail()
  @ApiProperty({
    description: 'The email address of the user',
    example: 'test@example.com',
  })
  email: string;
}
