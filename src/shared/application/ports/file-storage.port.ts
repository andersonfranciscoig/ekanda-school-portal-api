export type UploadFileInput = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
};

export type StoredFile = {
  url: string;
  key: string;
  mimeType: string;
  size: number;
  originalName: string;
};

export type UploadOptions = {
  pathPrefix: string;
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
};

export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface FileStorage {
  upload(file: UploadFileInput, options: UploadOptions): Promise<StoredFile>;
  delete(fileUrlOrKey: string): Promise<void>;
}
