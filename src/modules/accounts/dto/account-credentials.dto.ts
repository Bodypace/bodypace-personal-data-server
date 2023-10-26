import { IsNotEmpty, IsString } from 'class-validator';

export class AccountCredentials {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
