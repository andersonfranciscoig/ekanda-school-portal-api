import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      cookies?: Record<string, string>;
    }>();
    if (!request.headers.authorization && !request.cookies?.ekanda_access) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser>(
    err: Error | null,
    user: TUser,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      cookies?: Record<string, string>;
    }>();
    if (!request.headers.authorization && !request.cookies?.ekanda_access) {
      return undefined as TUser;
    }
    if (err || !user) throw err ?? new UnauthorizedException('Invalid or expired token');
    return user;
  }
}
