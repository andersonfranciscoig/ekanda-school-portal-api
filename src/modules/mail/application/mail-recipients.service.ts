import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma/prisma.service';

export type Recipient = {
  email: string;
  name: string;
};

@Injectable()
export class MailRecipientsService {
  constructor(private readonly prisma: PrismaService) {}

  async schoolOwner(schoolId: string): Promise<Recipient | null> {
    const membership = await this.prisma.schoolMembership.findFirst({
      where: { schoolId, role: 'OWNER', status: 'ACTIVE' },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!membership?.user.email) return null;
    return {
      email: membership.user.email,
      name: membership.user.firstName,
    };
  }
}

export function firstNameFromEmail(email: string): string {
  const local = (email.split('@')[0] ?? 'Utilizador').replace(/[._+-]/g, ' ');
  const word = local.trim().split(/\s+/)[0] ?? 'Utilizador';
  return word.charAt(0).toUpperCase() + word.slice(1);
}
