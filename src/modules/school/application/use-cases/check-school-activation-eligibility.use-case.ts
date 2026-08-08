import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';

@Injectable()
export class CheckSchoolActivationEligibilityUseCase implements UseCase<unknown, unknown> {
  async execute(_input: unknown): Promise<unknown> {
    throw new Error('CheckSchoolActivationEligibilityUseCase not implemented');
  }
}
