import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ok } from '../../../../../shared/application/api-response';
import { CurrentUser } from '../../../../../shared/infrastructure/http/current-user.decorator';
import { AuthUser } from '../../../../identity/infrastructure/auth/auth-user.type';
import { JwtAuthGuard } from '../../../../identity/infrastructure/auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../../../identity/infrastructure/auth/optional-jwt-auth.guard';
import { AddSchoolToFavoritesUseCase } from '../../../application/use-cases/add-school-to-favorites.use-case';
import { CompareSchoolsUseCase } from '../../../application/use-cases/compare-schools.use-case';
import { CreateOrUpdateReviewUseCase } from '../../../application/use-cases/create-or-update-review.use-case';
import { DeleteReviewUseCase } from '../../../application/use-cases/delete-review.use-case';
import { ListMyFavoriteSchoolsUseCase } from '../../../application/use-cases/list-my-favorite-schools.use-case';
import { ListSchoolReviewsUseCase } from '../../../application/use-cases/list-school-reviews.use-case';
import { RemoveSchoolFromFavoritesUseCase } from '../../../application/use-cases/remove-school-from-favorites.use-case';
import { SearchSchoolsUseCase } from '../../../application/use-cases/search-schools.use-case';
import { MarketplaceCompareQueryDto } from '../dto/marketplace-compare.query.dto';
import {
  ListSchoolReviewsQueryDto,
  UpsertSchoolReviewBodyDto,
} from '../dto/marketplace-review.dto';
import { MarketplaceSearchQueryDto } from '../dto/marketplace-search.query.dto';

@ApiTags('marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(
    private readonly searchSchools: SearchSchoolsUseCase,
    private readonly compareSchools: CompareSchoolsUseCase,
    private readonly addFavorite: AddSchoolToFavoritesUseCase,
    private readonly removeFavorite: RemoveSchoolFromFavoritesUseCase,
    private readonly listFavorites: ListMyFavoriteSchoolsUseCase,
    private readonly upsertReview: CreateOrUpdateReviewUseCase,
    private readonly listReviews: ListSchoolReviewsUseCase,
    private readonly deleteReview: DeleteReviewUseCase,
  ) {}

  @Get('search')
  @ApiOperation({
    summary:
      'Pesquisa pública de colégios (ACTIVE + subscription válida). Filtros, cards, facets e paginação.',
  })
  async search(@Query() query: MarketplaceSearchQueryDto) {
    const result = await this.searchSchools.execute(query);
    return ok(result, 'ok');
  }

  @Get('compare')
  @ApiOperation({
    summary: 'Comparar 2 ou 3 instituições públicas lado a lado (com explicação IA grounded)',
  })
  async compare(@Query() query: MarketplaceCompareQueryDto) {
    const result = await this.compareSchools.execute({
      ids: query.ids,
      tuitionMax: query.tuitionMax,
      municipality: query.municipality,
      province: query.province,
      lat: query.lat,
      lng: query.lng,
    });
    return ok(result, 'Schools compared');
  }

  @Get('favorites')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Listar colégios favoritos do utilizador autenticado' })
  async listMyFavorites(@CurrentUser() user: AuthUser) {
    const result = await this.listFavorites.execute({ userId: user.id });
    return ok(result, 'Favorite schools listed successfully');
  }

  @Post('favorites/:schoolId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Adicionar colégio aos favoritos (idempotente)',
  })
  async addToFavorites(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.addFavorite.execute({
      userId: user.id,
      schoolId,
    });
    return ok(
      result,
      result.created
        ? 'School added to favorites'
        : 'School already in favorites',
    );
  }

  @Delete('favorites/:schoolId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Remover colégio dos favoritos (idempotente)',
  })
  async removeFromFavorites(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.removeFavorite.execute({
      userId: user.id,
      schoolId,
    });
    return ok(
      result,
      result.removed
        ? 'School removed from favorites'
        : 'School was not in favorites',
    );
  }

  @Get('schools/:schoolId/reviews')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiHeader({
    name: 'x-device-id',
    required: false,
    description: 'Identifica a avaliação anónima deste dispositivo',
  })
  @ApiOperation({
    summary:
      'Listar avaliações publicadas do colégio (autor oculto se anónima)',
  })
  async listSchoolReviews(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Query() query: ListSchoolReviewsQueryDto,
    @CurrentUser() user?: AuthUser,
    @Headers('x-device-id') deviceId?: string,
  ) {
    const result = await this.listReviews.execute({
      schoolId,
      page: query.page,
      pageSize: query.pageSize,
      userId: user?.id ?? null,
      deviceId: deviceId ?? null,
    });
    return ok(result, 'School reviews listed successfully');
  }

  @Post('schools/:schoolId/reviews')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiHeader({
    name: 'x-device-id',
    required: false,
    description: 'Obrigatório para avaliar sem login (avaliação anónima)',
  })
  @ApiOperation({
    summary:
      'Criar ou actualizar a avaliação do colégio (1 por utilizador ou dispositivo). Sem JWT use x-device-id.',
  })
  async upsertSchoolReview(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Body() body: UpsertSchoolReviewBodyDto,
    @CurrentUser() user?: AuthUser,
    @Headers('x-device-id') deviceId?: string,
  ) {
    const result = await this.upsertReview.execute({
      schoolId,
      rating: body.rating,
      comment: body.comment,
      anonymous: body.anonymous,
      userId: user?.id ?? null,
      deviceId: deviceId ?? null,
    });
    return ok(
      result,
      result.created ? 'Review created' : 'Review updated',
    );
  }

  @Delete('reviews/:id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiHeader({
    name: 'x-device-id',
    required: false,
    description: 'Necessário para apagar uma avaliação anónima deste dispositivo',
  })
  @ApiOperation({ summary: 'Apagar a própria avaliação (login ou x-device-id)' })
  async removeReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: AuthUser,
    @Headers('x-device-id') deviceId?: string,
  ) {
    const result = await this.deleteReview.execute({
      reviewId: id,
      userId: user?.id ?? null,
      deviceId: deviceId ?? null,
    });
    return ok(result, 'Review removed');
  }
}
