import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'The token for resetting the password',
    example: 'reset_token',
  })
  @IsString()
  token: string;

  @ApiProperty({
    description: 'The new password of the user',
    example: 'Password123!',
  })
  @IsString()
  @MinLength(8)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#])[A-Za-z\d@$!%*?&.#]{8,}$/,
    {
      message:
        'Password must contain at least 8 characters, one uppercase, one lowercase, one number, and one special character',
    },
  )
  newPassword: string;
}
