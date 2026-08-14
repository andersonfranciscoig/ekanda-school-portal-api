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
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CookieOptions, Request, Response } from 'express';
import { RegisterUserUseCase } from '../../../application/use-cases/register-user.use-case';
import { StartRegisterUseCase } from '../../../application/use-cases/start-register.use-case';
import { ConfirmRegisterUseCase } from '../../../application/use-cases/confirm-register.use-case';
import { ForgotPasswordUseCase } from '../../../application/use-cases/forgot-password.use-case';
import { ResetPasswordUseCase } from '../../../application/use-cases/reset-password.use-case';
import { LoginUserUseCase } from '../../../application/use-cases/login-user.use-case';
import { GetCurrentUserUseCase } from '../../../application/use-cases/get-current-user.use-case';
import { TokenIssuer } from '../../../application/ports/token-issuer.port';
import { TOKEN_ISSUER } from '../../../application/use-cases/register-user.use-case';
import { UserRole } from '../../../domain/entities/user.entity';
import { PlatformBetaService } from '../../../../platform-beta/application/platform-beta.service';
import { CurrentUser } from '../../../../../shared/infrastructure/http/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/optional-jwt-auth.guard';
import { AuthUser } from '../../auth/auth-user.type';
import {
  LoginHttpDto,
  RefreshHttpDto,
  RegisterHttpDto,
  ConfirmRegisterHttpDto,
  ForgotPasswordHttpDto,
  ResetPasswordHttpDto,
} from '../dto/auth.http-dto';
import { ok } from '../../../../../shared/application/api-response';

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
    private readonly startRegister: StartRegisterUseCase,
    private readonly confirmRegister: ConfirmRegisterUseCase,
    private readonly forgotPassword: ForgotPasswordUseCase,
    private readonly resetPassword: ResetPasswordUseCase,
    private readonly loginUser: LoginUserUseCase,
    private readonly getCurrentUser: GetCurrentUserUseCase,
    private readonly platformBeta: PlatformBetaService,
    @Inject(TOKEN_ISSUER) private readonly tokenIssuer: TokenIssuer,
  ) {}

  @Post('register/start')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Iniciar registo — envia OTP por email',
    description: 'Valida dados e envia código de 6 dígitos. Concluir em POST /auth/register/confirm.',
  })
  async registerStart(
    @Body() dto: RegisterHttpDto,
    @CurrentUser() actor?: AuthUser,
  ) {
    return ok(
      await this.startRegister.execute({
        ...dto,
        actorRole: actor?.role,
      }),
      'Verification code sent',
    );
  }

  @Post('register/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmar registo com OTP' })
  async registerConfirm(
    @Body() dto: ConfirmRegisterHttpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.confirmRegister.execute(dto);
    setAuthCookies(res, accessToken, refreshToken);
    return ok({ user, accessToken, refreshToken }, 'Account created');
  }

  @Post('register')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Registar (legado — apenas admin)',
    description:
      'Contas públicas: use /auth/register/start + /auth/register/confirm com OTP.',
  })
  async register(
    @Body() dto: RegisterHttpDto,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() actor?: AuthUser,
  ) {
    const role = dto.role ?? UserRole.GUARDIAN;
    const isPublicRole =
      role === UserRole.GUARDIAN || role === UserRole.SCHOOL_OWNER;

    if (isPublicRole && !actor) {
      throw new BadRequestException(
        'Use POST /auth/register/start e /auth/register/confirm com o código OTP.',
      );
    }

    await this.platformBeta.assertCanRegister(dto.email, role);

    const { accessToken, refreshToken, user } =
      await this.registerUser.execute({
        ...dto,
        actorUserId: actor?.id,
        actorRole: actor?.role,
      });

    setAuthCookies(res, accessToken, refreshToken);
    return { user, accessToken, refreshToken };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pedir link de recuperação de palavra-passe' })
  async forgot(@Body() dto: ForgotPasswordHttpDto) {
    return ok(
      await this.forgotPassword.execute(dto),
      'If the email exists, a reset link was sent',
    );
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redefinir palavra-passe com token do email' })
  async reset(@Body() dto: ResetPasswordHttpDto) {
    return ok(
      await this.resetPassword.execute(dto),
      'Password reset successfully',
    );
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
