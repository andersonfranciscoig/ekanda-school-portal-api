import { Injectable } from '@nestjs/common';
import {
  PaymentMethod as PrismaPaymentMethod,
  PaymentStatus as PrismaPaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { Money } from '../../../../../shared/domain/value-objects/money.vo';
import {
  Payment,
  PaymentStatus,
} from '../../../domain/aggregates/payment.aggregate';
import { PaymentRepository } from '../../../domain/repositories/billing.repositories';

@Injectable()
export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(payment: Payment): Promise<void> {
    await this.prisma.payment.upsert({
      where: { id: payment.id },
      create: {
        id: payment.id,
        schoolId: payment.schoolId,
        subscriptionId: payment.subscriptionId,
        planId: payment.planId,
        amount: payment.amount.amount,
        currency: payment.amount.currency,
        method: payment.method as PrismaPaymentMethod,
        status: payment.status as PrismaPaymentStatus,
        externalTransactionId: payment.externalTransactionId,
        externalReference: payment.externalReference,
        expressPhone: payment.expressPhone,
        paidAt: payment.paidAt,
        failureReason: payment.failureReason,
        metadata: (payment.metadata ?? undefined) as Prisma.InputJsonValue,
      },
      update: {
        status: payment.status as PrismaPaymentStatus,
        externalTransactionId: payment.externalTransactionId,
        externalReference: payment.externalReference,
        expressPhone: payment.expressPhone,
        paidAt: payment.paidAt,
        failureReason: payment.failureReason,
        metadata: (payment.metadata ?? undefined) as Prisma.InputJsonValue,
      },
    });
  }

  async findById(id: string): Promise<Payment | null> {
    const record = await this.prisma.payment.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByExternalTransactionId(
    externalId: string,
  ): Promise<Payment | null> {
    const record = await this.prisma.payment.findFirst({
      where: { externalTransactionId: externalId },
    });
    return record ? this.toDomain(record) : null;
  }

  async findByExternalReference(reference: string): Promise<Payment | null> {
    const record = await this.prisma.payment.findUnique({
      where: { externalReference: reference },
    });
    return record ? this.toDomain(record) : null;
  }

  async findByGatewayCheckoutSessionId(
    sessionId: string,
  ): Promise<Payment | null> {
    const record = await this.prisma.payment.findFirst({
      where: {
        metadata: {
          path: ['gateway', 'checkoutSessionId'],
          equals: sessionId,
        },
      },
    });
    return record ? this.toDomain(record) : null;
  }

  async findByGatewayInvoiceId(invoiceId: string): Promise<Payment | null> {
    const record = await this.prisma.payment.findFirst({
      where: {
        metadata: {
          path: ['gateway', 'invoiceId'],
          equals: invoiceId,
        },
      },
    });
    return record ? this.toDomain(record) : null;
  }

  async findManyBySchoolId(schoolId: string): Promise<Payment[]> {
    const records = await this.prisma.payment.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((record) => this.toDomain(record));
  }

  private toDomain(record: {
    id: string;
    schoolId: string;
    subscriptionId: string | null;
    planId: string | null;
    amount: Prisma.Decimal;
    currency: string;
    method: PrismaPaymentMethod;
    status: PrismaPaymentStatus;
    externalTransactionId: string | null;
    externalReference: string | null;
    expressPhone: string | null;
    paidAt: Date | null;
    failureReason: string | null;
    metadata: Prisma.JsonValue | null;
  }): Payment {
    return Payment.rehydrate({
      id: record.id,
      schoolId: record.schoolId,
      subscriptionId: record.subscriptionId,
      planId: record.planId,
      amount: Money.create(Number(record.amount), record.currency),
      method: record.method,
      status: record.status as PaymentStatus,
      externalTransactionId: record.externalTransactionId,
      externalReference: record.externalReference,
      expressPhone: record.expressPhone,
      paidAt: record.paidAt,
      failureReason: record.failureReason,
      metadata:
        record.metadata && typeof record.metadata === 'object'
          ? (record.metadata as Record<string, unknown>)
          : null,
    });
  }
}
