export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

export interface UnitOfWork {
  runInTransaction<T>(work: () => Promise<T>): Promise<T>;
}
