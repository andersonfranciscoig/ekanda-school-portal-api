import { DomainEventPublisher } from '../../../../shared/domain/events/domain-event-publisher';
import { DomainEvent } from '../../../../shared/domain/events/domain-event';
import {
  FileStorage,
  StoredFile,
  UploadFileInput,
  UploadOptions,
} from '../../../../shared/application/ports/file-storage.port';
import { AuditLogger } from '../../../../shared/application/ports/audit-logger.port';
import { UserRole } from '../../../identity/domain/entities/user.entity';
import { School } from '../../domain/aggregates/school.aggregate';
import { SchoolStatus, SchoolMembershipRole } from '../../domain/school.enums';
import { SchoolRepository } from '../../domain/repositories/school.repository';
import {
  FileUploadFailedException,
  SchoolAccessDeniedException,
} from '../../domain/exceptions/school.exceptions';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';
import { CreateOrUpdateSchoolUseCase } from './create-or-update-school.use-case';
import { ForbiddenDomainException } from '../../../../shared/domain/exceptions/domain.exception';
import { SchoolSlug } from '../../domain/value-objects/school-slug.vo';

class InMemoryEvents extends DomainEventPublisher {
  public published: DomainEvent[] = [];
  async publish(event: DomainEvent): Promise<void> {
    this.published.push(event);
  }
  async publishAll(events: DomainEvent[]): Promise<void> {
    this.published.push(...events);
  }
}

function fakeFile(name = 'logo.png'): UploadFileInput {
  return {
    buffer: Buffer.from('img'),
    originalName: name,
    mimeType: 'image/png',
    size: 100,
  };
}

