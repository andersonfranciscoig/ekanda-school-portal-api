import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';


@Injectable()
export class ActivatePlanUseCase implements UseCase<unknown, unknown> {
  async execute(_input: unknown): Promise<unknown> {
    throw new Error('ActivatePlanUseCase ainda não implementado');
  }
}
