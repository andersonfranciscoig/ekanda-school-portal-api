import { Injectable } from '@nestjs/common';
import { GalleryKind as PrismaGalleryKind } from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { SchoolGalleryItem } from '../../../domain/entities/school-gallery-item.entity';
import { SchoolGalleryRepository } from '../../../domain/repositories/school-gallery.repository';
import { GalleryKind } from '../../../domain/school.enums';

const DOMAIN_TO_PRISMA: Record<GalleryKind, PrismaGalleryKind> = {
  [GalleryKind.PHOTO]: PrismaGalleryKind.PHOTO,
  [GalleryKind.VIDEO]: PrismaGalleryKind.VIDEO,
};

const PRISMA_TO_DOMAIN: Record<PrismaGalleryKind, GalleryKind> = {
  [PrismaGalleryKind.PHOTO]: GalleryKind.PHOTO,
  [PrismaGalleryKind.VIDEO]: GalleryKind.VIDEO,
};

type GalleryRecord = {
  id: string;
  schoolId: string;
  url: string;
  kind: PrismaGalleryKind;
  order: number;
  fileName: string | null;
};

@Injectable()
export class PrismaSchoolGalleryRepository implements SchoolGalleryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SchoolGalleryItem | null> {
    const record = await this.prisma.schoolGallery.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findBySchoolId(schoolId: string): Promise<SchoolGalleryItem[]> {
    const rows = await this.prisma.schoolGallery.findMany({
      where: { schoolId },
      orderBy: { order: 'asc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async replaceAll(
    schoolId: string,
    items: SchoolGalleryItem[],
  ): Promise<SchoolGalleryItem[]> {
    const snaps = items.map((item) => item.toSnapshot());

    const rows = await this.prisma.$transaction(async (tx) => {
      await tx.schoolGallery.deleteMany({ where: { schoolId } });

      if (snaps.length > 0) {
        await tx.schoolGallery.createMany({
          data: snaps.map((snap) => ({
            id: snap.id,
            schoolId: snap.schoolId,
            url: snap.url,
            kind: DOMAIN_TO_PRISMA[snap.kind],
            order: snap.order,
            fileName: snap.fileName,
          })),
        });
      }

      return tx.schoolGallery.findMany({
        where: { schoolId },
        orderBy: { order: 'asc' },
      });
    });

    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(record: GalleryRecord): SchoolGalleryItem {
    return SchoolGalleryItem.rehydrate({
      id: record.id,
      schoolId: record.schoolId,
      url: record.url,
      kind: PRISMA_TO_DOMAIN[record.kind],
      order: record.order,
      fileName: record.fileName,
    });
  }
}