describe('CreateOrUpdateSchoolUseCase', () => {
  let schools: jest.Mocked<SchoolRepository>;
  let files: jest.Mocked<FileStorage>;
  let audit: jest.Mocked<AuditLogger>;
  let events: InMemoryEvents;
  let access: SchoolAccessAuthorizer;
  let useCase: CreateOrUpdateSchoolUseCase;

  beforeEach(() => {
    schools = {
      save: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      existsBySlug: jest.fn().mockResolvedValue(false),
      findActiveMembership: jest.fn(),
      listByMemberUserId: jest.fn(),
      createWithOwner: jest.fn(async ({ school }) => school),
    };

    files = {
      upload: jest.fn(
        async (file: UploadFileInput, options: UploadOptions): Promise<StoredFile> => ({
          url: `https://cdn.test/${options.pathPrefix}/${file.originalName}`,
          key: `${options.pathPrefix}/${file.originalName}`,
          mimeType: file.mimeType,
          size: file.size,
          originalName: file.originalName,
        }),
      ),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    audit = { log: jest.fn().mockResolvedValue(undefined) };
    events = new InMemoryEvents();
    access = new SchoolAccessAuthorizer(schools);
    useCase = new CreateOrUpdateSchoolUseCase(
      schools,
      files,
      audit,
      access,
      events,
    );
  });

  describe('CREATE', () => {
    it('creates school as DRAFT with OWNER membership and generated slug', async () => {
      const result = await useCase.execute({
        actorUserId: 'owner-1',
        actorRole: UserRole.SCHOOL_OWNER,
        name: 'Colégio Horizonte Internacional',
        description: 'Uma escola de excelência',
      });

      expect(result.operation).toBe('created');
      expect(result.school.status).toBe(SchoolStatus.DRAFT);
      expect(result.school.slug.value).toBe('colegio-horizonte-internacional');
      expect(schools.createWithOwner).toHaveBeenCalledWith(
        expect.objectContaining({ ownerUserId: 'owner-1' }),
      );
      expect(events.published.map((e) => e.eventName)).toContain('school.created');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SCHOOL_CREATED' }),
      );
    });

    it('rejects GUARDIAN role on create', async () => {
      await expect(
        useCase.execute({
          actorUserId: 'g1',
          actorRole: UserRole.GUARDIAN,
          name: 'Colégio Horizonte',
        }),
      ).rejects.toBeInstanceOf(ForbiddenDomainException);
    });

    it('rejects invalid name', async () => {
      await expect(
        useCase.execute({
          actorUserId: 'owner-1',
          actorRole: UserRole.SCHOOL_OWNER,
          name: 'ab',
        }),
      ).rejects.toThrow();
    });

    it('rejects future foundedYear', async () => {
      await expect(
        useCase.execute({
          actorUserId: 'owner-1',
          actorRole: UserRole.SCHOOL_OWNER,
          name: 'Colégio Horizonte',
          foundedYear: new Date().getUTCFullYear() + 2,
        }),
      ).rejects.toThrow();
    });

    it('creates with social fields, foundedYear and approximateStudents', async () => {
      const result = await useCase.execute({
        actorUserId: 'owner-1',
        actorRole: UserRole.SCHOOL_OWNER,
        name: 'Colégio Horizonte',
        foundedYear: 2010,
        approximateStudents: 320,
        instagram: '@horizonte',
        facebook: 'horizonte.ao',
      });

      expect(result.school.foundedYear).toBe(2010);
      expect(result.school.approximateStudents).toBe(320);
      expect(result.school.instagram).toBe('@horizonte');
      expect(result.school.facebook).toBe('horizonte.ao');
    });

    it('uploads logo and cover and stores only URLs', async () => {
      const result = await useCase.execute({
        actorUserId: 'owner-1',
        actorRole: UserRole.SCHOOL_OWNER,
        name: 'Colégio Horizonte',
        logoFile: fakeFile('logo.png'),
        coverImageFile: fakeFile('cover.png'),
      });

      expect(files.upload).toHaveBeenCalledTimes(2);
      expect(result.school.logoUrl).toContain('/logo/');
      expect(result.school.coverImageUrl).toContain('/cover/');
    });

    it('generates slug suffix when base slug exists', async () => {
      schools.existsBySlug
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const result = await useCase.execute({
        actorUserId: 'owner-1',
        actorRole: UserRole.SCHOOL_OWNER,
        name: 'Colégio Horizonte',
      });

      expect(result.school.slug.value).toBe('colegio-horizonte-2');
    });
  });

  describe('UPDATE', () => {
    function existingSchool(): School {
      return School.create({
        id: 'school-a',
        name: 'Colégio Horizonte',
        slug: SchoolSlug.fromName('Colégio Horizonte'),
        ownerUserId: 'owner-1',
        logoUrl: 'https://cdn.test/old-logo.png',
        coverImageUrl: 'https://cdn.test/old-cover.png',
      });
    }

    it('updates school for OWNER and keeps original slug', async () => {
      const school = existingSchool();
      school.pullDomainEvents();
      schools.findActiveMembership.mockResolvedValue({
        userId: 'owner-1',
        schoolId: 'school-a',
        role: SchoolMembershipRole.OWNER,
        status: 'ACTIVE',
      });
      schools.findById.mockResolvedValue(school);

      const result = await useCase.execute({
        id: 'school-a',
        actorUserId: 'owner-1',
        actorRole: UserRole.SCHOOL_OWNER,
        name: 'Colégio Horizonte Internacional',
      });

      expect(result.operation).toBe('updated');
      expect(result.school.name).toBe('Colégio Horizonte Internacional');
      expect(result.school.slug.value).toBe('colegio-horizonte');
      expect(events.published.map((e) => e.eventName)).toContain('school.updated');
    });

    it('allows ADMIN membership', async () => {
      const school = existingSchool();
      schools.findActiveMembership.mockResolvedValue({
        userId: 'admin-1',
        schoolId: 'school-a',
        role: SchoolMembershipRole.ADMIN,
        status: 'ACTIVE',
      });
      schools.findById.mockResolvedValue(school);

      const result = await useCase.execute({
        id: 'school-a',
        actorUserId: 'admin-1',
        actorRole: UserRole.SCHOOL_ADMIN,
        name: 'Colégio Horizonte',
      });

      expect(result.operation).toBe('updated');
    });

    it('denies user without membership (multi-tenant)', async () => {
      schools.findActiveMembership.mockResolvedValue(null);

      await expect(
        useCase.execute({
          id: 'school-b',
          actorUserId: 'owner-a',
          actorRole: UserRole.SCHOOL_OWNER,
          name: 'Hack',
        }),
      ).rejects.toBeInstanceOf(SchoolAccessDeniedException);
    });

    it('replaces logo and deletes old after persist', async () => {
      const school = existingSchool();
      schools.findActiveMembership.mockResolvedValue({
        userId: 'owner-1',
        schoolId: 'school-a',
        role: SchoolMembershipRole.OWNER,
        status: 'ACTIVE',
      });
      schools.findById.mockResolvedValue(school);

      await useCase.execute({
        id: 'school-a',
        actorUserId: 'owner-1',
        actorRole: UserRole.SCHOOL_OWNER,
        name: 'Colégio Horizonte',
        logoFile: fakeFile('new-logo.png'),
      });

      expect(school.logoUrl).toContain('new-logo.png');
      expect(files.delete).toHaveBeenCalledWith('https://cdn.test/old-logo.png');
    });

    it('keeps old logo when new upload fails', async () => {
      const school = existingSchool();
      const oldLogo = school.logoUrl;
      schools.findActiveMembership.mockResolvedValue({
        userId: 'owner-1',
        schoolId: 'school-a',
        role: SchoolMembershipRole.OWNER,
        status: 'ACTIVE',
      });
      schools.findById.mockResolvedValue(school);
      files.upload.mockRejectedValueOnce(new Error('network'));

      await expect(
        useCase.execute({
          id: 'school-a',
          actorUserId: 'owner-1',
          actorRole: UserRole.SCHOOL_OWNER,
          name: 'Colégio Horizonte',
          logoFile: fakeFile('fail.png'),
        }),
      ).rejects.toBeInstanceOf(FileUploadFailedException);

      expect(school.logoUrl).toBe(oldLogo);
      expect(schools.save).not.toHaveBeenCalled();
    });
  });
});
