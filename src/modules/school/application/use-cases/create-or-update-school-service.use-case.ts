import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';

/**
 * CreateOrUpdate: id ausente → CREATE; id presente → UPDATE.
 * Stub — lógica completa em etapa seguinte.
 */
@Injectable()
export class CreateOrUpdateSchoolServiceUseCase implements UseCase<unknown, unknown> {
  async execute(_input: unknown): Promise<unknown> {
    throw new Error('CreateOrUpdateSchoolServiceUseCase ainda não implementado');
  }
}
