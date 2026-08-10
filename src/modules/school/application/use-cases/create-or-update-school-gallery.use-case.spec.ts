import {
  FileStorage,
  UploadFileInput,
} from '../../../../shared/application/ports/file-storage.port';
import { SchoolGalleryItem } from '../../domain/entities/school-gallery-item.entity';
import {
  InvalidSchoolGalleryException,
  SchoolAccessDeniedException,
  SchoolGalleryAccessDeniedException,
  SchoolGalleryAlreadyExistsException,
  SchoolGalleryNotFoundException,
  SchoolNotFoundException,
} from '../../domain/exceptions/school.exceptions';
import { GalleryKind, SchoolMembershipRole } from '../../domain/school.enums';
import { School } from '../../domain/aggregates/school.aggregate';
import { SchoolSlug } from '../../domain/value-objects/school-slug.vo';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';
import { CreateOrUpdateSchoolGalleryUseCase } from './create-or-update-school-gallery.use-case';

function fakeFile(
  name: string,
  mimeType: string,
  size = 100,
): UploadFileInput {
  return {
    buffer: Buffer.from('x'),
    originalName: name,
    mimeType,
    size,
  };
}

describe('CreateOrUpdateSchoolGalleryUseCase', () => {
  const schoolId = '11111111-1111-1111-1111-111111111111';
  const actorUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const itemId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  let gallery: {
    findById: jest.Mock;
    findBySchoolId: jest.Mock;
    replaceAll: jest.Mock;
  };
  let files: jest.Mocked<FileStorage>;
  let access: {
    assertSchoolExists: jest.Mock;
    assertCanManageSchool: jest.Mock;
  };
  let useCase: CreateOrUpdateSchoolGalleryUseCase;

  const school = School.create({
    id: schoolId,
    name: 'Colégio Horizonte',
    slug: SchoolSlug.create('colegio-horizonte'),
    ownerUserId: actorUserId,
  });

  beforeEach(() => {
    gallery = {
      findById: jest.fn(),
      findBySchoolId: jest.fn().mockResolvedValue([]),
      replaceAll: jest.fn(async (_id: string, items: SchoolGalleryItem[]) => items),
    };
    files = {
      upload: jest.fn(async (file, options) => ({
        url: `https://cdn.test/${options.pathPrefix}/${file.originalName}`,
        key: `${options.pathPrefix}/${file.originalName}`,
        mimeType: file.mimeType,
        size: file.size,
        originalName: file.originalName,
      })),
      delete: jest.fn().mockResolvedValue(undefined),
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
    useCase = new CreateOrUpdateSchoolGalleryUseCase(
      gallery as never,
      files,
      access as unknown as SchoolAccessAuthorizer,
    );
  });

  it('creates gallery with photos and videos in order', async () => {
    const result = await useCase.execute({
      schoolId,
      actorUserId,
      photos: [
        fakeFile('a.jpg', 'image/jpeg'),
        fakeFile('b.png', 'image/png'),
      ],
      videos: [fakeFile('c.mp4', 'video/mp4')],
    });

    expect(result.operation).toBe('created');
    expect(result.items.map((i) => i.toSnapshot())).toEqual([
      expect.objectContaining({
        kind: GalleryKind.PHOTO,
        order: 0,
        fileName: 'a.jpg',
      }),
      expect.objectContaining({
        kind: GalleryKind.PHOTO,
        order: 1,
        fileName: 'b.png',
      }),
      expect.objectContaining({
        kind: GalleryKind.VIDEO,
        order: 2,
        fileName: 'c.mp4',
      }),
    ]);
    expect(files.upload).toHaveBeenCalledTimes(3);
  });

  it('rejects create when gallery already exists', async () => {
    gallery.findBySchoolId.mockResolvedValue([
      SchoolGalleryItem.rehydrate({
        id: itemId,
        schoolId,
        url: 'https://cdn/x',
        kind: GalleryKind.PHOTO,
        order: 0,
        fileName: 'x.jpg',
      }),
    ]);

    await expect(
      useCase.execute({
        schoolId,
        actorUserId,
        photos: [fakeFile('a.jpg', 'image/jpeg')],
      }),
    ).rejects.toBeInstanceOf(SchoolGalleryAlreadyExistsException);
  });

  it('rejects invalid photo mime', async () => {
    await expect(
      useCase.execute({
        schoolId,
        actorUserId,
        photos: [fakeFile('a.webp', 'image/webp')],
      }),
    ).rejects.toBeInstanceOf(InvalidSchoolGalleryException);
    expect(files.upload).not.toHaveBeenCalled();
  });

  it('rejects photo over 10MB', async () => {
    await expect(
      useCase.execute({
        schoolId,
        actorUserId,
        photos: [fakeFile('big.jpg', 'image/jpeg', 11 * 1024 * 1024)],
      }),
    ).rejects.toBeInstanceOf(InvalidSchoolGalleryException);
  });

  it('rejects invalid video mime', async () => {
    await expect(
      useCase.execute({
        schoolId,
        actorUserId,
        videos: [fakeFile('a.mov', 'video/quicktime')],
      }),
    ).rejects.toBeInstanceOf(InvalidSchoolGalleryException);
  });

  it('rejects empty files', async () => {
    await expect(
      useCase.execute({ schoolId, actorUserId, photos: [], videos: [] }),
    ).rejects.toBeInstanceOf(InvalidSchoolGalleryException);
  });

  it('updates/replaces gallery when id belongs to school', async () => {
    const old = SchoolGalleryItem.rehydrate({
      id: itemId,
      schoolId,
      url: 'https://cdn/old.jpg',
      kind: GalleryKind.PHOTO,
      order: 0,
      fileName: 'old.jpg',
    });
    gallery.findById.mockResolvedValue(old);
    gallery.findBySchoolId.mockResolvedValue([old]);

    const result = await useCase.execute({
      id: itemId,
      schoolId,
      actorUserId,
      photos: [fakeFile('new.jpg', 'image/jpeg')],
    });

    expect(result.operation).toBe('updated');
    expect(gallery.replaceAll).toHaveBeenCalled();
    expect(files.delete).toHaveBeenCalledWith('https://cdn/old.jpg');
  });

  it('rejects update when gallery id not found', async () => {
    gallery.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({
        id: itemId,
        schoolId,
        actorUserId,
        photos: [fakeFile('a.jpg', 'image/jpeg')],
      }),
    ).rejects.toBeInstanceOf(SchoolGalleryNotFoundException);
  });

  it('rejects cross-tenant gallery id', async () => {
    gallery.findById.mockResolvedValue(
      SchoolGalleryItem.rehydrate({
        id: itemId,
        schoolId: '22222222-2222-2222-2222-222222222222',
        url: 'https://cdn/x',
        kind: GalleryKind.PHOTO,
        order: 0,
        fileName: 'x.jpg',
      }),
    );

    await expect(
      useCase.execute({
        id: itemId,
        schoolId,
        actorUserId,
        photos: [fakeFile('a.jpg', 'image/jpeg')],
      }),
    ).rejects.toBeInstanceOf(SchoolGalleryAccessDeniedException);
  });

  it('rejects unauthorized actor', async () => {
    access.assertCanManageSchool.mockRejectedValue(
      new SchoolAccessDeniedException(),
    );
    await expect(
      useCase.execute({
        schoolId,
        actorUserId,
        photos: [fakeFile('a.jpg', 'image/jpeg')],
      }),
    ).rejects.toBeInstanceOf(SchoolAccessDeniedException);
  });

  it('rejects school not found', async () => {
    access.assertSchoolExists.mockRejectedValue(new SchoolNotFoundException());
    await expect(
      useCase.execute({
        schoolId,
        actorUserId,
        photos: [fakeFile('a.jpg', 'image/jpeg')],
      }),
    ).rejects.toBeInstanceOf(SchoolNotFoundException);
  });
});
