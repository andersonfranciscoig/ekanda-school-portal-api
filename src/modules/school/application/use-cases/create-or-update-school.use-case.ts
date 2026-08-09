import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/domain/events/domain-event-publisher';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { Phone } from '../../../../shared/domain/value-objects/phone.vo';
import {
  FILE_STORAGE,
  FileStorage,
  UploadFileInput,
} from '../../../../shared/application/ports/file-storage.port';
import {
  AUDIT_LOGGER,
  AuditLogger,
} from '../../../../shared/application/ports/audit-logger.port';
import { UserRole } from '../../../identity/domain/entities/user.entity';
import { School } from '../../domain/aggregates/school.aggregate';
import { SchoolLocation } from '../../domain/entities/school-location.entity';
import {
  FileUploadFailedException,
  SchoolNotFoundException,
} from '../../domain/exceptions/school.exceptions';
import {
  SCHOOL_REPOSITORY,
  SchoolRepository,
} from '../../domain/repositories/school.repository';
import { SchoolSlug } from '../../domain/value-objects/school-slug.vo';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';

export type CreateOrUpdateSchoolInput = {
  id?: string;
  actorUserId: string;
  actorRole: UserRole;
  name: string;
  description?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  foundedAt?: Date;
  province?: string;
  municipality?: string;
  neighborhood?: string;
  address?: string;
  logoFile?: UploadFileInput;
  coverImageFile?: UploadFileInput;
};

export type CreateOrUpdateSchoolOutput = {
  school: School;
  operation: 'created' | 'updated';
};

/**
 * CreateOrUpdateSchool — apenas dados principais do colégio.
 * NÃO publica, NÃO cria subscrição, NÃO processa pagamento, NÃO ativa.
 */
@Injectable()
export class CreateOrUpdateSchoolUseCase
  implements UseCase<CreateOrUpdateSchoolInput, CreateOrUpdateSchoolOutput>
{
  constructor(
    @Inject(SCHOOL_REPOSITORY)
    private readonly schools: SchoolRepository,
    @Inject(FILE_STORAGE)
    private readonly files: FileStorage,
    @Inject(AUDIT_LOGGER)
    private readonly audit: AuditLogger,
    private readonly access: SchoolAccessAuthorizer,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(
    input: CreateOrUpdateSchoolInput,
  ): Promise<CreateOrUpdateSchoolOutput> {
    if (input.id) {
      return this.update(input);
    }
    return this.create(input);
  }

  private async resolveImageUrl(
    schoolId: string,
    kind: 'logo' | 'cover',
    file?: UploadFileInput,
    url?: string,
  ): Promise<string | null | undefined> {
    if (file) {
      try {
        const uploaded = await this.files.upload(file, {
          pathPrefix: `schools/${schoolId}/${kind === 'logo' ? 'logo' : 'cover'}`,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        });
        return uploaded.url;
      } catch (error) {
        throw new FileUploadFailedException(
          error instanceof Error ? error.message : 'File upload failed',
        );
      }
    }
    if (url !== undefined) {
      return url.trim() || null;
    }
    return undefined;
  }

  private async create(
    input: CreateOrUpdateSchoolInput,
  ): Promise<CreateOrUpdateSchoolOutput> {
    this.access.assertCanCreateSchool(input.actorRole);

    const slug = await this.generateUniqueSlug(input.name);
    const schoolId = crypto.randomUUID();

    const location =
      input.province && input.municipality
        ? SchoolLocation.create({
            id: crypto.randomUUID(),
            schoolId,
            province: input.province,
            municipality: input.municipality,
            neighborhood: input.neighborhood,
            address: input.address,
          })
        : null;

    const logoUrl =
      (await this.resolveImageUrl(
        schoolId,
        'logo',
        input.logoFile,
        input.logoUrl,
      )) ?? null;
    const coverImageUrl =
      (await this.resolveImageUrl(
        schoolId,
        'cover',
        input.coverImageFile,
        input.coverImageUrl,
      )) ?? null;

    const school = School.create({
      id: schoolId,
      name: input.name,
      slug,
      ownerUserId: input.actorUserId,
      description: input.description,
      phone: input.phone ? Phone.create(input.phone) : null,
      email: input.email ? Email.create(input.email) : null,
      website: input.website,
      logoUrl,
      coverImageUrl,
      foundedAt: input.foundedAt ?? null,
      location,
    });

    // Persistência atómica School + Membership OWNER (infra)
    const persisted = await this.schools.createWithOwner({
      school,
      ownerUserId: input.actorUserId,
    });

    await this.events.publishAll(school.pullDomainEvents());

    await this.audit.log({
      actorUserId: input.actorUserId,
      action: 'SCHOOL_CREATED',
      entity: 'School',
      entityId: persisted.id,
      oldData: null,
      newData: persisted.toSnapshot(),
    });

    return { school: persisted, operation: 'created' };
  }

  private async update(
    input: CreateOrUpdateSchoolInput,
  ): Promise<CreateOrUpdateSchoolOutput> {
    const schoolId = input.id!;

    await this.access.assertCanManageSchool(input.actorUserId, schoolId);

    const school = await this.schools.findById(schoolId);
    if (!school) {
      // Não revelar existência noutros tenants — access já cobre a maioria
      throw new SchoolNotFoundException();
    }

    const oldData = school.toSnapshot();
    const previousLogo = school.logoUrl;
    const previousCover = school.coverImageUrl;

    let newLogoUrl: string | null | undefined;
    let newCoverUrl: string | null | undefined;

    try {
      newLogoUrl = await this.resolveImageUrl(
        schoolId,
        'logo',
        input.logoFile,
        input.logoUrl,
      );
      newCoverUrl = await this.resolveImageUrl(
        schoolId,
        'cover',
        input.coverImageFile,
        input.coverImageUrl,
      );
    } catch (error) {
      // Upload falhou → manter URLs antigas (não alterar entidade)
      throw error;
    }

    // Slug permanece estável — não regenerar no update
    school.updateProfile(
      {
        name: input.name,
        description: input.description,
        phone: input.phone ? Phone.create(input.phone) : undefined,
        email: input.email ? Email.create(input.email) : undefined,
        website: input.website,
        logoUrl: newLogoUrl,
        coverImageUrl: newCoverUrl,
        foundedAt: input.foundedAt,
      },
      input.actorUserId,
    );

    await this.schools.save(school);
    await this.events.publishAll(school.pullDomainEvents());

    if (input.logoFile && newLogoUrl && previousLogo && newLogoUrl !== previousLogo) {
      await this.files.delete(previousLogo);
    }
    if (
      input.coverImageFile &&
      newCoverUrl &&
      previousCover &&
      newCoverUrl !== previousCover
    ) {
      await this.files.delete(previousCover);
    }

    await this.audit.log({
      actorUserId: input.actorUserId,
      action: 'SCHOOL_UPDATED',
      entity: 'School',
      entityId: school.id,
      oldData,
      newData: school.toSnapshot(),
    });

    return { school, operation: 'updated' };
  }

  private async generateUniqueSlug(name: string): Promise<SchoolSlug> {
    const base = SchoolSlug.fromName(name);
    if (!(await this.schools.existsBySlug(base.value))) {
      return base;
    }

    for (let i = 2; i <= 50; i += 1) {
      const candidate = base.withSuffix(i);
      if (!(await this.schools.existsBySlug(candidate.value))) {
        return candidate;
      }
    }

    return base.withSuffix(crypto.randomUUID().slice(0, 8));
  }
}
