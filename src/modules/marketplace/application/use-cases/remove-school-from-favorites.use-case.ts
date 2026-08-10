import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  FAVORITE_REPOSITORY,
  FavoriteRepository,
} from '../../domain/marketplace.domain';

export type RemoveSchoolFromFavoritesInput = {
  userId: string;
  schoolId: string;
};

export type RemoveSchoolFromFavoritesOutput = {
  schoolId: string;
  removed: boolean;
};

@Injectable()
export class RemoveSchoolFromFavoritesUseCase
  implements
    UseCase<RemoveSchoolFromFavoritesInput, RemoveSchoolFromFavoritesOutput>
{
  constructor(
    @Inject(FAVORITE_REPOSITORY)
    private readonly favorites: FavoriteRepository,
  ) {}

  async execute(
    input: RemoveSchoolFromFavoritesInput,
  ): Promise<RemoveSchoolFromFavoritesOutput> {
    const removed = await this.favorites.remove(input.userId, input.schoolId);
    return { schoolId: input.schoolId, removed };
  }
}
