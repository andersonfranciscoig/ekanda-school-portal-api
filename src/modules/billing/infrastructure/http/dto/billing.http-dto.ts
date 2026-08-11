import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class SchoolScopedQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  schoolId!: string;
}

export class SubscribeBodyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  schoolId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  planId!: string;

  @ApiProperty({
    example: '923000000',
    description: 'Número Multicaixa Express (9 dígitos, começa por 9)',
  })
  @IsString()
  @Matches(/^9\d{8}$/, {
    message: 'expressPhone must be a 9-digit Angola mobile number',
  })
  expressPhone!: string;
}

export class ExpressPhoneBodyDto {
  @ApiProperty({ example: '923000000' })
  @IsString()
  @Matches(/^9\d{8}$/)
  expressPhone!: string;
}

export class UpgradeSubscriptionBodyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  planId!: string;

  @ApiProperty({ example: '923000000' })
  @IsString()
  @Matches(/^9\d{8}$/)
  expressPhone!: string;
}

export class StartPaymentBodyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  schoolId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  planId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @ApiProperty({ example: '923000000' })
  @IsString()
  @Matches(/^9\d{8}$/)
  expressPhone!: string;
}

export class ConfirmPaymentBodyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalTransactionId?: string;
}

export class PaymentWebhookBodyDto {
  @ApiProperty()
  @IsString()
  eventId!: string;

  @ApiProperty()
  @IsString()
  eventType!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  paymentId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalTransactionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}

export class WalletTransactionsQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  schoolId!: string;

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
