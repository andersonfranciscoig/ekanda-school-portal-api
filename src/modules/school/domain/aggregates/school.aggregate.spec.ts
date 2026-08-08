import { School } from '../aggregates/school.aggregate';
import { SchoolSlug } from '../value-objects/school-slug.vo';
import { SchoolStatus } from '../school.enums';
import { InvalidSchoolDataException } from '../exceptions/school.exceptions';

describe('School Aggregate', () => {
  const baseSlug = SchoolSlug.fromName('Colégio Horizonte');

  it('creates school with DRAFT status', () => {
    const school = School.create({
      id: 's1',
      name: 'Colégio Horizonte',
      slug: baseSlug,
      ownerUserId: 'u1',
      description: 'Descrição válida',
    });

    expect(school.status).toBe(SchoolStatus.DRAFT);
    expect(school.slug.value).toBe('colegio-horizonte');
    expect(school.pullDomainEvents().map((e) => e.eventName)).toContain(
      'school.created',
    );
  });

  it('rejects empty/short name', () => {
    expect(() =>
      School.create({
        id: 's1',
        name: 'ab',
        slug: baseSlug,
        ownerUserId: 'u1',
      }),
    ).toThrow(InvalidSchoolDataException);
  });

  it('rejects future foundedAt', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(() =>
      School.create({
        id: 's1',
        name: 'Colégio Horizonte',
        slug: baseSlug,
        ownerUserId: 'u1',
        foundedAt: future,
      }),
    ).toThrow(InvalidSchoolDataException);
  });

  it('updates profile and emits SchoolUpdated when actor provided', () => {
    const school = School.create({
      id: 's1',
      name: 'Colégio Horizonte',
      slug: baseSlug,
      ownerUserId: 'u1',
    });
    school.pullDomainEvents();

    school.updateProfile({ name: 'Colégio Horizonte Internacional' }, 'u1');

    expect(school.name).toBe('Colégio Horizonte Internacional');
    expect(school.slug.value).toBe('colegio-horizonte');
    expect(school.pullDomainEvents().map((e) => e.eventName)).toContain(
      'school.updated',
    );
  });

  it('rejects description longer than 2000 chars', () => {
    expect(() =>
      School.create({
        id: 's1',
        name: 'Colégio Horizonte',
        slug: baseSlug,
        ownerUserId: 'u1',
        description: 'x'.repeat(2001),
      }),
    ).toThrow(InvalidSchoolDataException);
  });
});
