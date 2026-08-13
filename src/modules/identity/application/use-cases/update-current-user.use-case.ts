import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { InvariantViolationException } from '../../../../shared/domain/exceptions/domain.exception';
import { Phone } from '../../../../shared/domain/value-objects/phone.vo';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../domain/repositories/user.repository';
import { GetCurrentUserOutput } from './get-current-user.use-case';

export type UpdateCurrentUserInput = {
  userId: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
};

@Injectable()
export class UpdateCurrentUserUseCase
  implements UseCase<UpdateCurrentUserInput, GetCurrentUserOutput>
{
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async execute(input: UpdateCurrentUserInput): Promise<GetCurrentUserOutput> {
    const user = await this.users.findById(input.userId);
    if (!user || !user.isActive) {
      throw new InvariantViolationException('Utilizador não encontrado');
    }

    let phone: Phone | null | undefined;
    if (input.phone !== undefined) {
      if (input.phone == null || input.phone.trim() === '') {
        phone = null;
      } else {
        phone = Phone.create(input.phone.trim());
      }
    }

    user.updateProfile({
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(phone !== undefined ? { phone } : {}),
    });

    const saved = await this.users.save(user);
    return saved.toPublic();
  }
}
