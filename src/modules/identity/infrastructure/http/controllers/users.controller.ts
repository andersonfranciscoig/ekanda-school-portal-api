import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetCurrentUserUseCase } from '../../../application/use-cases/get-current-user.use-case';
import { CurrentUser } from '../../../../../shared/infrastructure/http/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AuthUser } from '../../auth/auth-user.type';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly getCurrentUser: GetCurrentUserUseCase) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Perfil do utilizador autenticado' })
  me(@CurrentUser() user: AuthUser) {
    return this.getCurrentUser.execute({ userId: user.id });
  }
}
