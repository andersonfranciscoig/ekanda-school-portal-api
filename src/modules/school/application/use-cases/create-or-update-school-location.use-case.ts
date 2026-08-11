import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { SchoolLocation } from '../../domain/entities/school-location.entity';
import {
  SchoolLocationAccessDeniedException,
  SchoolLocationNotFoundException,
} from '../../domain/exceptions/school.exceptions';
import {
  SCHOOL_LOCATION_REPOSITORY,
  SchoolLocationRepository,
} from '../../domain/repositories/school-location.repository';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';

export type CreateOrUpdateSchoolLocationInput = {
  id?: string;
  schoolId: string;
  province: string;
  municipality: string;
  neighborhood?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  /** Authenticated actor — never from client body. */
  actorUserId: string;
};

export type CreateOrUpdateSchoolLocationOutput = {
  location: SchoolLocation;
  operation: 'created' | 'updated';
};

@Injectable()
export class CreateOrUpdateSchoolLocationUseCase
  implements
    UseCase<
      CreateOrUpdateSchoolLocationInput,
      CreateOrUpdateSchoolLocationOutput
    >
{
  constructor(
    @Inject(SCHOOL_LOCATION_REPOSITORY)
    private readonly locations: SchoolLocationRepository,
    private readonly access: SchoolAccessAuthorizer,
  ) {}

  async execute(
    input: CreateOrUpdateSchoolLocationInput,
  ): Promise<CreateOrUpdateSchoolLocationOutput> {
    await this.access.assertSchoolExists(input.schoolId);
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);

    if (input.id) {
      return this.update(input);
    }

    const existing = await this.locations.findBySchoolId(input.schoolId);
    if (existing) {
      return this.update({ ...input, id: existing.id });
    }

    return this.create(input);
  }

  private async create(
    input: CreateOrUpdateSchoolLocationInput,
  ): Promise<CreateOrUpdateSchoolLocationOutput> {

    const location = SchoolLocation.create({
      id: crypto.randomUUID(),
      schoolId: input.schoolId,
      province: input.province,
      municipality: input.municipality,
      neighborhood: input.neighborhood,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
    });

    const persisted = await this.locations.create(location);
    return { location: persisted, operation: 'created' };
  }

  private async update(
    input: CreateOrUpdateSchoolLocationInput,
  ): Promise<CreateOrUpdateSchoolLocationOutput> {
    const location = await this.locations.findById(input.id!);
    if (!location) {
      throw new SchoolLocationNotFoundException();
    }

    if (!location.belongsToSchool(input.schoolId)) {
      throw new SchoolLocationAccessDeniedException();
    }

    location.update({
      province: input.province,
      municipality: input.municipality,
      neighborhood: input.neighborhood,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
    });

    const persisted = await this.locations.update(location);
    return { location: persisted, operation: 'updated' };
  }
}
