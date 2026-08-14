import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../../domain/entities/user.entity';

export class RegisterHttpDto {
  @ApiProperty({ example: 'Maria' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Silva' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  lastName!: string;

  @ApiProperty({ example: 'maria@email.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '+244900000000' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{9,15}$/)
  phone?: string;

  @ApiProperty({ example: 'SenhaForte123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({
    enum: UserRole,
    description:
      'GUARDIAN / SCHOOL_OWNER: público. EKANDA_ADMIN / SCHOOL_ADMIN: requer Bearer de EKANDA_ADMIN.',
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class LoginHttpDto {
  @ApiProperty({ example: 'maria@email.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SenhaForte123' })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class RefreshHttpDto {
  @ApiPropertyOptional({ description: 'Refresh token (alternativa ao cookie httpOnly)' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class ConfirmRegisterHttpDto {
  @ApiProperty({ example: 'maria@email.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456', description: 'Código OTP de 6 dígitos' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  otp!: string;
}

export class ForgotPasswordHttpDto {
  @ApiProperty({ example: 'maria@email.com' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordHttpDto {
  @ApiProperty({ example: 'maria@email.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Token do link de recuperação' })
  @IsString()
  @MinLength(16)
  token!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
