import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AccountCredentials {
  @ApiProperty({
    description: 'Unique username',
    example: 'john_doe',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'User password',
    example: 'some_strong_password',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
