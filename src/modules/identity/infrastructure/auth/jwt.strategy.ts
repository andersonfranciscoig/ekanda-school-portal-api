import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { GetCurrentUserUseCase } from '../../application/use-cases/get-current-user.use-case';
import { AuthUser } from './auth-user.type';
import { UserRole } from '../../domain/entities/user.entity';

type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly getCurrentUser: GetCurrentUserUseCase,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    try {
      const user = await this.getCurrentUser.execute({ userId: payload.sub });
      return {
        id: user.id,
        email: user.email,
        role: user.role as UserRole,
      };
    } catch {
      throw new UnauthorizedException('invalid session or user inactive');
    }
  }
}
