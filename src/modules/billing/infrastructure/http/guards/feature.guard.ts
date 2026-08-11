import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SchoolEntitlementService } from '../../../application/services/school-entitlement.service';
import { SchoolFeatureNotAllowedException } from '../../../domain/exceptions/billing.exceptions';

export const REQUIRED_FEATURE_KEY = 'requiredFeature';

export const RequireFeature = (featureCode: string) =>
  SetMetadata(REQUIRED_FEATURE_KEY, featureCode);

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: SchoolEntitlementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<string>(
      REQUIRED_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!feature) return true;

    const request = context.switchToHttp().getRequest<{
      params?: { schoolId?: string };
      body?: { schoolId?: string };
      query?: { schoolId?: string };
    }>();
    const schoolId =
      request.params?.schoolId ??
      request.body?.schoolId ??
      request.query?.schoolId;
    if (!schoolId) {
      throw new SchoolFeatureNotAllowedException(
        'schoolId is required to evaluate plan entitlements',
      );
    }

    const allowed = await this.entitlements.canAccess(schoolId, feature);
    if (!allowed) {
      throw new SchoolFeatureNotAllowedException();
    }
    return true;
  }
}
