import {
  IsString,
  IsEmail,
  MinLength,
  IsOptional,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @IsEmail()
  @ApiProperty({
    description: 'The email address of the user',
    example: 'test@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'The password of the user',
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
  password: string;

  @ApiProperty({
    description: 'The full name of the user',
    example: 'John Doe',
  })
  @IsString()
  fullName: string;

  @ApiProperty({
    description: 'The phone number of the user',
    example: '+905555555555',
  })
  @IsString()
  @IsOptional()
  phone?: string;
}
