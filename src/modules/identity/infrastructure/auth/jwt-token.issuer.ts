import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  TokenIssuer,
  TokenPair,
  TokenPayload,
} from '../../application/ports/token-issuer.port';

@Injectable()
export class JwtTokenIssuer implements TokenIssuer {
  private readonly refreshSecret: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.refreshSecret = config.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  issue(payload: TokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, { expiresIn: '15m' });
  }

  async issuePair(payload: TokenPayload): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, { expiresIn: '15m' }),
      this.jwt.signAsync(payload, {
        secret: this.refreshSecret,
        expiresIn: '7d',
      }),
    ]);
    return { accessToken, refreshToken };
  }

  async verifyRefresh(token: string): Promise<TokenPayload> {
    try {
      const { sub, email, role } = await this.jwt.verifyAsync<TokenPayload>(
        token,
        { secret: this.refreshSecret },
      );
      return { sub, email, role };
    } catch {
      throw new UnauthorizedException('invalid or expired refresh token');
    }
  }
}
