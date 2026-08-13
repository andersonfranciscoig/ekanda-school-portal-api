import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ok } from '../../../../../shared/application/api-response';
import { GetCurrentUserUseCase } from '../../../application/use-cases/get-current-user.use-case';
import { UpdateCurrentUserUseCase } from '../../../application/use-cases/update-current-user.use-case';
import { CurrentUser } from '../../../../../shared/infrastructure/http/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AuthUser } from '../../auth/auth-user.type';
import { PatchCurrentUserBodyDto } from '../dto/patch-current-user.http-dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly getCurrentUser: GetCurrentUserUseCase,
    private readonly updateCurrentUser: UpdateCurrentUserUseCase,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Perfil do utilizador autenticado' })
  me(@CurrentUser() user: AuthUser) {
    return ok(
      this.getCurrentUser.execute({ userId: user.id }),
      'User profile',
    );
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Actualizar perfil do utilizador autenticado' })
  async patchMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: PatchCurrentUserBodyDto,
  ) {
    const data = await this.updateCurrentUser.execute({
      userId: user.id,
      ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
    });
    return ok(data, 'Profile updated');
  }
}
