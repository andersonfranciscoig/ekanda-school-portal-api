import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RegisterUserUseCase } from '../../../application/use-cases/register-user.use-case';
import { LoginUserUseCase } from '../../../application/use-cases/login-user.use-case';
import { GetCurrentUserUseCase } from '../../../application/use-cases/get-current-user.use-case';
import { CurrentUser } from '../../../../../shared/infrastructure/http/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/optional-jwt-auth.guard';
import { AuthUser } from '../../auth/auth-user.type';
import { LoginHttpDto, RegisterHttpDto } from '../dto/auth.http-dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly loginUser: LoginUserUseCase,
    private readonly getCurrentUser: GetCurrentUserUseCase,
  ) {}

  @Post('register')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Registar novo utilizador',
    description:
      'Público para GUARDIAN / SCHOOL_OWNER. ' +
      'Criar EKANDA_ADMIN (ou SCHOOL_ADMIN) exige Bearer de um EKANDA_ADMIN.',
  })
  register(
    @Body() dto: RegisterHttpDto,
    @CurrentUser() actor?: AuthUser,
  ) {
    return this.registerUser.execute({
      ...dto,
      actorUserId: actor?.id,
      actorRole: actor?.role,
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autenticar utilizador' })
  login(@Body() dto: LoginHttpDto) {
    return this.loginUser.execute(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Obter perfil do utilizador autenticado' })
  me(@CurrentUser() user: AuthUser) {
    return this.getCurrentUser.execute({ userId: user.id });
  }
}
