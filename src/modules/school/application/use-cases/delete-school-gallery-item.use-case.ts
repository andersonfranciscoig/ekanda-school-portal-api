import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  AUDIT_LOGGER,
  AuditLogger,
} from '../../../../shared/application/ports/audit-logger.port';
import {
  FILE_STORAGE,
  FileStorage,
} from '../../../../shared/application/ports/file-storage.port';
import {
  SchoolGalleryAccessDeniedException,
  SchoolGalleryNotFoundException,
} from '../../domain/exceptions/school.exceptions';
import {
  SCHOOL_GALLERY_REPOSITORY,
  SchoolGalleryRepository,
} from '../../domain/repositories/school-gallery.repository';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';

export type DeleteSchoolGalleryItemInput = {
  schoolId: string;
  mediaId: string;
  actorUserId: string;
};

export type DeleteSchoolGalleryItemOutput = {
  schoolId: string;
  mediaId: string;
  deleted: true;
};

@Injectable()
export class DeleteSchoolGalleryItemUseCase
  implements
    UseCase<DeleteSchoolGalleryItemInput, DeleteSchoolGalleryItemOutput>
{
  constructor(
    @Inject(SCHOOL_GALLERY_REPOSITORY)
    private readonly gallery: SchoolGalleryRepository,
    private readonly access: SchoolAccessAuthorizer,
    @Inject(FILE_STORAGE)
    private readonly files: FileStorage,
    @Inject(AUDIT_LOGGER)
    private readonly audit: AuditLogger,
  ) {}

  async execute(
    input: DeleteSchoolGalleryItemInput,
  ): Promise<DeleteSchoolGalleryItemOutput> {
    await this.access.assertSchoolExists(input.schoolId);
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);

    const item = await this.gallery.findById(input.mediaId);
    if (!item) {
      throw new SchoolGalleryNotFoundException();
    }

    if (!item.belongsToSchool(input.schoolId)) {
      throw new SchoolGalleryAccessDeniedException();
    }

    const oldData = item.toSnapshot();
    const deleted = await this.gallery.deleteById(
      input.schoolId,
      input.mediaId,
    );
    if (!deleted) {
      throw new SchoolGalleryNotFoundException();
    }

    await this.files.delete(item.url);

    await this.audit.log({
      actorUserId: input.actorUserId,
      action: 'SCHOOL_GALLERY_ITEM_DELETED',
      entity: 'SchoolGallery',
      entityId: item.id,
      oldData,
      newData: null,
      metadata: { schoolId: input.schoolId },
    });

    return {
      schoolId: input.schoolId,
      mediaId: input.mediaId,
      deleted: true,
    };
  }
}
