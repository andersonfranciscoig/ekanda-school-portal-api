import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { SearchSchoolsUseCase } from './application/use-cases/search-schools.use-case';
import { AddSchoolToFavoritesUseCase } from './application/use-cases/add-school-to-favorites.use-case';
import { CompareSchoolsUseCase } from './application/use-cases/compare-schools.use-case';
import { CreateOrUpdateReviewUseCase } from './application/use-cases/create-or-update-review.use-case';
import { GetRecommendedSchoolsUseCase } from './application/use-cases/get-recommended-schools.use-case';
import { GetSchoolPublicProfileUseCase } from './application/use-cases/get-school-public-profile.use-case';
import { ListMyFavoriteSchoolsUseCase } from './application/use-cases/list-my-favorite-schools.use-case';
import { RemoveSchoolFromFavoritesUseCase } from './application/use-cases/remove-school-from-favorites.use-case';
import { FAVORITE_REPOSITORY } from './domain/marketplace.domain';
import { MarketplaceController } from './infrastructure/http/controllers/marketplace.controller';
import { PrismaFavoriteRepository } from './infrastructure/persistence/prisma/prisma-favorite.repository';
import { PrismaMarketplaceSearchQuery } from './infrastructure/persistence/prisma/prisma-marketplace-search.query';

@Module({
  imports: [IdentityModule],
  controllers: [MarketplaceController],
  providers: [
    PrismaMarketplaceSearchQuery,
    { provide: FAVORITE_REPOSITORY, useClass: PrismaFavoriteRepository },
    SearchSchoolsUseCase,
    AddSchoolToFavoritesUseCase,
    RemoveSchoolFromFavoritesUseCase,
    ListMyFavoriteSchoolsUseCase,
    CompareSchoolsUseCase,
    CreateOrUpdateReviewUseCase,
    GetRecommendedSchoolsUseCase,
    GetSchoolPublicProfileUseCase,
  ],
  exports: [
    SearchSchoolsUseCase,
    AddSchoolToFavoritesUseCase,
    RemoveSchoolFromFavoritesUseCase,
    ListMyFavoriteSchoolsUseCase,
  ],
})
export class MarketplaceModule {}
