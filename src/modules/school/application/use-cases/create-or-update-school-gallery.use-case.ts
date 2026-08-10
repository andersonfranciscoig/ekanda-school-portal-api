import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  FILE_STORAGE,
  FileStorage,
  UploadFileInput,
} from '../../../../shared/application/ports/file-storage.port';
import { SchoolGalleryItem } from '../../domain/entities/school-gallery-item.entity';
import {
  FileUploadFailedException,
  InvalidSchoolGalleryException,
  SchoolGalleryAccessDeniedException,
  SchoolGalleryAlreadyExistsException,
  SchoolGalleryNotFoundException,
} from '../../domain/exceptions/school.exceptions';
import {
  SCHOOL_GALLERY_REPOSITORY,
  SchoolGalleryRepository,
} from '../../domain/repositories/school-gallery.repository';
import { GalleryKind } from '../../domain/school.enums';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';

const PHOTO_MIME = ['image/jpeg', 'image/png'] as const;
const VIDEO_MIME = ['video/mp4'] as const;
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_BYTES = 200 * 1024 * 1024;

export type CreateOrUpdateSchoolGalleryInput = {
  id?: string;
  schoolId: string;
  photos?: UploadFileInput[];
  videos?: UploadFileInput[];
  actorUserId: string;
};

export type CreateOrUpdateSchoolGalleryOutput = {
  items: SchoolGalleryItem[];
  operation: 'created' | 'updated';
};

@Injectable()
export class CreateOrUpdateSchoolGalleryUseCase
  implements
    UseCase<CreateOrUpdateSchoolGalleryInput, CreateOrUpdateSchoolGalleryOutput>
{
  constructor(
    @Inject(SCHOOL_GALLERY_REPOSITORY)
    private readonly gallery: SchoolGalleryRepository,
    @Inject(FILE_STORAGE)
    private readonly files: FileStorage,
    private readonly access: SchoolAccessAuthorizer,
  ) {}

  async execute(
    input: CreateOrUpdateSchoolGalleryInput,
  ): Promise<CreateOrUpdateSchoolGalleryOutput> {
    await this.access.assertSchoolExists(input.schoolId);
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);

    const photos = input.photos ?? [];
    const videos = input.videos ?? [];
    this.assertFiles(photos, videos);

    if (input.id) {
      return this.update(input, photos, videos);
    }
    return this.create(input, photos, videos);
  }

  private async create(
    input: CreateOrUpdateSchoolGalleryInput,
    photos: UploadFileInput[],
    videos: UploadFileInput[],
  ): Promise<CreateOrUpdateSchoolGalleryOutput> {
    const existing = await this.gallery.findBySchoolId(input.schoolId);
    if (existing.length > 0) {
      throw new SchoolGalleryAlreadyExistsException();
    }

    const items = await this.uploadAndBuildItems(
      input.schoolId,
      photos,
      videos,
    );
    const persisted = await this.gallery.replaceAll(input.schoolId, items);
    return { items: persisted, operation: 'created' };
  }

  private async update(
    input: CreateOrUpdateSchoolGalleryInput,
    photos: UploadFileInput[],
    videos: UploadFileInput[],
  ): Promise<CreateOrUpdateSchoolGalleryOutput> {
    const anchor = await this.gallery.findById(input.id!);
    if (!anchor) {
      throw new SchoolGalleryNotFoundException();
    }
    if (!anchor.belongsToSchool(input.schoolId)) {
      throw new SchoolGalleryAccessDeniedException();
    }

    const previous = await this.gallery.findBySchoolId(input.schoolId);
    const items = await this.uploadAndBuildItems(
      input.schoolId,
      photos,
      videos,
    );
    const persisted = await this.gallery.replaceAll(input.schoolId, items);

    for (const old of previous) {
      try {
        await this.files.delete(old.url);
      } catch {
        // best-effort cleanup
      }
    }

    return { items: persisted, operation: 'updated' };
  }

  private assertFiles(
    photos: UploadFileInput[],
    videos: UploadFileInput[],
  ): void {
    if (photos.length === 0 && videos.length === 0) {
      throw new InvalidSchoolGalleryException(
        'At least one photo or video file is required',
      );
    }

    for (const file of photos) {
      this.assertFile(file, PHOTO_MIME, PHOTO_MAX_BYTES, 'photo');
    }
    for (const file of videos) {
      this.assertFile(file, VIDEO_MIME, VIDEO_MAX_BYTES, 'video');
    }
  }

  private assertFile(
    file: UploadFileInput,
    allowed: readonly string[],
    maxBytes: number,
    label: string,
  ): void {
    if (!allowed.includes(file.mimeType)) {
      throw new InvalidSchoolGalleryException(
        `Invalid ${label} mime type: ${file.mimeType}`,
      );
    }
    if (file.size > maxBytes) {
      throw new InvalidSchoolGalleryException(
        `${label} exceeds max size of ${maxBytes} bytes`,
      );
    }
  }

  private async uploadAndBuildItems(
    schoolId: string,
    photos: UploadFileInput[],
    videos: UploadFileInput[],
  ): Promise<SchoolGalleryItem[]> {
    const items: SchoolGalleryItem[] = [];
    let order = 0;

    for (const file of photos) {
      const uploaded = await this.uploadSafe(file, schoolId, 'photos', [
        ...PHOTO_MIME,
      ], PHOTO_MAX_BYTES);
      items.push(
        SchoolGalleryItem.create({
          id: crypto.randomUUID(),
          schoolId,
          url: uploaded.url,
          kind: GalleryKind.PHOTO,
          order: order++,
          fileName: uploaded.originalName,
        }),
      );
    }

    for (const file of videos) {
      const uploaded = await this.uploadSafe(file, schoolId, 'videos', [
        ...VIDEO_MIME,
      ], VIDEO_MAX_BYTES);
      items.push(
        SchoolGalleryItem.create({
          id: crypto.randomUUID(),
          schoolId,
          url: uploaded.url,
          kind: GalleryKind.VIDEO,
          order: order++,
          fileName: uploaded.originalName,
        }),
      );
    }

    return items;
  }

  private async uploadSafe(
    file: UploadFileInput,
    schoolId: string,
    folder: string,
    allowedMimeTypes: string[],
    maxSizeBytes: number,
  ) {
    try {
      return await this.files.upload(file, {
        pathPrefix: `schools/${schoolId}/gallery/${folder}`,
        allowedMimeTypes,
        maxSizeBytes,
      });
    } catch (error) {
      throw new FileUploadFailedException(
        error instanceof Error ? error.message : 'File upload failed',
      );
    }
  }
}
