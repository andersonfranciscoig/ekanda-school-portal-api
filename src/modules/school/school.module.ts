import { Module, forwardRef } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { BillingModule } from '../billing/billing.module';
import { SCHOOL_REPOSITORY } from './domain/repositories/school.repository';
import { SCHOOL_LOCATION_REPOSITORY } from './domain/repositories/school-location.repository';
import { SCHOOL_EDUCATION_LEVEL_REPOSITORY } from './domain/repositories/school-education-level.repository';
import { SCHOOL_CLASS_REPOSITORY } from './domain/repositories/school-class.repository';
import { SCHOOL_SERVICE_REPOSITORY } from './domain/repositories/school-service.repository';
import { SCHOOL_PRICE_REPOSITORY } from './domain/repositories/school-price.repository';
import { SCHOOL_GALLERY_REPOSITORY } from './domain/repositories/school-gallery.repository';
import { CreateOrUpdateSchoolUseCase } from './application/use-cases/create-or-update-school.use-case';
import { CreateOrUpdateSchoolLocationUseCase } from './application/use-cases/create-or-update-school-location.use-case';
import { SyncSchoolEducationLevelsUseCase } from './application/use-cases/sync-school-education-levels.use-case';
import { CreateOrUpdateSchoolClassUseCase } from './application/use-cases/create-or-update-school-class.use-case';
import { SyncSchoolServicesUseCase } from './application/use-cases/sync-school-services.use-case';
import { CreateOrUpdateSchoolServiceUseCase } from './application/use-cases/create-or-update-school-service.use-case';
import { CreateOrUpdateSchoolPriceUseCase } from './application/use-cases/create-or-update-school-price.use-case';
import { CreateOrUpdateSchoolGalleryUseCase } from './application/use-cases/create-or-update-school-gallery.use-case';
import { GetSchoolOnboardingReviewUseCase } from './application/use-cases/get-school-onboarding-review.use-case';
import { CompleteSchoolOnboardingUseCase } from './application/use-cases/complete-school-onboarding.use-case';
import { DeleteSchoolLogoUseCase } from './application/use-cases/delete-school-logo.use-case';
import { DeleteSchoolLocationUseCase } from './application/use-cases/delete-school-location.use-case';
import { DeleteSchoolClassUseCase } from './application/use-cases/delete-school-class.use-case';
import { DeleteSchoolGalleryItemUseCase } from './application/use-cases/delete-school-gallery-item.use-case';
import { DeleteSchoolPriceUseCase } from './application/use-cases/delete-school-price.use-case';
import { DeleteSchoolEducationLevelsUseCase } from './application/use-cases/delete-school-education-levels.use-case';
import { DeleteSchoolServicesUseCase } from './application/use-cases/delete-school-services.use-case';
import { SubmitSchoolForActivationUseCase } from './application/use-cases/submit-school-for-activation.use-case';
import { CheckSchoolActivationEligibilityUseCase } from './application/use-cases/check-school-activation-eligibility.use-case';
import { PublishSchoolUseCase } from './application/use-cases/publish-school.use-case';
import { SuspendSchoolUseCase } from './application/use-cases/suspend-school.use-case';
import { ReactivateSchoolUseCase } from './application/use-cases/reactivate-school.use-case';
import { ExpireSchoolUseCase } from './application/use-cases/expire-school.use-case';
import { SchoolAccessAuthorizer } from './application/services/school-access.authorizer';
import { PrismaSchoolRepository } from './infrastructure/persistence/prisma/prisma-school.repository';
import { PrismaSchoolLocationRepository } from './infrastructure/persistence/prisma/prisma-school-location.repository';
import { PrismaSchoolEducationLevelRepository } from './infrastructure/persistence/prisma/prisma-school-education-level.repository';
import { PrismaSchoolClassRepository } from './infrastructure/persistence/prisma/prisma-school-class.repository';
import { PrismaSchoolServiceRepository } from './infrastructure/persistence/prisma/prisma-school-service.repository';
import { PrismaSchoolPriceRepository } from './infrastructure/persistence/prisma/prisma-school-price.repository';
import { PrismaSchoolGalleryRepository } from './infrastructure/persistence/prisma/prisma-school-gallery.repository';
import { PrismaSchoolOnboardingQuery } from './infrastructure/persistence/prisma/prisma-school-onboarding.query';
import { SCHOOL_ONBOARDING_QUERY } from './domain/repositories/school-onboarding.query';
import { SchoolsController } from './infrastructure/http/controllers/schools.controller';
import { SchoolHttpQueryService } from './infrastructure/http/school-http-query.service';

const schoolUseCases = [
  CreateOrUpdateSchoolUseCase,
  CreateOrUpdateSchoolLocationUseCase,
  SyncSchoolEducationLevelsUseCase,
  CreateOrUpdateSchoolClassUseCase,
  SyncSchoolServicesUseCase,
  CreateOrUpdateSchoolServiceUseCase,
  CreateOrUpdateSchoolPriceUseCase,
  CreateOrUpdateSchoolGalleryUseCase,
  GetSchoolOnboardingReviewUseCase,
  CompleteSchoolOnboardingUseCase,
  DeleteSchoolLogoUseCase,
  DeleteSchoolLocationUseCase,
  DeleteSchoolClassUseCase,
  DeleteSchoolGalleryItemUseCase,
  DeleteSchoolPriceUseCase,
  DeleteSchoolEducationLevelsUseCase,
  DeleteSchoolServicesUseCase,
  SubmitSchoolForActivationUseCase,
  CheckSchoolActivationEligibilityUseCase,
  PublishSchoolUseCase,
  SuspendSchoolUseCase,
  ReactivateSchoolUseCase,
  ExpireSchoolUseCase,
];

@Module({
  imports: [IdentityModule, forwardRef(() => BillingModule)],
  controllers: [SchoolsController],
  providers: [
    { provide: SCHOOL_REPOSITORY, useClass: PrismaSchoolRepository },
    {
      provide: SCHOOL_LOCATION_REPOSITORY,
      useClass: PrismaSchoolLocationRepository,
    },
    {
      provide: SCHOOL_EDUCATION_LEVEL_REPOSITORY,
      useClass: PrismaSchoolEducationLevelRepository,
    },
    {
      provide: SCHOOL_CLASS_REPOSITORY,
      useClass: PrismaSchoolClassRepository,
    },
    {
      provide: SCHOOL_SERVICE_REPOSITORY,
      useClass: PrismaSchoolServiceRepository,
    },
    {
      provide: SCHOOL_PRICE_REPOSITORY,
      useClass: PrismaSchoolPriceRepository,
    },
    {
      provide: SCHOOL_GALLERY_REPOSITORY,
      useClass: PrismaSchoolGalleryRepository,
    },
    {
      provide: SCHOOL_ONBOARDING_QUERY,
      useClass: PrismaSchoolOnboardingQuery,
    },
    SchoolAccessAuthorizer,
    SchoolHttpQueryService,
    ...schoolUseCases,
  ],
  exports: [
    SCHOOL_REPOSITORY,
    SCHOOL_LOCATION_REPOSITORY,
    SCHOOL_EDUCATION_LEVEL_REPOSITORY,
    SCHOOL_CLASS_REPOSITORY,
    SCHOOL_SERVICE_REPOSITORY,
    SCHOOL_PRICE_REPOSITORY,
    SCHOOL_GALLERY_REPOSITORY,
    SCHOOL_ONBOARDING_QUERY,
    SchoolAccessAuthorizer,
    ...schoolUseCases,
  ],
})
export class SchoolModule {}
