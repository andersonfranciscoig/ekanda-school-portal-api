import { SchoolGalleryItem } from '../entities/school-gallery-item.entity';

export const SCHOOL_GALLERY_REPOSITORY = Symbol('SCHOOL_GALLERY_REPOSITORY');

export interface SchoolGalleryRepository {
  findById(id: string): Promise<SchoolGalleryItem | null>;
  findBySchoolId(schoolId: string): Promise<SchoolGalleryItem[]>;
  replaceAll(
    schoolId: string,
    items: SchoolGalleryItem[],
  ): Promise<SchoolGalleryItem[]>;
  deleteById(schoolId: string, mediaId: string): Promise<boolean>;
}
