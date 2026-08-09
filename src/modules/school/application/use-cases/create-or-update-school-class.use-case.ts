import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { SchoolClass } from '../../domain/entities/school-class.entity';
import {
  SchoolClassAccessDeniedException,
  SchoolClassNotFoundException,
} from '../../domain/exceptions/school.exceptions';
import {
  SCHOOL_CLASS_REPOSITORY,
  SchoolClassRepository,
} from '../../domain/repositories/school-class.repository';
import { SchoolClassShift } from '../../domain/school.enums';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';

export type CreateOrUpdateSchoolClassInput = {
  id?: string;
  schoolId: string;
  classLabel: string;
  vacancies: number;
  shift: SchoolClassShift;
  schedule?: string | null;
  actorUserId: string;
};

export type CreateOrUpdateSchoolClassOutput = {
  schoolClass: SchoolClass;
  operation: 'created' | 'updated';
};

@Injectable()
export class CreateOrUpdateSchoolClassUseCase
  implements
    UseCase<CreateOrUpdateSchoolClassInput, CreateOrUpdateSchoolClassOutput>
{
  constructor(
    @Inject(SCHOOL_CLASS_REPOSITORY)
    private readonly classes: SchoolClassRepository,
    private readonly access: SchoolAccessAuthorizer,
  ) {}

  async execute(
    input: CreateOrUpdateSchoolClassInput,
  ): Promise<CreateOrUpdateSchoolClassOutput> {
    await this.access.assertSchoolExists(input.schoolId);
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);

    if (input.id) return this.update(input);
    
    return this.create(input);
  }

  private async create(
    input: CreateOrUpdateSchoolClassInput,
  ): Promise<CreateOrUpdateSchoolClassOutput> {
    const schoolClass = SchoolClass.create({
      id: crypto.randomUUID(),
      schoolId: input.schoolId,
      classLabel: input.classLabel,
      vacancies: input.vacancies,
      shift: input.shift,
      schedule: input.schedule,
    });

    const persisted = await this.classes.create(schoolClass);
    return { schoolClass: persisted, operation: 'created' };
  }

  private async update(
    input: CreateOrUpdateSchoolClassInput,
  ): Promise<CreateOrUpdateSchoolClassOutput> {
    const schoolClass = await this.classes.findById(input.id!);

    if (!schoolClass) throw new SchoolClassNotFoundException();
    

    if (!schoolClass.belongsToSchool(input.schoolId)) {
      throw new SchoolClassAccessDeniedException();
    }

    schoolClass.update({
      classLabel: input.classLabel,
      vacancies: input.vacancies,
      shift: input.shift,
      schedule: input.schedule,
    });

    const persisted = await this.classes.update(schoolClass);
    return { schoolClass: persisted, operation: 'updated' };
  }
}
