import { IsNotEmpty, IsString } from 'class-validator';

export class DocumentMetadata {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  keys: string;
}
