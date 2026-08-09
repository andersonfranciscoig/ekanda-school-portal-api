import { SchoolLocation } from './school-location.entity';
import { InvalidSchoolLocationException } from '../exceptions/school.exceptions';

describe('SchoolLocation', () => {
  const base = {
    id: 'loc-1',
    schoolId: 'sch-1',
    province: 'Luanda',
    municipality: 'Belas',
  };

  it('creates valid location', () => {
    const loc = SchoolLocation.create({
      ...base,
      neighborhood: 'Talatona',
      address: 'Rua 1',
      latitude: -8.9,
      longitude: 13.2,
    });

    expect(loc.toSnapshot()).toMatchObject({
      schoolId: 'sch-1',
      province: 'Luanda',
      municipality: 'Belas',
      latitude: -8.9,
      longitude: 13.2,
    });
  });

  it('rejects empty province', () => {
    expect(() =>
      SchoolLocation.create({ ...base, province: '   ' }),
    ).toThrow();
  });

  it('rejects mismatched coordinates', () => {
    expect(() =>
      SchoolLocation.create({ ...base, latitude: -8, longitude: null }),
    ).toThrow(InvalidSchoolLocationException);
  });

  it('belongsToSchool checks schoolId', () => {
    const loc = SchoolLocation.create(base);
    expect(loc.belongsToSchool('sch-1')).toBe(true);
    expect(loc.belongsToSchool('other')).toBe(false);
  });
});
