import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../../identity/domain/entities/user.entity';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AdminUsersQueryDto {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}

export class CreateAdminUserBodyDto {
  @ApiProperty({ example: 'Inês' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Costa' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  lastName!: string;

  @ApiProperty({ example: 'ines@ekanda.ao' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '+244923000099' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{9,15}$/)
  phone?: string;

  @ApiProperty({ example: 'SenhaForte123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ enum: [UserRole.EKANDA_ADMIN, UserRole.SCHOOL_ADMIN] })
  @IsIn([UserRole.EKANDA_ADMIN, UserRole.SCHOOL_ADMIN])
  role!: UserRole;
}

export class PatchAdminUserBodyDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  isActive!: boolean;
}
