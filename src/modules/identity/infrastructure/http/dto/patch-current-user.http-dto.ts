import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class PatchCurrentUserBodyDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;
}
