import { School } from '../../domain/aggregates/school.aggregate';
import { SchoolGalleryItem } from '../../domain/entities/school-gallery-item.entity';
import {
  SchoolAccessDeniedException,
  SchoolGalleryAccessDeniedException,
  SchoolGalleryNotFoundException,
} from '../../domain/exceptions/school.exceptions';
import { GalleryKind, SchoolMembershipRole } from '../../domain/school.enums';
import { SchoolSlug } from '../../domain/value-objects/school-slug.vo';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';
import { DeleteSchoolGalleryItemUseCase } from './delete-school-gallery-item.use-case';

describe('DeleteSchoolGalleryItemUseCase', () => {
  const schoolId = '11111111-1111-1111-1111-111111111111';
  const otherSchoolId = '22222222-2222-2222-2222-222222222222';
  const actorUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const mediaId = 'mmmmmmmm-mmmm-mmmm-mmmm-mmmmmmmmmmmm';

  let gallery: {
    findById: jest.Mock;
    deleteById: jest.Mock;
  };
  let access: {
    assertSchoolExists: jest.Mock;
    assertCanManageSchool: jest.Mock;
  };
  let files: { delete: jest.Mock };
  let audit: { log: jest.Mock };
  let useCase: DeleteSchoolGalleryItemUseCase;

  const school = School.create({
    id: schoolId,
    name: 'Colégio Horizonte',
    slug: SchoolSlug.create('colegio-horizonte'),
    ownerUserId: actorUserId,
  });

  const item = SchoolGalleryItem.rehydrate({
    id: mediaId,
    schoolId,
    url: 'https://cdn.test/photo.jpg',
    kind: GalleryKind.PHOTO,
    order: 0,
    fileName: 'photo.jpg',
  });

  beforeEach(() => {
    gallery = {
      findById: jest.fn().mockResolvedValue(item),
      deleteById: jest.fn().mockResolvedValue(true),
    };
    access = {
      assertSchoolExists: jest.fn().mockResolvedValue(school),
      assertCanManageSchool: jest.fn().mockResolvedValue({
        userId: actorUserId,
        schoolId,
        role: SchoolMembershipRole.OWNER,
        status: 'ACTIVE',
      }),
    };
    files = { delete: jest.fn().mockResolvedValue(undefined) };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    useCase = new DeleteSchoolGalleryItemUseCase(
      gallery as never,
      access as unknown as SchoolAccessAuthorizer,
      files as never,
      audit as never,
    );
  });

  it('deletes gallery item, file and audits', async () => {
    const result = await useCase.execute({
      schoolId,
      mediaId,
      actorUserId,
    });
    expect(result.deleted).toBe(true);
    expect(gallery.deleteById).toHaveBeenCalledWith(schoolId, mediaId);
    expect(files.delete).toHaveBeenCalledWith('https://cdn.test/photo.jpg');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SCHOOL_GALLERY_ITEM_DELETED' }),
    );
  });

  it('rejects media from another school', async () => {
    gallery.findById.mockResolvedValue(
      SchoolGalleryItem.rehydrate({
        ...item.toSnapshot(),
        schoolId: otherSchoolId,
      }),
    );
    await expect(
      useCase.execute({ schoolId, mediaId, actorUserId }),
    ).rejects.toBeInstanceOf(SchoolGalleryAccessDeniedException);
  });

  it('rejects missing media', async () => {
    gallery.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({ schoolId, mediaId, actorUserId }),
    ).rejects.toBeInstanceOf(SchoolGalleryNotFoundException);
  });

  it('rejects unauthorized actor', async () => {
    access.assertCanManageSchool.mockRejectedValue(
      new SchoolAccessDeniedException(),
    );
    await expect(
      useCase.execute({ schoolId, mediaId, actorUserId }),
    ).rejects.toBeInstanceOf(SchoolAccessDeniedException);
  });
});
