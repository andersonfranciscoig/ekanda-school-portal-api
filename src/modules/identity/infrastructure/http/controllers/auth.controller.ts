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
import { CookieOptions, Request, Response } from 'express';
import { RegisterUserUseCase } from '../../../application/use-cases/register-user.use-case';
import { LoginUserUseCase } from '../../../application/use-cases/login-user.use-case';
import { GetCurrentUserUseCase } from '../../../application/use-cases/get-current-user.use-case';
import { TokenIssuer } from '../../../application/ports/token-issuer.port';
import { TOKEN_ISSUER } from '../../../application/use-cases/register-user.use-case';
import { CurrentUser } from '../../../../../shared/infrastructure/http/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/optional-jwt-auth.guard';
import { AuthUser } from '../../auth/auth-user.type';
import {
  LoginHttpDto,
  RefreshHttpDto,
  RegisterHttpDto,
} from '../dto/auth.http-dto';

const ACCESS_COOKIE = 'ekanda_access';
const REFRESH_COOKIE = 'ekanda_refresh';
const ACCESS_MAX_AGE = 900;
const REFRESH_MAX_AGE = 604800;

const isProduction = process.env.NODE_ENV === 'production';

function cookieOptions(path: string, maxAgeSec: number): CookieOptions {
  return {
    httpOnly: true,
    path,
    maxAge: maxAgeSec * 1000,
    // Cross-origin SPA (Lovable/Vercel → Render) precisa de None+Secure.
    // Em HTTP local, Lax sem Secure para o browser aceitar o cookie.
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
  };
}

function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
) {
  res.cookie(
    ACCESS_COOKIE,
    accessToken,
    cookieOptions('/api', ACCESS_MAX_AGE),
  );
  res.cookie(
    REFRESH_COOKIE,
    refreshToken,
    cookieOptions('/api/v1/auth/refresh', REFRESH_MAX_AGE),
  );
}

function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, cookieOptions('/api', ACCESS_MAX_AGE));
  res.clearCookie(
    REFRESH_COOKIE,
    cookieOptions('/api/v1/auth/refresh', REFRESH_MAX_AGE),
  );
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
    return { user, accessToken, refreshToken };
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
    return { user, accessToken, refreshToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar sessão via cookie ou body' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: RefreshHttpDto = {},
  ) {
    const token = req.cookies?.[REFRESH_COOKIE] || dto.refreshToken;
    if (!token) {
      throw new UnauthorizedException('refresh token not provided');
    }

    const payload = await this.tokenIssuer.verifyRefresh(token);
    const pair = await this.tokenIssuer.issuePair(payload);
    setAuthCookies(res, pair.accessToken, pair.refreshToken);
    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
    };
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
