import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { UnauthorizedDomainException } from '../../../../shared/domain/exceptions/domain.exception';
import { User } from '../../domain/entities/user.entity';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../domain/repositories/user.repository';

export type GetCurrentUserInput = { userId: string };
export type GetCurrentUserOutput = ReturnType<User['toPublic']>;

@Injectable()
export class GetCurrentUserUseCase
  implements UseCase<GetCurrentUserInput, GetCurrentUserOutput>
{
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async execute(input: GetCurrentUserInput): Promise<GetCurrentUserOutput> {
    const user = await this.users.findById(input.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedDomainException(
        'user not found or inactive',
      );
    }
    return user.toPublic();
  }
}
