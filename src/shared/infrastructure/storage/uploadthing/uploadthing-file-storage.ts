import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UTApi, UTFile } from 'uploadthing/server';
import {
  FileStorage,
  StoredFile,
  UploadFileInput,
  UploadOptions,
} from '../../../application/ports/file-storage.port';

@Injectable()
export class UploadThingFileStorage implements FileStorage {
  private readonly logger = new Logger(UploadThingFileStorage.name);
  private readonly token: string | undefined;
  private readonly maxDefaultBytes: number;
  private readonly utapi: UTApi | null;

  constructor(private readonly config: ConfigService) {
    this.token =
      this.config
        .get<string>('UPLOADTHING_TOKEN')
        ?.trim()
        .replace(/^['"]|['"]$/g, '') || undefined;
    this.maxDefaultBytes = Number(
      this.config.get<string>('UPLOAD_MAX_BYTES') ?? 5 * 1024 * 1024,
    );
    this.utapi = this.token ? new UTApi({ token: this.token }) : null;
  }

  async upload(
    file: UploadFileInput,
    options: UploadOptions,
  ): Promise<StoredFile> {
    this.assertValidFile(file, options);

    if (!this.utapi) {
      throw new Error(
        'UPLOADTHING_TOKEN não configurado. Defina o token no .env para uploads reais.',
      );
    }

    // Flat customId (no slashes) — pathPrefix is only for our own bookkeeping.
    const customId = this.buildKey(options.pathPrefix, file.originalName).replace(
      /\//g,
      '_',
    );
    const utFile = new UTFile([new Uint8Array(file.buffer)], file.originalName, {
      customId,
    });

    const result = await this.utapi.uploadFiles(utFile);

    if (result.error || !result.data) {
      const message =
        result.error?.message ?? 'UploadThing rejeitou o ficheiro';
      this.logger.error(`Upload failed: ${message}`);
      throw new Error(message);
    }

    const data = result.data;
    const url =
      (data as { ufsUrl?: string }).ufsUrl ??
      (data as { appUrl?: string }).appUrl ??
      data.url;

    return {
      url,
      key: data.key,
      mimeType: file.mimeType,
      size: data.size ?? file.size,
      originalName: data.name ?? file.originalName,
    };
  }

  async delete(fileUrlOrKey: string): Promise<void> {
    if (!this.utapi || !fileUrlOrKey) return;

    if (fileUrlOrKey.includes('uploadthing.stub.local')) {
      return;
    }

    const key = this.extractKey(fileUrlOrKey);
    if (!key) return;

    try {
      await this.utapi.deleteFiles(key);
    } catch (error) {
      this.logger.warn(
        `Failed to delete file ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private extractKey(fileUrlOrKey: string): string | null {
    if (!fileUrlOrKey.includes('://')) {
      return fileUrlOrKey;
    }

    try {
      const pathname = new URL(fileUrlOrKey).pathname;
      // /f/<key> or /a/<appId>/<key>
      const parts = pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || null;
    } catch {
      return null;
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
