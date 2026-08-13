import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CookieOptions, Request, Response } from 'express';
import { ok } from '../../../../../shared/application/api-response';
import { PlatformBetaService } from '../../../application/platform-beta.service';
import { BetaAccessBodyDto } from '../dto/platform-beta.http-dto';
import { assertRateLimit } from '../rate-limit';

export const BETA_COOKIE = 'ekanda_beta';
const BETA_MAX_AGE = 14 * 24 * 60 * 60;

const isProduction = process.env.NODE_ENV === 'production';

function betaCookieOptions(maxAgeSec: number): CookieOptions {
  return {
    httpOnly: true,
    path: '/',
    maxAge: maxAgeSec * 1000,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
  };
}

function clientIp(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0]!.trim();
  return req.ip || 'unknown';
}

@ApiTags('platform-beta')
@Controller()
export class PlatformBetaPublicController {
  constructor(private readonly beta: PlatformBetaService) {}

  @Get('platform/settings')
  @ApiOperation({ summary: 'Settings públicos (beta gate + WhatsApp comunidade)' })
  async settings() {
    return ok(await this.beta.getSettings(), 'Platform settings fetched');
  }

  @Post('beta/requests')
  @HttpCode(200)
  @ApiOperation({ summary: 'Pedir acesso à comunidade beta' })
  async requestAccess(@Body() body: BetaAccessBodyDto, @Req() req: Request) {
    try {
      assertRateLimit(`beta:req:${clientIp(req)}`, 10, 60_000);
      assertRateLimit(`beta:req:email:${body.email.toLowerCase()}`, 5, 60_000);
    } catch {
      throw new HttpException(
        'Demasiados pedidos. Aguarde um minuto.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const entry = await this.beta.requestAccess(body);
    return ok(entry, 'Beta access requested');
  }

  @Post('beta/verify')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Confirmar email+telefone (aprovado) e criar sessão beta (cookie httpOnly)',
  })
  async verify(
    @Body() body: BetaAccessBodyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      assertRateLimit(`beta:verify:${clientIp(req)}`, 15, 60_000);
    } catch {
      throw new HttpException(
        'Demasiadas tentativas. Aguarde um minuto.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const result = await this.beta.verifyAndIssueSession(body);
    res.cookie(
      BETA_COOKIE,
      result.token,
      betaCookieOptions(result.expiresInSec),
    );

    return ok(
      {
        status: 'APPROVED' as const,
        email: result.request.email,
        phone: result.request.phone,
        whatsappCommunityUrl: result.whatsappCommunityUrl,
        welcome: true,
      },
      'Beta session created',
    );
  }

  @Get('beta/session')
  @ApiOperation({ summary: 'Validar cookie de sessão beta' })
  async session(@Req() req: Request) {
    const token = req.cookies?.[BETA_COOKIE] as string | undefined;
    const parsed = await this.beta.validateSessionToken(token);
    if (!parsed.ok) {
      throw new UnauthorizedException('Beta session required');
    }
    return ok(
      { authenticated: true, email: parsed.email, requestId: parsed.requestId },
      'Beta session valid',
    );
  }

  @Post('beta/logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Terminar sessão beta (limpa cookie)' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[BETA_COOKIE] as string | undefined;
    const parsed = await this.beta.validateSessionToken(token);
    if (parsed.ok) {
      await this.beta.clearSession(parsed.requestId);
    }
    res.clearCookie(BETA_COOKIE, betaCookieOptions(BETA_MAX_AGE));
    return ok({ cleared: true }, 'Beta session cleared');
  }
}
