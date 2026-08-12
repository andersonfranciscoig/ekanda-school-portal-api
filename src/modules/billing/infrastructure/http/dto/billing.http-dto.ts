import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export const PAYMENT_METHODS = ['MULTICAIXA_EXPRESS', 'BANK_REFERENCE'] as const;
export const CHECKOUT_ACTIONS = ['subscribe', 'renew', 'upgrade'] as const;

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

  @ApiPropertyOptional({ enum: PAYMENT_METHODS, default: 'MULTICAIXA_EXPRESS' })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: (typeof PAYMENT_METHODS)[number];

  @ApiPropertyOptional({
    example: '923000000',
    description: 'Obrigatório para Multicaixa Express',
  })
  @ValidateIf(
    (dto: SubscribeBodyDto) =>
      (dto.method ?? 'MULTICAIXA_EXPRESS') === 'MULTICAIXA_EXPRESS',
  )
  @IsString()
  @Matches(/^9\d{8}$/, {
    message: 'expressPhone must be a 9-digit Angola mobile number',
  })
  expressPhone?: string;
}

export class SubscriptionPaymentBodyDto {
  @ApiPropertyOptional({ enum: PAYMENT_METHODS, default: 'MULTICAIXA_EXPRESS' })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: (typeof PAYMENT_METHODS)[number];

  @ApiPropertyOptional({ example: '923000000' })
  @ValidateIf(
    (dto: SubscriptionPaymentBodyDto) =>
      (dto.method ?? 'MULTICAIXA_EXPRESS') === 'MULTICAIXA_EXPRESS',
  )
  @IsString()
  @Matches(/^9\d{8}$/)
  expressPhone?: string;
}

export class UpgradeSubscriptionBodyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  planId!: string;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS, default: 'MULTICAIXA_EXPRESS' })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: (typeof PAYMENT_METHODS)[number];

  @ApiPropertyOptional({ example: '923000000' })
  @ValidateIf(
    (dto: UpgradeSubscriptionBodyDto) =>
      (dto.method ?? 'MULTICAIXA_EXPRESS') === 'MULTICAIXA_EXPRESS',
  )
  @IsString()
  @Matches(/^9\d{8}$/)
  expressPhone?: string;
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

  @ApiPropertyOptional({ enum: PAYMENT_METHODS, default: 'MULTICAIXA_EXPRESS' })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: (typeof PAYMENT_METHODS)[number];

  @ApiPropertyOptional({ example: '923000000' })
  @ValidateIf(
    (dto: StartPaymentBodyDto) =>
      (dto.method ?? 'MULTICAIXA_EXPRESS') === 'MULTICAIXA_EXPRESS',
  )
  @IsString()
  @Matches(/^9\d{8}$/)
  expressPhone?: string;
}

export class InitiateCheckoutBodyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  schoolId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  planId!: string;

  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS)
  method!: (typeof PAYMENT_METHODS)[number];

  @ApiPropertyOptional({ example: '923000000' })
  @ValidateIf((dto: InitiateCheckoutBodyDto) => dto.method === 'MULTICAIXA_EXPRESS')
  @IsString()
  @Matches(/^9\d{8}$/)
  expressPhone?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @ApiPropertyOptional({ enum: CHECKOUT_ACTIONS, default: 'subscribe' })
  @IsOptional()
  @IsIn(CHECKOUT_ACTIONS)
  action?: (typeof CHECKOUT_ACTIONS)[number];
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
