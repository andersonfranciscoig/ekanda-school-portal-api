import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';

/**
 * Use Case stub — lógica de domínio a implementar em etapa seguinte.
 */
@Injectable()
export class SubmitApplicationUseCase implements UseCase<unknown, unknown> {
  async execute(_input: unknown): Promise<unknown> {
    throw new Error('SubmitApplicationUseCase ainda não implementado');
  }
}
