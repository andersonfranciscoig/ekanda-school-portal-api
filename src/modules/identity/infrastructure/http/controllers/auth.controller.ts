import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { RegisterUserUseCase } from '../../../application/use-cases/register-user.use-case';
import { LoginUserUseCase } from '../../../application/use-cases/login-user.use-case';
import { GetCurrentUserUseCase } from '../../../application/use-cases/get-current-user.use-case';
import { TokenIssuer } from '../../../application/ports/token-issuer.port';
import { TOKEN_ISSUER } from '../../../application/use-cases/register-user.use-case';
import { CurrentUser } from '../../../../../shared/infrastructure/http/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/optional-jwt-auth.guard';
import { AuthUser } from '../../auth/auth-user.type';
import { LoginHttpDto, RegisterHttpDto } from '../dto/auth.http-dto';

const ACCESS_COOKIE = 'ekanda_access';
const REFRESH_COOKIE = 'ekanda_refresh';
const ACCESS_MAX_AGE = 900;
const REFRESH_MAX_AGE = 604800;

const isProduction = process.env.NODE_ENV === 'production';

function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api',
    maxAge: ACCESS_MAX_AGE * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/v1/auth/refresh',
    maxAge: REFRESH_MAX_AGE * 1000,
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { path: '/api' });
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth/refresh' });
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly loginUser: LoginUserUseCase,
    private readonly getCurrentUser: GetCurrentUserUseCase,
    @Inject(TOKEN_ISSUER) private readonly tokenIssuer: TokenIssuer,
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
  async register(
    @Body() dto: RegisterHttpDto,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() actor?: AuthUser,
  ) {
    const { accessToken, refreshToken, user } =
      await this.registerUser.execute({
        ...dto,
        actorUserId: actor?.id,
        actorRole: actor?.role,
      });

    setAuthCookies(res, accessToken, refreshToken);
    return { user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autenticar utilizador' })
  async login(
    @Body() dto: LoginHttpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.loginUser.execute(dto);

    setAuthCookies(res, accessToken, refreshToken);
    return { user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar sessão via refresh cookie' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      throw new UnauthorizedException('refresh token not provided');
    }

    const payload = await this.tokenIssuer.verifyRefresh(token);
    const pair = await this.tokenIssuer.issuePair(payload);
    setAuthCookies(res, pair.accessToken, pair.refreshToken);
    return { message: 'session renewed' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Terminar sessão (limpa cookies)' })
  logout(@Res({ passthrough: true }) res: Response) {
    clearAuthCookies(res);
    return { message: 'logged out' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Obter perfil do utilizador autenticado' })
  me(@CurrentUser() user: AuthUser) {
    return this.getCurrentUser.execute({ userId: user.id });
  }
}
