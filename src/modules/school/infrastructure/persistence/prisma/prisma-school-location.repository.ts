import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { Address } from '../../../../../shared/domain/value-objects/address.vo';
import { Coordinates } from '../../../../../shared/domain/value-objects/coordinates.vo';
import { SchoolLocation } from '../../../domain/entities/school-location.entity';
import { SchoolLocationRepository } from '../../../domain/repositories/school-location.repository';

type LocationRecord = {
  id: string;
  schoolId: string;
  province: string;
  municipality: string;
  neighborhood: string | null;
  address: string | null;
  latitude: Prisma.Decimal | number | null;
  longitude: Prisma.Decimal | number | null;
};

@Injectable()
export class PrismaSchoolLocationRepository
  implements SchoolLocationRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SchoolLocation | null> {
    const record = await this.prisma.schoolLocation.findUnique({
      where: { id },
    });
    return record ? this.toDomain(record) : null;
  }

  async findBySchoolId(schoolId: string): Promise<SchoolLocation | null> {
    const record = await this.prisma.schoolLocation.findUnique({
      where: { schoolId },
    });
    return record ? this.toDomain(record) : null;
  }

  async create(location: SchoolLocation): Promise<SchoolLocation> {
    const snap = location.toSnapshot();
    const record = await this.prisma.schoolLocation.create({
      data: {
        id: snap.id,
        schoolId: snap.schoolId,
        province: snap.province,
        municipality: snap.municipality,
        neighborhood: snap.neighborhood,
        address: snap.address,
        latitude: snap.latitude,
        longitude: snap.longitude,
      },
    });
    return this.toDomain(record);
  }

  async update(location: SchoolLocation): Promise<SchoolLocation> {
    const snap = location.toSnapshot();
    const record = await this.prisma.schoolLocation.update({
      where: { id: snap.id },
      data: {
        province: snap.province,
        municipality: snap.municipality,
        neighborhood: snap.neighborhood,
        address: snap.address,
        latitude: snap.latitude,
        longitude: snap.longitude,
      },
    });
    return this.toDomain(record);
  }

  async deleteBySchoolId(schoolId: string): Promise<boolean> {
    const result = await this.prisma.schoolLocation.deleteMany({
      where: { schoolId },
    });
    return result.count > 0;
  }

  private toDomain(record: LocationRecord): SchoolLocation {
    const toNumber = (
      value: Prisma.Decimal | number | null,
    ): number | null => {
      if (value == null) return null;
      return typeof value === 'number' ? value : value.toNumber();
    };

    const lat = toNumber(record.latitude);
    const lng = toNumber(record.longitude);

    return SchoolLocation.rehydrate({
      id: record.id,
      schoolId: record.schoolId,
      address: Address.create({
        province: record.province,
        municipality: record.municipality,
        neighborhood: record.neighborhood,
        street: record.address,
        district: null,
      }),
      coordinates:
        lat != null && lng != null ? Coordinates.create(lat, lng) : null,
    });
  }
}
