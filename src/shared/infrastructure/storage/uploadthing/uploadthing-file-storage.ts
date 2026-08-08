import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FileStorage,
  StoredFile,
  UploadFileInput,
  UploadOptions,
} from '../../../application/ports/file-storage.port';

@Injectable()
export class UploadThingFileStorage implements FileStorage {
  private readonly token: string | undefined;
  private readonly maxDefaultBytes: number;

  constructor(private readonly config: ConfigService) {
    this.token = this.config.get<string>('UPLOADTHING_TOKEN');
    this.maxDefaultBytes = Number(
      this.config.get<string>('UPLOAD_MAX_BYTES') ?? 5 * 1024 * 1024,
    );
  }

  async upload(
    file: UploadFileInput,
    options: UploadOptions,
  ): Promise<StoredFile> {
    this.assertValidFile(file, options);

    const key = this.buildKey(options.pathPrefix, file.originalName);

    if (!this.token) {
      const url = `https://uploadthing.stub.local/${key}`;
      return {
        url,
        key,
        mimeType: file.mimeType,
        size: file.size,
        originalName: file.originalName,
      };
    }

    throw new Error(
      'UploadThingFileStorage: integration UTApi pending — configure the adapter with the official SDK.',
    );
  }

  async delete(_fileUrlOrKey: string): Promise<void> {
    if (!this.token) {
      return;
    }
  }

  private assertValidFile(file: UploadFileInput, options: UploadOptions): void {
    const max = options.maxSizeBytes ?? this.maxDefaultBytes;
    if (file.size <= 0 || file.size > max) {
      throw new Error(`Ficheiro excede o tamanho máximo de ${max} bytes`);
    }

    const allowed = options.allowedMimeTypes ?? [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];

    if (!allowed.includes(file.mimeType)) {
      throw new Error(`MIME type não permitido: ${file.mimeType}`);
    }
  }

  private buildKey(pathPrefix: string, originalName: string): string {
    const safePrefix = pathPrefix.replace(/^\/+|\/+$/g, '');
    const ext = originalName.includes('.')
      ? originalName.slice(originalName.lastIndexOf('.'))
      : '';
    return `${safePrefix}/${crypto.randomUUID()}${ext}`;
  }
}
