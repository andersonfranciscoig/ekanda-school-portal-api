import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';

/**
 * CreateOrUpdate: id ausente → CREATE; id presente → UPDATE.
 * Stub — lógica completa em etapa seguinte.
 */
@Injectable()
export class CreateOrUpdatePlanUseCase implements UseCase<unknown, unknown> {
  async execute(_input: unknown): Promise<unknown> {
    throw new Error('CreateOrUpdatePlanUseCase ainda não implementado');
  }
}
