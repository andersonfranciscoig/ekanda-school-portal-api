import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { MailService } from '../../application/mail.service';

@Injectable()
export class SubscriptionExpiryCron {
  private readonly logger = new Logger(SubscriptionExpiryCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Diário às 08:00 UTC — avisos de expiração e planos expirados. */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleSubscriptionExpiry() {
    const now = new Date();
    const in14Days = new Date(now);
    in14Days.setUTCDate(in14Days.getUTCDate() + 14);

    const expiring = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { gte: now, lte: in14Days },
      },
      include: {
        plan: true,
        school: {
          include: {
            memberships: {
              where: { role: 'OWNER' },
              include: { user: true },
              take: 1,
            },
          },
        },
      },
    });

    for (const sub of expiring) {
      const owner = sub.school.memberships[0]?.user;
      if (!owner?.email) continue;
      const days = Math.max(
        1,
        Math.ceil(
          (sub.endDate!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
        ),
      );
      this.mail.sendSubscriptionExpiring({
        email: owner.email,
        ownerName: owner.firstName,
        schoolName: sub.school.name,
        planName: sub.plan.name,
        daysRemaining: days,
      });
    }

    const expired = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { lt: now },
      },
      include: {
        plan: true,
        school: {
          include: {
            memberships: {
              where: { role: 'OWNER' },
              include: { user: true },
              take: 1,
            },
          },
        },
      },
    });

    for (const sub of expired) {
      const owner = sub.school.memberships[0]?.user;
      if (!owner?.email) continue;
      this.mail.sendSubscriptionExpired({
        email: owner.email,
        ownerName: owner.firstName,
        schoolName: sub.school.name,
        planName: sub.plan.name,
      });
    }

    if (expiring.length || expired.length) {
      this.logger.log(
        `Subscription mail: ${expiring.length} expiring, ${expired.length} expired`,
      );
    }
  }
}
