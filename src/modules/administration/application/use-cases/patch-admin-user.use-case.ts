import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { AUDIT_LOGGER } from '../../../../shared/application/ports/audit-logger.port';
import type { AuditLogger } from '../../../../shared/application/ports/audit-logger.port';
import {
  BusinessRuleViolationException,
  EntityNotFoundException,
} from '../../../../shared/domain/exceptions/domain.exception';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../identity/domain/repositories/user.repository';
import { presentAdminUser } from '../services/admin.presenter';

export type PatchAdminUserInput = {
  actorUserId: string;
  userId: string;
  isActive: boolean;
};

@Injectable()
export class PatchAdminUserUseCase
  implements UseCase<PatchAdminUserInput, unknown>
{
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly prisma: PrismaService,
    @Inject(AUDIT_LOGGER) private readonly audit: AuditLogger,
  ) {}

  async execute(input: PatchAdminUserInput) {
    if (input.userId === input.actorUserId && input.isActive === false) {
      throw new BusinessRuleViolationException(
        'You cannot deactivate your own account',
      );
    }

    const user = await this.users.findById(input.userId);
    if (!user) throw new EntityNotFoundException('User not found');

    if (input.isActive) user.activate();
    else user.deactivate();
    await this.users.save(user);

    const row = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { platformRoles: { select: { role: true } } },
    });
    const presented = presentAdminUser(row);
    await this.audit.log({
      actorUserId: input.actorUserId,
      action: input.isActive ? 'USER_ACTIVATED' : 'USER_SUSPENDED',
      entity: 'USER',
      entityId: user.id,
      oldData: { isActive: !input.isActive },
      newData: { isActive: input.isActive },
      metadata: { entityLabel: presented.name },
    });
    return presented;
  }
}
