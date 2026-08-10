import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ok } from '../../../../../shared/application/api-response';
import { CurrentUser } from '../../../../../shared/infrastructure/http/current-user.decorator';
import { AuthUser } from '../../../../identity/infrastructure/auth/auth-user.type';
import { JwtAuthGuard } from '../../../../identity/infrastructure/auth/jwt-auth.guard';
import { AddSchoolToFavoritesUseCase } from '../../../application/use-cases/add-school-to-favorites.use-case';
import { ListMyFavoriteSchoolsUseCase } from '../../../application/use-cases/list-my-favorite-schools.use-case';
import { RemoveSchoolFromFavoritesUseCase } from '../../../application/use-cases/remove-school-from-favorites.use-case';
import { SearchSchoolsUseCase } from '../../../application/use-cases/search-schools.use-case';
import { MarketplaceSearchQueryDto } from '../dto/marketplace-search.query.dto';
import { Query } from '@nestjs/common';

@ApiTags('marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(
    private readonly searchSchools: SearchSchoolsUseCase,
    private readonly addFavorite: AddSchoolToFavoritesUseCase,
    private readonly removeFavorite: RemoveSchoolFromFavoritesUseCase,
    private readonly listFavorites: ListMyFavoriteSchoolsUseCase,
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
}
