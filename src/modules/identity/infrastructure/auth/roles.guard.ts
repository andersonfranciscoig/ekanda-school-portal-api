import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenDomainException } from '../../../../shared/domain/exceptions/domain.exception';
import { UserRole } from '../../domain/entities/user.entity';
import { AuthUser } from './auth-user.type';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenDomainException(
        'Apenas administradores Ekanda podem executar esta acção',
      );
    }
    return true;
  }
}
