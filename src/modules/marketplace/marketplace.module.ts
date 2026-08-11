import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { SearchSchoolsUseCase } from './application/use-cases/search-schools.use-case';
import { AddSchoolToFavoritesUseCase } from './application/use-cases/add-school-to-favorites.use-case';
import { CompareSchoolsUseCase } from './application/use-cases/compare-schools.use-case';
import { CreateOrUpdateReviewUseCase } from './application/use-cases/create-or-update-review.use-case';
import { DeleteReviewUseCase } from './application/use-cases/delete-review.use-case';
import { GetRecommendedSchoolsUseCase } from './application/use-cases/get-recommended-schools.use-case';
import { GetSchoolPublicProfileUseCase } from './application/use-cases/get-school-public-profile.use-case';
import { ListMyFavoriteSchoolsUseCase } from './application/use-cases/list-my-favorite-schools.use-case';
import { ListSchoolReviewsUseCase } from './application/use-cases/list-school-reviews.use-case';
import { RemoveSchoolFromFavoritesUseCase } from './application/use-cases/remove-school-from-favorites.use-case';
import {
  FAVORITE_REPOSITORY,
  REVIEW_REPOSITORY,
} from './domain/marketplace.domain';
import { MarketplaceController } from './infrastructure/http/controllers/marketplace.controller';
import { PrismaFavoriteRepository } from './infrastructure/persistence/prisma/prisma-favorite.repository';
import { PrismaMarketplaceSearchQuery } from './infrastructure/persistence/prisma/prisma-marketplace-search.query';
import { PrismaReviewRepository } from './infrastructure/persistence/prisma/prisma-review.repository';

@Module({
  imports: [IdentityModule],
  controllers: [MarketplaceController],
  providers: [
    PrismaMarketplaceSearchQuery,
    { provide: FAVORITE_REPOSITORY, useClass: PrismaFavoriteRepository },
    { provide: REVIEW_REPOSITORY, useClass: PrismaReviewRepository },
    SearchSchoolsUseCase,
    AddSchoolToFavoritesUseCase,
    RemoveSchoolFromFavoritesUseCase,
    ListMyFavoriteSchoolsUseCase,
    CompareSchoolsUseCase,
    CreateOrUpdateReviewUseCase,
    ListSchoolReviewsUseCase,
    DeleteReviewUseCase,
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
