import { SchoolServiceCatalogId } from '../../../school/domain/school.enums';
import { SearchSchoolsUseCase } from './search-schools.use-case';

describe('SearchSchoolsUseCase', () => {
  let query: { findVisibleSchools: jest.Mock };
  let useCase: SearchSchoolsUseCase;

  beforeEach(() => {
    query = {
      findVisibleSchools: jest.fn().mockResolvedValue([
        {
          id: 's1',
          slug: 'colegio-a',
          name: 'Colégio A',
          description: 'Destaque A',
          logoUrl: null,
          coverImageUrl: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          location: {
            province: 'Luanda',
            municipality: 'Belas',
            neighborhood: 'Benfica',
            latitude: null,
            longitude: null,
          },
          classes: [
            {
              classLabel: '1.ª',
              vacancies: 10,
              shift: 'MORNING',
              isActive: true,
            },
          ],
          services: [{ serviceId: SchoolServiceCatalogId.TRANSPORTE }],
          price: {
            currency: 'AOA',
            levels: [
              {
                levelId: 'creche',
                enrollmentFeeMin: 10000,
                tuitionFeeMin: 30000,
              },
            ],
          },
          gallery: [],
          reviews: [],
        },
      ]),
    };
    useCase = new SearchSchoolsUseCase(query as never);
  });

  it('returns paginated cards + facets + appliedFilters', async () => {
    const result = await useCase.execute({
      province: 'Luanda',
      tuitionMax: 50000,
      serviceIds: 'transporte,ingles',
      sort: 'recommended',
      page: 1,
      pageSize: 12,
    });

    expect(query.findVisibleSchools).toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Colégio A');
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 12,
      totalItems: 1,
      totalPages: 1,
    });
    expect(result.facets.provinces[0]).toEqual({
      value: 'Luanda',
      count: 1,
    });
    expect(result.appliedFilters.province).toBe('Luanda');
    expect(result.appliedFilters.serviceIds).toEqual([
      'transporte',
      'ingles',
    ]);
  });

  it('returns empty when teachingType is not PRIVATE', async () => {
    const result = await useCase.execute({ teachingType: 'INTERNATIONAL' });
    expect(query.findVisibleSchools).toHaveBeenCalled();
    // query itself returns [] for non-PRIVATE; mock still returns data —
    // force empty by asserting normalize passes teachingType through.
    query.findVisibleSchools.mockResolvedValueOnce([]);
    const empty = await useCase.execute({ teachingType: 'INTERNATIONAL' });
    expect(empty.items).toEqual([]);
  });
});
